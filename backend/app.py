from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from starlette.background import BackgroundTask
import os
import shutil
import math
import tempfile
import json
import logging
import time
import uuid
import zipfile
from io import BytesIO
from psycopg2.extras import Json
from defusedxml import ElementTree as SafeET
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from contextlib import asynccontextmanager
import pandas as pd
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, model_validator

from database import get_db_connection, load_backend_env
from estimator import parse_opera_file, calculate_project_estimates, generate_excel_report
from auth import hash_password, verify_password, create_jwt, get_current_user, allow_admin_only, allow_editor_admin

@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    yield

app = FastAPI(title="CIC-Nova Estimation API", lifespan=lifespan)
logger = logging.getLogger("cic_nova.api")

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(json.dumps({
            "event": "request_failed",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
        }, ensure_ascii=False))
        raise
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    log_event = logger.warning if response.status_code >= 500 or duration_ms >= _slow_request_ms else logger.info
    log_event(json.dumps({
        "event": "request_completed",
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "duration_ms": duration_ms,
    }, ensure_ascii=False))
    return response

@app.get("/health")
def health_check():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        return {"status": "ok", "database": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# Enable CORS for frontend integration
_runtime_env = load_backend_env()
_slow_request_ms = float(os.getenv("NOVA_SLOW_REQUEST_MS") or _runtime_env.get("NOVA_SLOW_REQUEST_MS", 2000))
_cors_raw = os.getenv("NOVA_CORS_ORIGINS") or _runtime_env.get(
    "NOVA_CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"
)
_cors_origins = [origin.strip() for origin in _cors_raw.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_UPLOAD_BYTES = int(
    os.getenv("NOVA_MAX_UPLOAD_BYTES")
    or _runtime_env.get("NOVA_MAX_UPLOAD_BYTES", 25 * 1024 * 1024)
)

def safe_upload_name(filename: Optional[str], fallback: str = "upload.xlsx") -> str:
    """Return a filename without any user-controlled path components."""
    normalized = (filename or fallback).replace("\\", "/")
    safe_name = os.path.basename(normalized).strip()
    return safe_name or fallback

async def save_upload_with_limit(upload: UploadFile, destination: str) -> int:
    """Stream an upload to disk while enforcing the configured size limit."""
    written = 0
    try:
        with open(destination, "wb") as buffer:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File vượt quá giới hạn {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
                    )
                buffer.write(chunk)
        return written
    except Exception:
        if os.path.exists(destination):
            os.remove(destination)
        raise

def _xml_number(element, *names, default=0.0):
    for name in names:
        value = element.findtext(name)
        if value not in (None, ""):
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
    return default

def parse_opera_xml_bom(file_path: str):
    tree = SafeET.parse(file_path)
    root = tree.getroot()
    for element in root.iter():
        if isinstance(element.tag, str) and "}" in element.tag:
            element.tag = element.tag.split("}", 1)[1]

    doors = []
    rows = []
    components = root.findall(".//component")
    for component_index, component in enumerate(components, start=1):
        typology = (
            component.findtext("cmp_name")
            or component.findtext("cmp_position")
            or f"OPERA-{component_index}"
        ).strip()
        door_code = (component.findtext("cmp_position") or typology).strip()
        component_qty = max(1, int(_xml_number(component, "cmp_quantity", default=1)))
        doors.append({
            "code": door_code,
            "typology": typology,
            "width": _xml_number(component, "cmp_width", default=1200),
            "height": _xml_number(component, "cmp_height", default=1500),
            "qty": component_qty,
            "description": (component.findtext("cmp_description") or component.findtext("cmp_notes") or "").strip(),
        })
        for material in component.findall(".//materials/material"):
            code = (material.findtext("mat_alternative_code") or material.findtext("mat_supplier_code") or "").strip()
            if not code:
                continue
            quantity = _xml_number(material, "mat_quantity", default=0)
            if quantity <= 0:
                continue
            unit = (material.findtext("mat_unit") or "pc").strip()
            name = (material.findtext("mat_name") or material.findtext("mat_description") or code).strip()
            rows.append({
                "typology": typology,
                "code": code,
                "name": name,
                "description": (material.findtext("mat_description") or "").strip(),
                "quantity": quantity,
                "unit": unit,
                "unit_weight": _xml_number(material, "mat_unit_weight", "mat_weight", default=0) or None,
                "color": (material.findtext("mat_color") or "").strip() or None,
                "width": _xml_number(material, "mat_width", default=0) or None,
                "height": _xml_number(material, "mat_height", default=0) or None,
                "unit_price": _xml_number(material, "mat_price", "mat_full_price", default=0) or None,
            })

    if not doors and rows:
        doors.append({"code": "OPERA-XML", "typology": "OPERA-XML", "width": 1200, "height": 1500, "qty": 1, "description": ""})
    return doors, rows

def generate_quote_pdf_bytes(project_name: str, version_number: int, results: list) -> bytes:
    buffer = BytesIO()
    font_name = "Helvetica"
    for font_path in [
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        if os.path.exists(font_path):
            font_name = "NovaUnicode"
            if font_name not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont(font_name, font_path))
            break

    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=f"Báo giá {project_name} V{version_number}",
    )
    styles = getSampleStyleSheet()
    for style_name in ["Title", "Heading2", "BodyText"]:
        styles[style_name].fontName = font_name
    story = [
        Paragraph(f"BÁO GIÁ DỰ ÁN: {project_name}", styles["Title"]),
        Paragraph(f"Phiên bản V{version_number}", styles["Heading2"]),
        Spacer(1, 8 * mm),
    ]
    table_data = [["STT", "Mã cửa", "Tên cửa", "Kích thước", "SL", "Diện tích", "Đơn giá/m²", "Thành tiền"]]
    for index, item in enumerate(results, start=1):
        table_data.append([
            index,
            item.get("code", ""),
            item.get("name", ""),
            f'{item.get("width", 0):,.0f} × {item.get("height", 0):,.0f}',
            f'{item.get("qty", 0):,.0f}',
            f'{item.get("total_area", 0):,.2f}',
            f'{item.get("price_per_m2", 0):,.0f}',
            f'{item.get("total_price", 0):,.0f}',
        ])
    total_price = sum(float(item.get("total_price") or 0) for item in results)
    table_data.append(["", "", "TỔNG CỘNG", "", "", "", "", f"{total_price:,.0f}"])
    table = Table(table_data, repeatRows=1, colWidths=[12*mm, 25*mm, 58*mm, 32*mm, 13*mm, 24*mm, 30*mm, 34*mm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#253C78")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
        ("FONTNAME", (0, -1), (-1, -1), font_name),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    document.build(story)
    return buffer.getvalue()

def run_migrations():
    print("Running database migrations...")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        migration_dir = os.path.join(os.path.dirname(__file__), "migrations")
        for filename in sorted(name for name in os.listdir(migration_dir) if name.endswith(".sql")):
            with open(os.path.join(migration_dir, filename), "r", encoding="utf-8") as migration_file:
                cursor.execute(migration_file.read())
        conn.commit()
        print("Database migrations completed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Database migration error: {e}")
    finally:
        conn.close()

# Pydantic models for request bodies
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    price_book_id: Optional[int] = Field(default=None, gt=0)

class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    price_book_id: Optional[int] = Field(default=None, gt=0)
    pct_company: Optional[float] = Field(default=2.0, ge=0, le=100)
    pct_contingency: Optional[float] = Field(default=2.0, ge=0, le=100)
    pct_warranty: Optional[float] = Field(default=1.5, ge=0, le=100)
    pct_other: Optional[float] = Field(default=1.0, ge=0, le=100)

class DoorCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    template_id: int = Field(gt=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    width1: Optional[float] = Field(default=None, ge=0)
    height1: Optional[float] = Field(default=None, ge=0)
    width2: Optional[float] = Field(default=None, ge=0)
    height2: Optional[float] = Field(default=None, ge=0)
    qty: int = Field(ge=1)
    layout_json: Optional[str] = None

class FormulaUpdate(BaseModel):
    id: int = Field(gt=0)
    formula: str = Field(min_length=1, max_length=200)
    qty: int = Field(ge=0)
    weight_per_m: float = Field(ge=0)

class TemplateFormulaUpdateList(BaseModel):
    formulas: List[FormulaUpdate]

class TemplateCreate(BaseModel):
    system_id: int = Field(gt=0)
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    type: str = Field(min_length=1, max_length=100)
    accessory_brand: Optional[str] = "Draho"
    glass_type: Optional[str] = "k8cl"
    percent_aluminum: Optional[float] = Field(default=45.0, ge=0, le=100)
    percent_glass: Optional[float] = Field(default=10.0, ge=0, le=100)
    percent_accessories: Optional[float] = Field(default=20.0, ge=0, le=100)
    percent_labor: Optional[float] = Field(default=25.0, ge=0, le=100)
    layout_json: Optional[str] = None

    @model_validator(mode="after")
    def validate_cost_percentages(self):
        total = sum(
            value or 0
            for value in (
                self.percent_aluminum,
                self.percent_glass,
                self.percent_accessories,
                self.percent_labor,
            )
        )
        if abs(total - 100) > 0.01:
            raise ValueError("Tổng tỷ trọng cấu thành giá phải bằng 100%.")
        return self

class ProfileFormulaUpdate(BaseModel):
    id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=100)
    dimension_type: str = Field(min_length=1, max_length=50)
    formula: str = Field(min_length=1, max_length=200)
    qty: int = Field(ge=0)
    weight_per_m: float = Field(ge=0)

class ProfileFormulaUpdateList(BaseModel):
    formulas: List[ProfileFormulaUpdate]

class AccessoryFormulaUpdate(BaseModel):
    id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=100)
    qty: float = Field(ge=0)

class AccessoryFormulaUpdateList(BaseModel):
    accessories: List[AccessoryFormulaUpdate]

class MaterialCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=250)
    category: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=50)
    default_price: float = Field(ge=0)
    weight_per_m: Optional[float] = Field(default=0.0, ge=0)

class MaterialUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=250)
    category: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=50)
    default_price: float = Field(ge=0)
    weight_per_m: float = Field(ge=0)

class TemplateUpdate(BaseModel):
    system_id: int = Field(gt=0)
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    type: str = Field(min_length=1, max_length=100)
    accessory_brand: Optional[str] = "Draho"
    glass_type: Optional[str] = "k8cl"
    percent_aluminum: Optional[float] = Field(default=45.0, ge=0, le=100)
    percent_glass: Optional[float] = Field(default=10.0, ge=0, le=100)
    percent_accessories: Optional[float] = Field(default=20.0, ge=0, le=100)
    percent_labor: Optional[float] = Field(default=25.0, ge=0, le=100)
    layout_json: Optional[str] = None

    @model_validator(mode="after")
    def validate_cost_percentages(self):
        total = sum(
            value or 0
            for value in (
                self.percent_aluminum,
                self.percent_glass,
                self.percent_accessories,
                self.percent_labor,
            )
        )
        if abs(total - 100) > 0.01:
            raise ValueError("Tổng tỷ trọng cấu thành giá phải bằng 100%.")
        return self

# API Endpoints

# 1. Projects Management
@app.get("/api/projects", dependencies=[Depends(get_current_user)])
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects ORDER BY created_at DESC")
    projects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return projects

@app.post("/api/projects", dependencies=[Depends(allow_editor_admin)])
def create_project(project: ProjectCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO projects (name, description, price_book_id) VALUES (%s, %s, %s) RETURNING id", (project.name, project.description, project.price_book_id))
        project_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": project_id, "name": project.name, "description": project.description, "price_book_id": project.price_book_id}
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể tạo dự án.")
    finally:
        conn.close()

@app.put("/api/projects/{project_id}", dependencies=[Depends(allow_editor_admin)])
def update_project(project_id: int, project: ProjectUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        UPDATE projects 
        SET name = %s, 
            description = %s, 
            price_book_id = %s,
            pct_company = %s, 
            pct_contingency = %s, 
            pct_warranty = %s, 
            pct_other = %s
        WHERE id = %s
        """, (project.name, project.description, project.price_book_id, project.pct_company, project.pct_contingency, project.pct_warranty, project.pct_other, project_id))
        conn.commit()
        return {
            "id": project_id, 
            "name": project.name, 
            "description": project.description,
            "price_book_id": project.price_book_id,
            "pct_company": project.pct_company,
            "pct_contingency": project.pct_contingency,
            "pct_warranty": project.pct_warranty,
            "pct_other": project.pct_other
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.delete("/api/projects/{project_id}", dependencies=[Depends(allow_editor_admin)])
def delete_project(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Delete related doors and prices first to maintain integrity
        cursor.execute("DELETE FROM project_doors WHERE project_id = %s", (project_id,))
        cursor.execute("DELETE FROM project_material_prices WHERE project_id = %s", (project_id,))
        cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))
        conn.commit()
        return {"message": "Project deleted successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

# 2. Project Doors Management
@app.get("/api/projects/{project_id}/doors", dependencies=[Depends(get_current_user)])
def get_project_doors(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT pd.*, t.code as template_code, t.name as template_name
    FROM project_doors pd
    JOIN templates t ON pd.template_id = t.id
    WHERE pd.project_id = %s
    """, (project_id,))
    doors = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return doors

@app.post("/api/projects/{project_id}/doors", dependencies=[Depends(allow_editor_admin)])
def add_project_door(project_id: int, door: DoorCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Fetch template layout if not provided
        layout = door.layout_json
        if not layout:
            cursor.execute("SELECT layout_json FROM templates WHERE id = %s", (door.template_id,))
            row = cursor.fetchone()
            if row:
                layout = row[0]

        cursor.execute("""
        INSERT INTO project_doors (project_id, code, template_id, width, height, width1, height1, width2, height2, qty, layout_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (project_id, door.code, door.template_id, door.width, door.height, door.width1, door.height1, door.width2, door.height2, door.qty, layout))
        door_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": door_id, "project_id": project_id, **door.dict()}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.put("/api/projects/{project_id}/doors/{door_id}", dependencies=[Depends(allow_editor_admin)])
def update_project_door(project_id: int, door_id: int, door: DoorCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        UPDATE project_doors 
        SET code = %s, template_id = %s, width = %s, height = %s, 
            width1 = %s, height1 = %s, width2 = %s, height2 = %s, qty = %s, layout_json = %s
        WHERE id = %s AND project_id = %s
        """, (door.code, door.template_id, door.width, door.height, 
              door.width1, door.height1, door.width2, door.height2, door.qty, door.layout_json,
              door_id, project_id))
        conn.commit()
        return {"id": door_id, "project_id": project_id, **door.dict()}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.delete("/api/projects/{project_id}/doors/{door_id}", dependencies=[Depends(allow_editor_admin)])
def delete_project_door(project_id: int, door_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM project_doors WHERE id = %s AND project_id = %s", (door_id, project_id))
        conn.commit()
        return {"message": "Door deleted successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

# 3. Templates & Formulas Management
@app.get("/api/systems", dependencies=[Depends(get_current_user)])
def get_systems():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM systems")
    systems = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return systems

@app.get("/api/templates", dependencies=[Depends(get_current_user)])
def get_templates():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT t.*, s.name as system_name 
    FROM templates t
    JOIN systems s ON t.system_id = s.id
    """)
    templates = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return templates

@app.post("/api/templates", dependencies=[Depends(allow_editor_admin)])
def create_template(t: TemplateCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO templates (system_id, code, name, type, accessory_brand, glass_type, percent_aluminum, percent_glass, percent_accessories, percent_labor, layout_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (t.system_id, t.code, t.name, t.type, t.accessory_brand, t.glass_type, t.percent_aluminum, t.percent_glass, t.percent_accessories, t.percent_labor, t.layout_json))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": new_id, "message": "Template created successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.put("/api/templates/{template_id}", dependencies=[Depends(allow_editor_admin)])
def update_template(template_id: int, t: TemplateUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        UPDATE templates
        SET system_id = %s, code = %s, name = %s, type = %s, accessory_brand = %s, glass_type = %s,
            percent_aluminum = %s, percent_glass = %s, percent_accessories = %s, percent_labor = %s, layout_json = %s
        WHERE id = %s
        """, (t.system_id, t.code, t.name, t.type, t.accessory_brand, t.glass_type,
              t.percent_aluminum, t.percent_glass, t.percent_accessories, t.percent_labor, t.layout_json, template_id))
        conn.commit()
        return {"message": "Template updated successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

# --- Predefined Typologies Library ---
TYPOLOGY_LIBRARY = {
    "CSL-50.01": {
        "name": "Cửa sổ lùa 2 cánh",
        "type": "CỬA SỔ LÙA",
        "layout_json": '{"id":"root","direction":"vertical","ratio":1.0,"children":[{"id":"pane_1","direction":"leaf","type":"sliding-left","ratio":0.5},{"id":"pane_2","direction":"leaf","type":"sliding-right","ratio":0.5}]}',
        "profiles": [
            {"name": "Khung bao ngang", "code": "KB-NGANG", "dimension_type": "W", "formula": "W", "qty": 2, "weight_per_m": 1.1},
            {"name": "Khung bao đứng", "code": "KB-DUNG", "dimension_type": "H", "formula": "H", "qty": 2, "weight_per_m": 1.2},
            {"name": "Thanh cánh trơn", "code": "CANH-TRON", "dimension_type": "H", "formula": "H - 0.047", "qty": 2, "weight_per_m": 0.95},
            {"name": "Thanh cánh móc", "code": "CANH-MOC", "dimension_type": "H", "formula": "H - 0.047", "qty": 1, "weight_per_m": 1.05},
            {"name": "Thanh cánh bánh xe", "code": "CANH-BX", "dimension_type": "W", "formula": "W / 2 - 0.015", "qty": 2, "weight_per_m": 0.9}
        ],
        "accessories": [
            {"name": "Bánh xe đúp", "code": "BX-DUP", "qty": 4.0},
            {"name": "Khóa bán nguyệt", "code": "K-NGUYET", "qty": 1.0},
            {"name": "Chốt âm cửa lùa", "code": "CHOT-AM", "qty": 1.0}
        ]
    },
    "CSL-50.02": {
        "name": "Cửa sổ lùa 2 cánh có ô fix",
        "type": "CỬA SỔ LÙA",
        "layout_json": '{"id":"root","direction":"horizontal","ratio":1.0,"children":[{"id":"top_fix","direction":"leaf","type":"fixed","ratio":0.3,"label":"FIX"},{"id":"bottom_sliding","direction":"vertical","ratio":0.7,"children":[{"id":"pane_1","direction":"leaf","type":"sliding-left","ratio":0.5},{"id":"pane_2","direction":"leaf","type":"sliding-right","ratio":0.5}]}]}',
        "profiles": [
            {"name": "Khung bao ngang", "code": "KB-NGANG", "dimension_type": "W", "formula": "W", "qty": 3, "weight_per_m": 1.1},
            {"name": "Khung bao đứng", "code": "KB-DUNG", "dimension_type": "H", "formula": "H", "qty": 2, "weight_per_m": 1.2},
            {"name": "Thanh cánh trơn", "code": "CANH-TRON", "dimension_type": "H", "formula": "H * 0.7 - 0.047", "qty": 2, "weight_per_m": 0.95},
            {"name": "Thanh cánh móc", "code": "CANH-MOC", "dimension_type": "H", "formula": "H * 0.7 - 0.047", "qty": 1, "weight_per_m": 1.05},
            {"name": "Thanh cánh bánh xe", "code": "CANH-BX", "dimension_type": "W", "formula": "W / 2 - 0.015", "qty": 2, "weight_per_m": 0.9}
        ],
        "accessories": [
            {"name": "Bánh xe đúp", "code": "BX-DUP", "qty": 4.0},
            {"name": "Khóa bán nguyệt", "code": "K-NGUYET", "qty": 1.0},
            {"name": "Chốt âm cửa lùa", "code": "CHOT-AM", "qty": 1.0},
            {"name": "Ke góc ô fix", "code": "KE-FIX", "qty": 4.0}
        ]
    },
    "CDMQ-50.01": {
        "name": "Cửa đi mở quay 1 cánh",
        "type": "CỬA ĐI MỞ QUAY",
        "layout_json": '{"id":"root","direction":"vertical","ratio":1.0,"children":[{"id":"pane_1","direction":"leaf","type":"swing-left","ratio":1.0}]}',
        "profiles": [
            {"name": "Khung bao đứng", "code": "KB-DUNG", "dimension_type": "H", "formula": "H", "qty": 2, "weight_per_m": 1.3},
            {"name": "Khung bao ngang", "code": "KB-NGANG", "dimension_type": "W", "formula": "W", "qty": 1, "weight_per_m": 1.2},
            {"name": "Thanh cánh cửa đi", "code": "CANH-CD", "dimension_type": "H", "formula": "H - 0.045", "qty": 2, "weight_per_m": 1.4},
            {"name": "Thanh ngang cánh dưới", "code": "CANH-NGANG-BOT", "dimension_type": "W", "formula": "W - 0.09", "qty": 1, "weight_per_m": 1.5},
            {"name": "Thanh ngang cánh trên", "code": "CANH-NGANG-TOP", "dimension_type": "W", "formula": "W - 0.09", "qty": 1, "weight_per_m": 1.3}
        ],
        "accessories": [
            {"name": "Bản lề 3D", "code": "BAN-LE-3D", "qty": 3.0},
            {"name": "Khóa đơn/đa điểm", "code": "KHOA-CD", "qty": 1.0},
            {"name": "Tay nắm cửa đi", "code": "TAY-NAM", "qty": 1.0}
        ]
    },
    "CDMQ-50.02": {
        "name": "Cửa đi mở quay 2 cánh",
        "type": "CỬA ĐI MỞ QUAY",
        "layout_json": '{"id":"root","direction":"vertical","ratio":1.0,"children":[{"id":"pane_1","direction":"leaf","type":"swing-left","ratio":0.5},{"id":"pane_2","direction":"leaf","type":"swing-right","ratio":0.5}]}',
        "profiles": [
            {"name": "Khung bao đứng", "code": "KB-DUNG", "dimension_type": "H", "formula": "H", "qty": 2, "weight_per_m": 1.3},
            {"name": "Khung bao ngang", "code": "KB-NGANG", "dimension_type": "W", "formula": "W", "qty": 1, "weight_per_m": 1.2},
            {"name": "Thanh cánh cửa đi", "code": "CANH-CD", "dimension_type": "H", "formula": "H - 0.045", "qty": 4, "weight_per_m": 1.4},
            {"name": "Thanh ngang cánh ngang", "code": "CANH-NGANG", "dimension_type": "W", "formula": "W / 2 - 0.075", "qty": 4, "weight_per_m": 1.3},
            {"name": "Thanh đố động 2 cánh", "code": "DO-DONG", "dimension_type": "H", "formula": "H - 0.05", "qty": 1, "weight_per_m": 1.1}
        ],
        "accessories": [
            {"name": "Bản lề 3D", "code": "BAN-LE-3D", "qty": 6.0},
            {"name": "Khóa đa điểm", "code": "KHOA-CD", "qty": 1.0},
            {"name": "Tay nắm cửa đi", "code": "TAY-NAM", "qty": 1.0},
            {"name": "Chốt cánh phụ", "code": "CHOT-PHU", "qty": 2.0}
        ]
    },
    "CSMQ-50.01": {
        "name": "Cửa sổ mở hất 1 cánh",
        "type": "CỬA SỔ MỞ QUAY",
        "layout_json": '{"id":"root","direction":"vertical","ratio":1.0,"children":[{"id":"pane_1","direction":"leaf","type":"awning","ratio":1.0}]}',
        "profiles": [
            {"name": "Khung bao ngang", "code": "KB-NGANG", "dimension_type": "W", "formula": "W", "qty": 2, "weight_per_m": 1.0},
            {"name": "Khung bao đứng", "code": "KB-DUNG", "dimension_type": "H", "formula": "H", "qty": 2, "weight_per_m": 1.1},
            {"name": "Thanh cánh cửa sổ", "code": "CANH-CS", "dimension_type": "H", "formula": "H - 0.04", "qty": 2, "weight_per_m": 1.15},
            {"name": "Thanh cánh ngang cửa sổ", "code": "CANH-CS-NGANG", "dimension_type": "W", "formula": "W - 0.04", "qty": 2, "weight_per_m": 1.15}
        ],
        "accessories": [
            {"name": "Bản lề chữ A", "code": "BAN-LE-A", "qty": 2.0},
            {"name": "Thanh hạn vị", "code": "HAN-VI", "qty": 1.0},
            {"name": "Tay chống gió", "code": "TAY-CHONG", "qty": 1.0},
            {"name": "Tay nắm cửa sổ mở hất", "code": "TAY-NAM-CS", "qty": 1.0}
        ]
    }
}

class ApplyTypologyRequest(BaseModel):
    typology_code: str

@app.post("/api/templates/{template_id}/apply-typology", dependencies=[Depends(allow_editor_admin)])
def apply_template_typology(template_id: int, req: ApplyTypologyRequest):
    typology_code = req.typology_code
    if typology_code not in TYPOLOGY_LIBRARY:
        raise HTTPException(status_code=400, detail="Mã mẫu cửa không hợp lệ.")
        
    typology = TYPOLOGY_LIBRARY[typology_code]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Update template's layout_json and type
        cursor.execute("""
        UPDATE templates
        SET layout_json = %s, type = %s
        WHERE id = %s
        """, (typology["layout_json"], typology["type"], template_id))
        
        # 2. Delete existing formulas
        cursor.execute("DELETE FROM profile_formulas WHERE template_id = %s", (template_id,))
        cursor.execute("DELETE FROM accessory_formulas WHERE template_id = %s", (template_id,))
        
        # 3. Insert new profiles
        for p in typology["profiles"]:
            cursor.execute("""
            INSERT INTO profile_formulas (template_id, name, code, dimension_type, formula, qty, weight_per_m)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (template_id, p["name"], p["code"], p["dimension_type"], p["formula"], p["qty"], p["weight_per_m"]))
            
        # 4. Insert new accessories
        for a in typology["accessories"]:
            cursor.execute("""
            INSERT INTO accessory_formulas (template_id, name, code, qty)
            VALUES (%s, %s, %s, %s)
            """, (template_id, a["name"], a["code"], a["qty"]))
            
        conn.commit()
        return {"message": f"Áp dụng mẫu cửa {typology_code} thành công!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        cursor.close()
        conn.close()

class ProfileFormulaInput(BaseModel):
    name: str
    code: str
    dimension_type: str
    formula: str
    qty: int
    weight_per_m: float

class AccessoryFormulaInput(BaseModel):
    name: str
    code: str
    qty: float

class RegenerateFormulasRequest(BaseModel):
    profiles: List[ProfileFormulaInput]
    accessories: List[AccessoryFormulaInput]

@app.post("/api/templates/{template_id}/formulas/regenerate", dependencies=[Depends(allow_editor_admin)])
def regenerate_template_formulas(template_id: int, req: RegenerateFormulasRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Delete existing formulas
        cursor.execute("DELETE FROM profile_formulas WHERE template_id = %s", (template_id,))
        cursor.execute("DELETE FROM accessory_formulas WHERE template_id = %s", (template_id,))
        
        # 2. Insert new profiles
        for p in req.profiles:
            cursor.execute("""
            INSERT INTO profile_formulas (template_id, name, code, dimension_type, formula, qty, weight_per_m)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (template_id, p.name, p.code, p.dimension_type, p.formula, p.qty, p.weight_per_m))
            
        # 3. Insert new accessories
        for a in req.accessories:
            cursor.execute("""
            INSERT INTO accessory_formulas (template_id, name, code, qty)
            VALUES (%s, %s, %s, %s)
            """, (template_id, a.name, a.code, a.qty))
            
        conn.commit()
        return {"message": "Đã tái tạo định mức và công thức thành công!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/templates/{template_id}", dependencies=[Depends(allow_editor_admin)])
def delete_template(template_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Delete profile and accessory formulas first
        cursor.execute("DELETE FROM profile_formulas WHERE template_id = %s", (template_id,))
        cursor.execute("DELETE FROM accessory_formulas WHERE template_id = %s", (template_id,))
        cursor.execute("DELETE FROM templates WHERE id = %s", (template_id,))
        conn.commit()
        return {"message": "Template deleted successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.get("/api/templates/{template_id}/formulas", dependencies=[Depends(get_current_user)])
def get_template_formulas(template_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get profiles formulas
    cursor.execute("SELECT * FROM profile_formulas WHERE template_id = %s", (template_id,))
    profiles = [dict(row) for row in cursor.fetchall()]
    
    # Get accessories formulas
    cursor.execute("SELECT * FROM accessory_formulas WHERE template_id = %s", (template_id,))
    accessories = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return {"profiles": profiles, "accessories": accessories}

@app.post("/api/templates/{template_id}/profile-formulas", dependencies=[Depends(allow_editor_admin)])
def add_profile_formula(template_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Create a blank formula
        cursor.execute("""
        INSERT INTO profile_formulas (template_id, name, code, dimension_type, formula, qty, weight_per_m)
        VALUES (%s, 'Thanh nhôm mới', 'PROFILE-NEW', 'H', 'H - 0.0', 1, 0.0) RETURNING id
        """, (template_id,))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": new_id, "message": "Profile formula added"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.delete("/api/profile-formulas/{formula_id}", dependencies=[Depends(allow_editor_admin)])
def delete_profile_formula(formula_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM profile_formulas WHERE id = %s", (formula_id,))
        conn.commit()
        return {"message": "Profile formula deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.put("/api/templates/{template_id}/profile-formulas", dependencies=[Depends(allow_editor_admin)])
def update_profile_formulas(template_id: int, request: ProfileFormulaUpdateList):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for f in request.formulas:
            cursor.execute("""
            UPDATE profile_formulas 
            SET name = %s, code = %s, dimension_type = %s, formula = %s, qty = %s, weight_per_m = %s
            WHERE id = %s AND template_id = %s
            """, (f.name, f.code, f.dimension_type, f.formula, f.qty, f.weight_per_m, f.id, template_id))
        conn.commit()
        return {"message": "Profile formulas updated successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.post("/api/templates/{template_id}/accessory-formulas", dependencies=[Depends(allow_editor_admin)])
def add_accessory_formula(template_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO accessory_formulas (template_id, name, code, qty)
        VALUES (%s, 'Phụ kiện mới', 'ACC-NEW', 1.0) RETURNING id
        """, (template_id,))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": new_id, "message": "Accessory formula added"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.delete("/api/accessory-formulas/{formula_id}", dependencies=[Depends(allow_editor_admin)])
def delete_accessory_formula(formula_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM accessory_formulas WHERE id = %s", (formula_id,))
        conn.commit()
        return {"message": "Accessory formula deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.put("/api/templates/{template_id}/accessory-formulas", dependencies=[Depends(allow_editor_admin)])
def update_accessory_formulas(template_id: int, request: AccessoryFormulaUpdateList):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for a in request.accessories:
            cursor.execute("""
            UPDATE accessory_formulas 
            SET name = %s, code = %s, qty = %s
            WHERE id = %s AND template_id = %s
            """, (a.name, a.code, a.qty, a.id, template_id))
        conn.commit()
        return {"message": "Accessory formulas updated successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

# 3.5. Materials Management
@app.get("/api/materials", dependencies=[Depends(get_current_user)])
def get_materials():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM materials ORDER BY category, code")
    materials = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return materials

@app.post("/api/materials")
def create_material(m: MaterialCreate, current_user: dict = Depends(allow_editor_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (m.code, m.name, m.category, m.unit, m.default_price, m.weight_per_m))
        new_id = cursor.fetchone()[0]
        cursor.execute("""
        INSERT INTO material_price_history
            (material_id, material_code, scope, old_price, new_price, changed_by, changed_by_name)
        VALUES (%s, %s, 'default', NULL, %s, %s, %s)
        """, (new_id, m.code, m.default_price, current_user["id"], current_user["name"]))
        conn.commit()
        return {"id": new_id, "message": "Material created successfully"}
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể tạo vật tư.")
    finally:
        conn.close()

@app.put("/api/materials/{material_id}")
def update_material(material_id: int, m: MaterialUpdate, current_user: dict = Depends(allow_editor_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT code, default_price FROM materials WHERE id = %s", (material_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Không tìm thấy vật tư.")
        cursor.execute("""
        UPDATE materials
        SET name = %s, category = %s, unit = %s, default_price = %s, weight_per_m = %s
        WHERE id = %s
        """, (m.name, m.category, m.unit, m.default_price, m.weight_per_m, material_id))
        if float(existing[1] or 0) != float(m.default_price):
            cursor.execute("""
            INSERT INTO material_price_history
                (material_id, material_code, scope, old_price, new_price, changed_by, changed_by_name)
            VALUES (%s, %s, 'default', %s, %s, %s, %s)
            """, (
                material_id, existing[0], existing[1], m.default_price,
                current_user["id"], current_user["name"],
            ))
        conn.commit()
        return {"message": "Material updated successfully"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể cập nhật vật tư.")
    finally:
        conn.close()

@app.get("/api/materials/{material_id}/price-history")
def get_material_price_history(material_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT code, name FROM materials WHERE id = %s", (material_id,))
        material = cursor.fetchone()
        if not material:
            raise HTTPException(status_code=404, detail="Không tìm thấy vật tư.")
        cursor.execute("""
        SELECT h.id, h.scope, h.price_book_id, pb.name AS price_book_name,
               h.project_id, p.name AS project_name, h.old_price, h.new_price,
               h.changed_by_name, h.created_at
        FROM material_price_history h
        LEFT JOIN price_books pb ON pb.id = h.price_book_id
        LEFT JOIN projects p ON p.id = h.project_id
        WHERE h.material_code = %s
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT 200
        """, (material[0],))
        return {
            "material": {"id": material_id, "code": material[0], "name": material[1]},
            "history": [dict(row) for row in cursor.fetchall()],
        }
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/materials/{material_id}", dependencies=[Depends(allow_editor_admin)])
def delete_material(material_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM materials WHERE id = %s", (material_id,))
        conn.commit()
        return {"message": "Material deleted successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

# 4. Import & Calculate API

@app.post("/api/projects/{project_id}/calculate", dependencies=[Depends(get_current_user)])
def calculate_estimates(project_id: int):
    try:
        results = calculate_project_estimates(project_id)
        return results
    except Exception:
        raise HTTPException(status_code=500, detail="Không thể tính dự toán dự án.")

@app.get("/api/projects/{project_id}/export", dependencies=[Depends(get_current_user)])
def export_estimates(project_id: int):
    # We will locate the template file in the workspace
    template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "BAO GIA-NHOM KINH NOVA EC.xlsx"))
    output_filename = f"BAO_GIA_DU_AN_{project_id}.xlsx"

    if not os.path.exists(template_path):
        raise HTTPException(status_code=500, detail="Excel template file BAO GIA-NHOM KINH NOVA EC.xlsx not found in workspace.")

    temp_dir = tempfile.mkdtemp(prefix=f"quote_{project_id}_", dir=UPLOAD_DIR)
    output_path = os.path.join(temp_dir, output_filename)

    try:
        success = generate_excel_report(project_id, template_path, output_path)
        if success:
            return FileResponse(
                path=output_path, 
                filename=output_filename, 
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                background=BackgroundTask(shutil.rmtree, temp_dir, True),
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to generate report.")
    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Không thể xuất báo giá.")

@app.get("/api/projects/{project_id}/export-split", dependencies=[Depends(get_current_user)])
def export_estimates_split(project_id: int):
    """
    Export the project's report as two separate attachment files per the
    business requirement: File 1 = "Tổng hợp chi phí" (CPHoanThien), File 2 =
    "Báo giá" (DETAIL). Both files are returned inside a single zip so the
    client can save/forward them as two independent Excel attachments.
    """
    template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "BAO GIA-NHOM KINH NOVA EC.xlsx"))
    if not os.path.exists(template_path):
        raise HTTPException(status_code=500, detail="Excel template file BAO GIA-NHOM KINH NOVA EC.xlsx not found in workspace.")

    zip_filename = f"BAO_GIA_DU_AN_{project_id}_SPLIT.zip"
    cost_filename = f"TongHopChiPhi_DuAn_{project_id}.xlsx"
    quote_filename = f"BaoGia_DuAn_{project_id}.xlsx"

    temp_dir = tempfile.mkdtemp(prefix=f"quote_split_{project_id}_", dir=UPLOAD_DIR)
    zip_path = os.path.join(temp_dir, zip_filename)

    try:
        cost_wb, quote_wb = generate_excel_report(project_id, template_path, None, split_output=True)
        if not cost_wb or not quote_wb:
            raise HTTPException(status_code=400, detail="Dự án chưa có dữ liệu để xuất báo cáo.")

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            cost_buf = BytesIO()
            cost_wb.save(cost_buf)
            zf.writestr(cost_filename, cost_buf.getvalue())

            quote_buf = BytesIO()
            quote_wb.save(quote_buf)
            zf.writestr(quote_filename, quote_buf.getvalue())

        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type="application/zip",
            background=BackgroundTask(shutil.rmtree, temp_dir, True),
        )
    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Không thể xuất báo cáo tách file.")

class QuoteVersionCreate(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)

class QuoteVersionStatusUpdate(BaseModel):
    status: Literal["draft", "approved", "sent", "accepted", "cancelled"]

QUOTE_STATUS_TRANSITIONS = {
    "draft": {"approved", "cancelled"},
    "approved": {"sent", "cancelled"},
    "sent": {"accepted", "cancelled"},
    "accepted": set(),
    "cancelled": set(),
}

@app.get("/api/projects/{project_id}/quote-versions")
def list_quote_versions(project_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT id, project_id, version_number, status, note, total_area, total_cost,
               total_price, report_filename, pdf_filename, created_by_name, created_at,
               updated_by_name, updated_at, approved_by_name, approved_at,
               sent_by_name, sent_at, accepted_by_name, accepted_at
        FROM quote_versions
        WHERE project_id = %s
        ORDER BY version_number DESC
        """, (project_id,))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()

@app.post("/api/projects/{project_id}/quote-versions")
def create_quote_version(
    project_id: int,
    request: QuoteVersionCreate,
    current_user: dict = Depends(allow_editor_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    temp_dir = None
    try:
        cursor.execute("SELECT id, name FROM projects WHERE id = %s", (project_id,))
        project = cursor.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")

        results = calculate_project_estimates(project_id)
        if not results:
            raise HTTPException(status_code=400, detail="Dự án chưa có dữ liệu để phát hành báo giá.")

        total_area = sum(float(item.get("total_area") or 0) for item in results)
        total_cost = sum(float(item.get("total_cost") or 0) for item in results)
        total_price = sum(float(item.get("total_price") or 0) for item in results)

        cursor.execute("SELECT pg_advisory_xact_lock(%s)", (project_id,))
        cursor.execute(
            "SELECT COALESCE(MAX(version_number), 0) + 1 FROM quote_versions WHERE project_id = %s",
            (project_id,),
        )
        version_number = cursor.fetchone()[0]

        template_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "BAO GIA-NHOM KINH NOVA EC.xlsx"
        ))
        report_filename = f"BAO_GIA_{project_id}_V{version_number}.xlsx"
        pdf_filename = f"BAO_GIA_{project_id}_V{version_number}.pdf"
        report_bytes = None
        if os.path.exists(template_path):
            temp_dir = tempfile.mkdtemp(prefix=f"quote_version_{project_id}_", dir=UPLOAD_DIR)
            report_path = os.path.join(temp_dir, report_filename)
            if generate_excel_report(project_id, template_path, report_path):
                with open(report_path, "rb") as report:
                    report_bytes = report.read()
        pdf_bytes = generate_quote_pdf_bytes(project["name"], version_number, results)

        cursor.execute("""
        INSERT INTO quote_versions (
            project_id, version_number, status, note, snapshot_json, total_area,
            total_cost, total_price, report_filename, report_file,
            pdf_filename, pdf_file, created_by, created_by_name, updated_by, updated_by_name
        ) VALUES (%s, %s, 'draft', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, version_number, status, created_at
        """, (
            project_id, version_number, request.note, Json(jsonable_encoder(results)),
            total_area, total_cost, total_price, report_filename if report_bytes else None,
            report_bytes, pdf_filename, pdf_bytes, current_user["id"], current_user["name"],
            current_user["id"], current_user["name"],
        ))
        created = dict(cursor.fetchone())
        conn.commit()
        return created
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể tạo phiên bản báo giá.")
    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)
        cursor.close()
        conn.close()

@app.patch("/api/projects/{project_id}/quote-versions/{version_id}/status")
def update_quote_version_status(
    project_id: int,
    version_id: int,
    request: QuoteVersionStatusUpdate,
    current_user: dict = Depends(allow_editor_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT status FROM quote_versions WHERE id = %s AND project_id = %s FOR UPDATE",
            (version_id, project_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên bản báo giá.")
        current_status = row[0]
        if request.status == current_status:
            return {"id": version_id, "status": current_status}
        if request.status not in QUOTE_STATUS_TRANSITIONS.get(current_status, set()):
            raise HTTPException(
                status_code=400,
                detail=f"Không thể chuyển trạng thái từ {current_status} sang {request.status}.",
            )
        milestone_columns = {
            "approved": ("approved_by", "approved_by_name", "approved_at"),
            "sent": ("sent_by", "sent_by_name", "sent_at"),
            "accepted": ("accepted_by", "accepted_by_name", "accepted_at"),
        }
        milestone = milestone_columns.get(request.status)
        if milestone:
            cursor.execute(f"""
            UPDATE quote_versions
            SET status = %s, updated_by = %s, updated_by_name = %s, updated_at = NOW(),
                {milestone[0]} = %s, {milestone[1]} = %s, {milestone[2]} = NOW()
            WHERE id = %s
            """, (
                request.status, current_user["id"], current_user["name"],
                current_user["id"], current_user["name"], version_id,
            ))
        else:
            cursor.execute("""
            UPDATE quote_versions
            SET status = %s, updated_by = %s, updated_by_name = %s, updated_at = NOW()
            WHERE id = %s
            """, (request.status, current_user["id"], current_user["name"], version_id))
        conn.commit()
        return {"id": version_id, "status": request.status}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể cập nhật trạng thái báo giá.")
    finally:
        cursor.close()
        conn.close()

@app.post("/api/projects/{project_id}/quote-versions/{version_id}/restore")
def restore_quote_version_as_draft(
    project_id: int,
    version_id: int,
    current_user: dict = Depends(allow_editor_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT version_number, snapshot_json, total_area, total_cost, total_price,
               report_file, pdf_file
        FROM quote_versions WHERE id = %s AND project_id = %s
        """, (version_id, project_id))
        source = cursor.fetchone()
        if not source:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên bản báo giá.")
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", (project_id,))
        cursor.execute(
            "SELECT COALESCE(MAX(version_number), 0) + 1 FROM quote_versions WHERE project_id = %s",
            (project_id,),
        )
        new_version = cursor.fetchone()[0]
        cursor.execute("""
        INSERT INTO quote_versions (
            project_id, version_number, status, note, snapshot_json, total_area,
            total_cost, total_price, report_filename, report_file, pdf_filename,
            pdf_file, created_by, created_by_name, updated_by, updated_by_name
        ) VALUES (%s, %s, 'draft', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, version_number, status, created_at
        """, (
            project_id, new_version, f"Khôi phục từ V{source[0]}", Json(source[1]),
            source[2], source[3], source[4], f"BAO_GIA_{project_id}_V{new_version}.xlsx",
            source[5], f"BAO_GIA_{project_id}_V{new_version}.pdf", source[6],
            current_user["id"], current_user["name"], current_user["id"], current_user["name"],
        ))
        restored = dict(cursor.fetchone())
        conn.commit()
        return restored
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể khôi phục phiên bản báo giá.")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/projects/{project_id}/quote-versions/{version_id}/download")
def download_quote_version(
    project_id: int,
    version_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT report_filename, report_file
        FROM quote_versions
        WHERE id = %s AND project_id = %s
        """, (version_id, project_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên bản báo giá.")
        if not row[1]:
            raise HTTPException(status_code=404, detail="Phiên bản này không có tệp Excel lưu kèm.")
        filename = row[0] or f"BAO_GIA_{project_id}_V{version_id}.xlsx"
        return Response(
            content=bytes(row[1]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        cursor.close()
        conn.close()

@app.get("/api/projects/{project_id}/quote-versions/{version_id}/download-pdf")
def download_quote_version_pdf(
    project_id: int,
    version_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT pdf_filename, pdf_file FROM quote_versions
        WHERE id = %s AND project_id = %s
        """, (version_id, project_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên bản báo giá.")
        if not row[1]:
            raise HTTPException(status_code=404, detail="Phiên bản này không có tệp PDF lưu kèm.")
        filename = row[0] or f"BAO_GIA_{project_id}_V{version_id}.pdf"
        return Response(
            content=bytes(row[1]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        cursor.close()
        conn.close()

@app.get("/api/projects/{project_id}/quote-versions/compare")
def compare_quote_versions(
    project_id: int,
    left_id: int,
    right_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT id, version_number, status, total_area, total_cost, total_price
        FROM quote_versions
        WHERE project_id = %s AND id IN (%s, %s)
        ORDER BY version_number
        """, (project_id, left_id, right_id))
        versions = [dict(row) for row in cursor.fetchall()]
        if len(versions) != 2:
            raise HTTPException(status_code=404, detail="Không tìm thấy đủ hai phiên bản để so sánh.")
        left = next(version for version in versions if version["id"] == left_id)
        right = next(version for version in versions if version["id"] == right_id)
        return {
            "left": left,
            "right": right,
            "delta": {
                "total_area": float(right["total_area"] - left["total_area"]),
                "total_cost": float(right["total_cost"] - left["total_cost"]),
                "total_price": float(right["total_price"] - left["total_price"]),
            },
        }
    finally:
        cursor.close()
        conn.close()

# --- User Auth & Admin Endpoints ---

class UserLogin(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)

class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=100, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    role: Literal["admin", "editor", "viewer"] = "viewer"

class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    role: Literal["admin", "editor", "viewer"]
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

@app.get("/api/auth/setup-status")
def get_setup_status():
    """Return whether the first administrator still needs to be created."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT EXISTS(SELECT 1 FROM users LIMIT 1)")
        return {"needs_initial_admin": not bool(cursor.fetchone()[0])}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/auth/register-init")
def register_initial_admin(user: UserRegister):
    """Register the first user as admin if the users table is empty"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        if count > 0:
            raise HTTPException(
                status_code=400, 
                detail="Hệ thống đã có người dùng. Vui lòng đăng nhập với tài khoản Admin để tạo tài khoản mới."
            )
        
        hashed = hash_password(user.password)
        cursor.execute(
            "INSERT INTO users (username, password_hash, name, role) VALUES (%s, %s, %s, 'admin') RETURNING id",
            (user.username.strip(), hashed, user.name.strip())
        )
        conn.commit()
        return {"message": "Đăng ký tài khoản Admin đầu tiên thành công."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể khởi tạo tài khoản quản trị.")
    finally:
        cursor.close()
        conn.close()

@app.post("/api/auth/login")
def login(user: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM users WHERE username = %s", (user.username.strip(),))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Tài khoản hoặc mật khẩu không chính xác.")
        
        db_user = dict(row)
        if not verify_password(user.password, db_user["password_hash"]):
            raise HTTPException(status_code=401, detail="Tài khoản hoặc mật khẩu không chính xác.")
            
        token = create_jwt({"sub": db_user["username"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "username": db_user["username"],
                "name": db_user["name"],
                "role": db_user["role"]
            }
        }
    finally:
        cursor.close()
        conn.close()

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# Admin user management endpoints
@app.get("/api/admin/users")
def list_users(current_user: dict = Depends(allow_admin_only)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

@app.post("/api/admin/users")
def create_user(user: UserRegister, current_user: dict = Depends(allow_admin_only)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE username = %s", (user.username.strip(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Tên tài khoản đã tồn tại trên hệ thống.")
            
        hashed = hash_password(user.password)
        cursor.execute(
            "INSERT INTO users (username, password_hash, name, role) VALUES (%s, %s, %s, %s) RETURNING id",
            (user.username.strip(), hashed, user.name.strip(), user.role)
        )
        conn.commit()
        return {"message": "Tạo người dùng mới thành công."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể tạo người dùng.")
    finally:
        cursor.close()
        conn.close()

@app.put("/api/admin/users/{user_id}")
def update_user(user_id: int, user: UserUpdate, current_user: dict = Depends(allow_admin_only)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if user.password:
            hashed = hash_password(user.password)
            cursor.execute(
                "UPDATE users SET name = %s, role = %s, password_hash = %s WHERE id = %s",
                (user.name.strip(), user.role, hashed, user_id)
            )
        else:
            cursor.execute(
                "UPDATE users SET name = %s, role = %s WHERE id = %s",
                (user.name.strip(), user.role, user_id)
            )
        conn.commit()
        return {"message": "Cập nhật tài khoản thành công."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, current_user: dict = Depends(allow_admin_only)):
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa tài khoản của chính mình.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return {"message": "Xóa tài khoản thành công."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        cursor.close()
        conn.close()
# --- Price Books API Endpoints ---

class PriceBookCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None

class PriceBookItemUpdate(BaseModel):
    material_code: str = Field(min_length=1, max_length=100)
    price: float = Field(ge=0)

class PriceBookItemUpdateList(BaseModel):
    items: List[PriceBookItemUpdate]

@app.get("/api/price-books", dependencies=[Depends(get_current_user)])
def get_price_books():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM price_books ORDER BY name")
        books = [dict(row) for row in cursor.fetchall()]
        return books
    finally:
        conn.close()

@app.post("/api/price-books")
def create_price_book(book: PriceBookCreate, current_user: dict = Depends(allow_editor_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO price_books (name, description) VALUES (%s, %s) RETURNING id", (book.name.strip(), book.description))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": new_id, "name": book.name, "description": book.description}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.get("/api/price-books/{pb_id}/items", dependencies=[Depends(get_current_user)])
def get_price_book_items(pb_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT m.code, m.name, m.category, m.unit, m.default_price, pb.price as book_price
        FROM materials m
        LEFT JOIN material_price_book_items pb ON m.code = pb.material_code AND pb.price_book_id = %s
        ORDER BY m.category, m.code
        """, (pb_id,))
        items = [dict(row) for row in cursor.fetchall()]
        return items
    finally:
        conn.close()

@app.put("/api/price-books/{pb_id}/items")
def update_price_book_items(pb_id: int, request: PriceBookItemUpdateList, current_user: dict = Depends(allow_editor_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for item in request.items:
            cursor.execute("""
            SELECT m.id, pbi.price
            FROM materials m
            LEFT JOIN material_price_book_items pbi
              ON pbi.material_code = m.code AND pbi.price_book_id = %s
            WHERE m.code = %s
            """, (pb_id, item.material_code))
            existing = cursor.fetchone()
            if not existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Mã vật tư không tồn tại: {item.material_code}",
                )
            cursor.execute("""
            INSERT INTO material_price_book_items (price_book_id, material_code, price)
            VALUES (%s, %s, %s)
            ON CONFLICT (price_book_id, material_code) DO UPDATE SET price = EXCLUDED.price
            """, (pb_id, item.material_code, item.price))
            old_price = existing[1]
            if old_price is None or float(old_price) != float(item.price):
                cursor.execute("""
                INSERT INTO material_price_history
                    (material_id, material_code, scope, price_book_id, old_price,
                     new_price, changed_by, changed_by_name)
                VALUES (%s, %s, 'price_book', %s, %s, %s, %s, %s)
                """, (
                    existing[0], item.material_code, pb_id, old_price, item.price,
                    current_user["id"], current_user["name"],
                ))
        conn.commit()
        return {"message": "Cập nhật đơn giá hệ thống thành công."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể cập nhật hệ đơn giá.")
    finally:
        conn.close()

# --- Indirect Cost Configs & Selections Pydantic Models ---
class ProjectIndirectCostSelection(BaseModel):
    cost_type: str = Field(min_length=1, max_length=100)
    indirect_cost_config_id: Optional[int] = Field(default=None, gt=0)
    custom_value: Optional[float] = Field(default=None, ge=0)

class ProjectIndirectCostSelectionsUpdate(BaseModel):
    selections: List[ProjectIndirectCostSelection]

class DoorOverridesUpdate(BaseModel):
    description: Optional[str] = None
    override_transport_cost: Optional[float] = Field(default=None, ge=0)
    override_installation_cost: Optional[float] = Field(default=None, ge=0)
    override_labor_cost: Optional[float] = Field(default=None, ge=0)
    price_per_m2: Optional[float] = Field(default=None, ge=0)

class DoorPriceUpdate(BaseModel):
    door_id: int = Field(gt=0)
    price_per_m2: float = Field(ge=0)

class ProfitBalancerUpdate(BaseModel):
    target_profit_margin: float = Field(ge=0, le=200)
    target_total_price: float = Field(ge=0)
    door_prices: List[DoorPriceUpdate]

# --- Indirect Cost Configs & Selections Endpoints ---

@app.get("/api/indirect-cost-configs", dependencies=[Depends(get_current_user)])
def get_indirect_cost_configs():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM indirect_cost_configs ORDER BY cost_type, id")
        configs = [dict(row) for row in cursor.fetchall()]
        return configs
    finally:
        conn.close()

@app.get("/api/projects/{project_id}/indirect-costs", dependencies=[Depends(get_current_user)])
def get_project_indirect_costs(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM project_indirect_cost_selections WHERE project_id = %s", (project_id,))
        selections = [dict(row) for row in cursor.fetchall()]
        return selections
    finally:
        conn.close()

@app.put("/api/projects/{project_id}/indirect-costs")
def update_project_indirect_costs(project_id: int, request: ProjectIndirectCostSelectionsUpdate, current_user: dict = Depends(allow_editor_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for sel in request.selections:
            cursor.execute("""
            INSERT INTO project_indirect_cost_selections (project_id, cost_type, indirect_cost_config_id, custom_value)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (project_id, cost_type) 
            DO UPDATE SET 
                indirect_cost_config_id = EXCLUDED.indirect_cost_config_id,
                custom_value = EXCLUDED.custom_value
            """, (project_id, sel.cost_type, sel.indirect_cost_config_id, sel.custom_value))
        conn.commit()
        return {"message": "Cập nhật định mức chi phí gián tiếp thành công."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.put("/api/projects/{project_id}/doors/{door_id}/overrides")
def update_door_overrides(project_id: int, door_id: int, overrides: DoorOverridesUpdate, current_user: dict = Depends(allow_editor_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        UPDATE project_doors
        SET description = %s,
            override_transport_cost = %s,
            override_installation_cost = %s,
            override_labor_cost = %s,
            price_per_m2 = %s
        WHERE id = %s AND project_id = %s
        """, (
            overrides.description,
            overrides.override_transport_cost,
            overrides.override_installation_cost,
            overrides.override_labor_cost,
            overrides.price_per_m2,
            door_id,
            project_id
        ))
        conn.commit()
        return {"message": "Cập nhật ghi chú và chi phí đè của bộ cửa thành công."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.put("/api/projects/{project_id}/profit-balancer")
def update_profit_balancer(project_id: int, data: ProfitBalancerUpdate, current_user: dict = Depends(allow_editor_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Update project target profit margin and target total price
        cursor.execute("""
        UPDATE projects
        SET target_profit_margin = %s,
            target_total_price = %s
        WHERE id = %s
        """, (data.target_profit_margin, data.target_total_price, project_id))
        
        # Update price_per_m2 for each door
        for dp in data.door_prices:
            cursor.execute("""
            UPDATE project_doors
            SET price_per_m2 = %s
            WHERE id = %s AND project_id = %s
            """, (dp.price_per_m2, dp.door_id, project_id))
            
        conn.commit()
        return {"message": "Cân đối và lưu lợi nhuận thành công."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.post("/api/aluminum-order/consolidate", dependencies=[Depends(get_current_user)])
async def consolidate_aluminum(files: List[UploadFile] = File(...), preview: bool = False):
    if not files:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất một file Excel.")
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Mỗi lần chỉ được gộp tối đa 20 file.")

    temp_dir = tempfile.mkdtemp(prefix="consolidation_", dir=UPLOAD_DIR)
    keep_temp_for_response = False
    file_info_list = []
    
    try:
        for index, f in enumerate(files):
            original_name = safe_upload_name(f.filename)
            file_ext = os.path.splitext(original_name)[1].lower()
            if file_ext not in ['.xls', '.xlsx']:
                continue
            
            # Save upload file
            temp_file_path = os.path.join(temp_dir, f"{index:02d}_{original_name}")
            await save_upload_with_limit(f, temp_file_path)
                
            file_info_list.append({
                'path': temp_file_path,
                'original_name': original_name
            })
            
        if not file_info_list:
            raise HTTPException(status_code=400, detail="Không có file Excel (.xls, .xlsx) hợp lệ nào được tải lên.")
            
        output_filename = "TONG_HOP_DAT_HANG_NHOM.xlsx"
        output_path = os.path.join(temp_dir, output_filename)
        
        # Import and run consolidation
        from estimator import consolidate_aluminum_orders
        success, items = consolidate_aluminum_orders(file_info_list, output_path)
        
        if success:
            if preview:
                total_pieces = sum(item['pieces'] for item in items)
                total_weight = sum((item['pieces'] * item['length'] / 1000.0 * item['unit_weight']) if item['unit_weight'] > 0 else 0.0 for item in items)
                
                serializable_items = []
                for item in items:
                    serializable_items.append({
                        'code': item['code'],
                        'length': item['length'],
                        'color': item['color'],
                        'description': item['description'],
                        'pieces': item['pieces'],
                        'unit_weight': item['unit_weight'],
                        'total_weight': (item['pieces'] * item['length'] / 1000.0 * item['unit_weight']) if item['unit_weight'] > 0 else 0.0,
                        'sources': item['sources']
                    })
                
                return {
                    "summary": {
                        "total_unique_codes": len(set(item['code'] for item in items)),
                        "total_pieces": total_pieces,
                        "total_weight": total_weight
                    },
                    "items": serializable_items
                }
            else:
                keep_temp_for_response = True
                return FileResponse(
                    path=output_path,
                    filename=output_filename,
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    background=BackgroundTask(shutil.rmtree, temp_dir, True),
                )
        else:
            raise HTTPException(status_code=500, detail="Không tìm thấy dữ liệu nhôm profile hợp lệ trong các file đã tải lên.")
            
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi gộp đặt hàng.")
    finally:
        if not keep_temp_for_response:
            shutil.rmtree(temp_dir, ignore_errors=True)

class OperaMaterialPriceUpdate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    unit_price: float = Field(ge=0)
    mapped_material_id: Optional[int] = Field(default=None, gt=0)

class OperaMaterialPriceUpdateList(BaseModel):
    materials: List[OperaMaterialPriceUpdate]

@app.post("/api/projects/{project_id}/import-opera/preview")
async def preview_opera_bom(
    project_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(allow_editor_admin),
):
    original_name = safe_upload_name(file.filename)
    file_ext = os.path.splitext(original_name)[1].lower()
    if file_ext not in [".xls", ".xlsx", ".xml"]:
        raise HTTPException(status_code=400, detail="Bản xem trước hỗ trợ file .xls, .xlsx hoặc .xml.")

    temp_dir = tempfile.mkdtemp(prefix="opera_preview_", dir=UPLOAD_DIR)
    temp_file_path = os.path.join(temp_dir, original_name)
    conn = None
    cursor = None
    try:
        await save_upload_with_limit(file, temp_file_path)
        if file_ext == ".xml":
            doors, rows = parse_opera_xml_bom(temp_file_path)
            if not doors or not rows:
                return {
                    "valid": False,
                    "filename": original_name,
                    "total_rows": len(rows),
                    "missing_columns": [],
                    "errors": [{"row": 0, "issues": ["Không tìm thấy component hoặc material hợp lệ trong XML"]}],
                }
            codes = {row["code"] for row in rows}
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT code FROM materials")
            catalog_codes = {str(row[0]).strip().lower() for row in cursor.fetchall()}
            unmapped_codes = sorted(code for code in codes if code.lower() not in catalog_codes)
            unit_counts = {}
            for row in rows:
                unit_counts[row["unit"]] = unit_counts.get(row["unit"], 0) + 1
            return {
                "valid": True,
                "filename": original_name,
                "total_rows": len(rows),
                "valid_rows": len(rows),
                "invalid_rows": 0,
                "unique_typologies": len({door["typology"] for door in doors}),
                "unique_materials": len(codes),
                "unit_counts": unit_counts,
                "unrecognized_units": sorted(unit for unit in unit_counts if unit.lower() not in {"m", "mm", "m2", "m²", "pc", "pcs", "piece", "set", "kg"}),
                "unmapped_codes": unmapped_codes[:200],
                "unmapped_count": len(unmapped_codes),
                "missing_columns": [],
                "errors": [],
            }
        engine = "xlrd" if file_ext == ".xls" else "openpyxl"
        df = pd.read_excel(temp_file_path, engine=engine)
        col_map = {str(column).strip().lower(): column for column in df.columns}
        column_keys = {
            "typology": col_map.get("typology name") or col_map.get("typology"),
            "code": col_map.get("code"),
            "quantity": col_map.get("quantity") or col_map.get("qty"),
            "unit": col_map.get("quantityunit") or col_map.get("unit"),
        }
        missing_columns = [name for name, key in column_keys.items() if key is None]
        if missing_columns:
            return {
                "valid": False,
                "filename": original_name,
                "total_rows": len(df.index),
                "missing_columns": missing_columns,
                "errors": [],
            }

        errors = []
        valid_rows = 0
        codes = set()
        typologies = set()
        unit_counts = {}
        for index, row in df.iterrows():
            row_errors = []
            typology = row[column_keys["typology"]]
            code = row[column_keys["code"]]
            quantity = row[column_keys["quantity"]]
            unit = row[column_keys["unit"]]
            if pd.isna(typology) or not str(typology).strip(): row_errors.append("Thiếu typology")
            if pd.isna(code) or not str(code).strip(): row_errors.append("Thiếu mã vật tư")
            if pd.isna(unit) or not str(unit).strip(): row_errors.append("Thiếu đơn vị")
            try:
                if pd.isna(quantity) or float(quantity) <= 0: row_errors.append("Số lượng phải lớn hơn 0")
            except (TypeError, ValueError):
                row_errors.append("Số lượng không hợp lệ")
            if row_errors:
                if len(errors) < 100:
                    errors.append({"row": int(index) + 2, "issues": row_errors})
                continue
            valid_rows += 1
            codes.add(str(code).strip())
            typologies.add(str(typology).strip())
            unit_name = str(unit).strip()
            unit_counts[unit_name] = unit_counts.get(unit_name, 0) + 1

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT code FROM materials")
        catalog_codes = {str(row[0]).strip().lower() for row in cursor.fetchall()}
        unmapped_codes = sorted(code for code in codes if code.lower() not in catalog_codes)
        return {
            "valid": valid_rows > 0 and not errors,
            "filename": original_name,
            "total_rows": len(df.index),
            "valid_rows": valid_rows,
            "invalid_rows": len(df.index) - valid_rows,
            "unique_typologies": len(typologies),
            "unique_materials": len(codes),
            "unit_counts": unit_counts,
            "unrecognized_units": sorted(unit for unit in unit_counts if unit.lower() not in {"m", "mm", "m2", "m²", "pc", "pcs", "piece", "set", "kg"}),
            "unmapped_codes": unmapped_codes[:200],
            "unmapped_count": len(unmapped_codes),
            "missing_columns": [],
            "errors": errors,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Không thể đọc cấu trúc file Opera.")
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.get("/api/projects/{project_id}/data-quality")
def get_project_data_quality(project_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT DISTINCT pom.code
        FROM project_opera_materials pom
        LEFT JOIN materials m ON m.id = pom.mapped_material_id
        WHERE pom.project_id = %s AND m.id IS NULL
        ORDER BY pom.code LIMIT 100
        """, (project_id,))
        unmapped = [row[0] for row in cursor.fetchall()]
        cursor.execute("""
        SELECT DISTINCT code FROM project_opera_materials
        WHERE project_id = %s AND COALESCE(unit_price, 0) <= 0
        ORDER BY code LIMIT 100
        """, (project_id,))
        missing_prices = [row[0] for row in cursor.fetchall()]
        cursor.execute("""
        SELECT id, code FROM project_doors
        WHERE project_id = %s AND (width <= 0 OR height <= 0 OR qty <= 0)
        ORDER BY id LIMIT 100
        """, (project_id,))
        invalid_doors = [dict(row) for row in cursor.fetchall()]
        cursor.execute("""
        SELECT DISTINCT quantity_unit FROM project_opera_materials
        WHERE project_id = %s
          AND LOWER(TRIM(quantity_unit)) NOT IN ('m', 'mm', 'm2', 'm²', 'pc', 'pcs', 'piece', 'set', 'kg')
        ORDER BY quantity_unit LIMIT 100
        """, (project_id,))
        unrecognized_units = [row[0] for row in cursor.fetchall()]
        return {
            "healthy": not unmapped and not missing_prices and not invalid_doors and not unrecognized_units,
            "unmapped_materials": unmapped,
            "missing_prices": missing_prices,
            "invalid_doors": invalid_doors,
            "unrecognized_units": unrecognized_units,
            "issue_count": len(unmapped) + len(missing_prices) + len(invalid_doors) + len(unrecognized_units),
        }
    finally:
        cursor.close()
        conn.close()

@app.post("/api/projects/{project_id}/import-opera", dependencies=[Depends(allow_editor_admin)])
async def import_opera_bom(project_id: int, file: UploadFile = File(...)):
    original_name = safe_upload_name(file.filename)
    file_ext = os.path.splitext(original_name)[1].lower()
    if file_ext not in ['.xls', '.xlsx', '.xml']:
        raise HTTPException(status_code=400, detail="Vui lòng tải lên file Opera (.xls, .xlsx hoặc .xml).")

    temp_dir = tempfile.mkdtemp(prefix="opera_import_", dir=UPLOAD_DIR)
    temp_file_path = os.path.join(temp_dir, original_name)
    conn = None
    cursor = None
    
    try:
        await save_upload_with_limit(file, temp_file_path)
        conn = get_db_connection()
        cursor = conn.cursor()

        if file_ext == '.xml':
            doors, xml_rows = parse_opera_xml_bom(temp_file_path)
            if not doors or not xml_rows:
                raise HTTPException(status_code=400, detail="XML không chứa component và vật tư Opera hợp lệ.")
            cursor.execute("SELECT id FROM projects WHERE id = %s", (project_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
            cursor.execute("DELETE FROM project_opera_materials WHERE project_id = %s", (project_id,))
            cursor.execute("DELETE FROM project_doors WHERE project_id = %s", (project_id,))
            cursor.execute("SELECT id, code FROM templates ORDER BY id")
            template_rows = cursor.fetchall()
            template_map = {row['code'].strip().lower(): row['id'] for row in template_rows}
            if not template_rows:
                raise HTTPException(status_code=400, detail="Hệ thống chưa có mẫu cửa để ánh xạ dữ liệu Opera.")
            default_template_id = template_rows[0]['id']
            for door in doors:
                template_id = template_map.get(door["typology"].lower(), default_template_id)
                cursor.execute("""
                INSERT INTO project_doors (project_id, code, template_id, width, height, qty, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    project_id, door["code"], template_id, door["width"], door["height"],
                    door["qty"], door["description"],
                ))
            cursor.execute("SELECT id, code, default_price FROM materials")
            catalog_items = {str(row['code']).strip().lower(): (row['id'], row['default_price']) for row in cursor.fetchall()}
            for row in xml_rows:
                catalog_id, catalog_price = catalog_items.get(row["code"].lower(), (None, None))
                cursor.execute("""
                INSERT INTO project_opera_materials (
                    project_id, typology_name, code, name, description, quantity,
                    quantity_unit, unit_weight, color, width, height, unit_price, mapped_material_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    project_id, row["typology"], row["code"], row["name"], row["description"],
                    row["quantity"], row["unit"], row["unit_weight"], row["color"], row["width"],
                    row["height"], catalog_price if catalog_price is not None else row["unit_price"], catalog_id,
                ))
            cursor.execute("UPDATE projects SET has_opera_bom = TRUE WHERE id = %s", (project_id,))
            conn.commit()
            return {
                "message": "Đã nhập định mức Opera XML thành công!",
                "doors_imported": len(doors),
                "materials_imported": len(xml_rows),
            }
            
        # Read Excel using pandas
        if file_ext == '.xls':
            df = pd.read_excel(temp_file_path, engine='xlrd')
        else:
            df = pd.read_excel(temp_file_path, engine='openpyxl')
            
        # Normalize column names to lowercase and strip whitespace
        col_map = {str(col).strip().lower(): col for col in df.columns}
        
        # Required columns
        typology_key = col_map.get('typology name') or col_map.get('typology')
        code_key = col_map.get('code')
        desc_key = col_map.get('description') or col_map.get('desc')
        qty_key = col_map.get('quantity') or col_map.get('qty')
        unit_key = col_map.get('quantityunit') or col_map.get('unit')
        
        if not all([typology_key, code_key, qty_key, unit_key]):
            raise HTTPException(
                status_code=400, 
                detail="File Excel không đúng cấu trúc Opera. Cần có các cột: 'Typology Name', 'Code', 'Quantity', 'QuantityUnit'."
            )

        invalid_rows = []
        for idx, row in df.iterrows():
            required_values = [row[typology_key], row[code_key], row[qty_key], row[unit_key]]
            if any(pd.isna(value) or not str(value).strip() for value in required_values):
                invalid_rows.append(int(idx) + 2)
                continue
            try:
                if float(row[qty_key]) <= 0:
                    invalid_rows.append(int(idx) + 2)
            except (TypeError, ValueError):
                invalid_rows.append(int(idx) + 2)
        if invalid_rows:
            sample = ", ".join(str(row_number) for row_number in invalid_rows[:10])
            raise HTTPException(
                status_code=400,
                detail=f"File có {len(invalid_rows)} dòng không hợp lệ (ví dụ: {sample}). Hãy sửa file trước khi nhập.",
            )
            
        # Optional columns
        name_key = col_map.get('name')
        weight_key = col_map.get('unit weight') or col_map.get('weight')
        color_key = col_map.get('color')
        width_key = col_map.get('width')
        height_key = col_map.get('height')

        cursor.execute("SELECT id FROM projects WHERE id = %s", (project_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
        
        # 1. Clear existing Opera data for this project
        cursor.execute("DELETE FROM project_opera_materials WHERE project_id = %s", (project_id,))
        cursor.execute("DELETE FROM project_doors WHERE project_id = %s", (project_id,))
        
        # 2. Extract unique typologies & create project doors
        cursor.execute("SELECT id, code FROM templates")
        template_map = {row['code'].strip().lower(): row['id'] for row in cursor.fetchall()}
        default_template_id = list(template_map.values())[0] if template_map else 1

        unique_typos = df[typology_key].dropna().unique()
        doors_created = 0
        for typo in unique_typos:
            typo_str = str(typo).strip()
            if not typo_str:
                continue
            
            # Find matching template or fallback
            matched_template_id = template_map.get(typo_str.lower(), default_template_id)
            
            # Insert into project_doors with default values
            cursor.execute("""
            INSERT INTO project_doors (project_id, code, template_id, width, height, qty)
            VALUES (%s, %s, %s, 1200, 1500, 1)
            """, (project_id, typo_str, matched_template_id))
            doors_created += 1
            
        # 3. Extract and insert materials
        materials_created = 0
        # Cache catalog materials for fast mapping
        cursor.execute("SELECT id, code, default_price FROM materials")
        catalog_items = {row['code']: (row['id'], row['default_price']) for row in cursor.fetchall()}
        
        for idx, row in df.iterrows():
            typo = row[typology_key]
            code = row[code_key]
            qty = row[qty_key]
            unit = row[unit_key]
            
            if pd.isna(typo) or pd.isna(code) or pd.isna(qty) or pd.isna(unit):
                continue
                
            typo_str = str(typo).strip()
            code_str = str(code).strip()
            qty_val = float(qty)
            unit_str = str(unit).strip()
            
            if not typo_str or not code_str or qty_val <= 0:
                continue
                
            desc_val = str(row[desc_key]).strip() if desc_key and not pd.isna(row[desc_key]) else ""
            name_val = str(row[name_key]).strip() if name_key and not pd.isna(row[name_key]) else code_str
            
            # Helper function to get float or None
            def get_float_or_none(key):
                if key and not pd.isna(row[key]):
                    try:
                        v = float(row[key])
                        return v if not math.isnan(v) else None
                    except:
                        return None
                return None
                
            weight_val = get_float_or_none(weight_key)
            width_val = get_float_or_none(width_key)
            height_val = get_float_or_none(height_key)
            color_val = str(row[color_key]).strip() if color_key and not pd.isna(row[color_key]) else None
            
            # Try to auto-map catalog price and material ID
            catalog_id = None
            catalog_price = None
            if code_str in catalog_items:
                catalog_id, catalog_price = catalog_items[code_str]
            else:
                # Fallback matching: try case-insensitive or without suffix
                clean_code = code_str.split('.')[1] if len(code_str.split('.')) > 1 else code_str
                for cat_code, (cat_id, cat_price) in catalog_items.items():
                    if clean_code in cat_code or cat_code in code_str:
                        catalog_id = cat_id
                        catalog_price = cat_price
                        break
            
            cursor.execute("""
            INSERT INTO project_opera_materials (
                project_id, typology_name, code, name, description, 
                quantity, quantity_unit, unit_weight, color, width, height, 
                unit_price, mapped_material_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                project_id, typo_str, code_str, name_val, desc_val,
                qty_val, unit_str, weight_val, color_val, width_val, height_val,
                catalog_price, catalog_id
            ))
            materials_created += 1
            
        # 4. Mark project as having Opera BOM
        cursor.execute("UPDATE projects SET has_opera_bom = TRUE WHERE id = %s", (project_id,))
        
        conn.commit()
        return {
            "message": "Đã nhập định mức Opera thành công!",
            "doors_imported": doors_created,
            "materials_imported": materials_created
        }
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail="Lỗi nhập file định mức Opera.")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.get("/api/projects/{project_id}/opera-materials", dependencies=[Depends(get_current_user)])
def get_project_opera_materials(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Get all materials, left join catalog materials for display
        cursor.execute("""
        SELECT 
            pom.*,
            m.name as catalog_name,
            m.default_price as catalog_price,
            m.category as catalog_category
        FROM project_opera_materials pom
        LEFT JOIN materials m ON pom.mapped_material_id = m.id
        WHERE pom.project_id = %s
        ORDER BY pom.typology_name, pom.quantity_unit, pom.code
        """, (project_id,))
        materials = [dict(row) for row in cursor.fetchall()]
        
        # Get list of unique materials across the entire project for bulk pricing view
        cursor.execute("""
        SELECT 
            pom.code,
            pom.name,
            pom.description,
            pom.quantity_unit,
            SUM(pom.quantity) as total_quantity,
            AVG(pom.unit_weight) as unit_weight,
            pom.color,
            pom.unit_price,
            pom.mapped_material_id,
            m.name as catalog_name,
            m.default_price as catalog_price,
            m.category as catalog_category
        FROM project_opera_materials pom
        LEFT JOIN materials m ON pom.mapped_material_id = m.id
        WHERE pom.project_id = %s
        GROUP BY pom.code, pom.name, pom.description, pom.quantity_unit, pom.color, pom.unit_price, pom.mapped_material_id, m.name, m.default_price, m.category
        ORDER BY pom.quantity_unit, pom.code
        """, (project_id,))
        summary = [dict(row) for row in cursor.fetchall()]
        
        return {
            "materials": materials,
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu.")
    finally:
        conn.close()

@app.put("/api/projects/{project_id}/opera-materials")
def update_project_opera_materials(
    project_id: int,
    request: OperaMaterialPriceUpdateList,
    current_user: dict = Depends(allow_editor_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for f in request.materials:
            cursor.execute("""
            SELECT unit_price, mapped_material_id
            FROM project_opera_materials
            WHERE project_id = %s AND code = %s
            LIMIT 1
            """, (project_id, f.code))
            existing = cursor.fetchone()
            if not existing:
                raise HTTPException(status_code=400, detail=f"Mã Opera không tồn tại: {f.code}")
            history_material_id = f.mapped_material_id or existing[1]
            history_code = f.code
            if history_material_id:
                cursor.execute("SELECT code FROM materials WHERE id = %s", (history_material_id,))
                mapped_material = cursor.fetchone()
                if mapped_material:
                    history_code = mapped_material[0]
            # Update applied unit price and mapped catalog ID for all matching codes in this project
            cursor.execute("""
            UPDATE project_opera_materials 
            SET unit_price = %s, mapped_material_id = %s
            WHERE project_id = %s AND code = %s
            """, (f.unit_price, f.mapped_material_id, project_id, f.code))
            if float(existing[0] or 0) != float(f.unit_price):
                cursor.execute("""
                INSERT INTO material_price_history
                    (material_id, material_code, scope, project_id, old_price,
                     new_price, changed_by, changed_by_name)
                VALUES (%s, %s, 'project', %s, %s, %s, %s, %s)
                """, (
                    history_material_id, history_code, project_id,
                    existing[0], f.unit_price, current_user["id"], current_user["name"],
                ))
        conn.commit()
        return {"message": "Đã cập nhật đơn giá áp dụng thành công!"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Không thể cập nhật đơn giá Opera.")
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8080, reload=True)


