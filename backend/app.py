from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import shutil
from typing import List, Optional
from pydantic import BaseModel

from database import get_db_connection
from estimator import parse_opera_file, calculate_project_estimates, generate_excel_report

app = FastAPI(title="CIC-Nova Estimation API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Pydantic models for request bodies
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DoorCreate(BaseModel):
    code: str
    template_id: int
    width: float
    height: float
    width1: Optional[float] = None
    height1: Optional[float] = None
    width2: Optional[float] = None
    height2: Optional[float] = None
    qty: int

class FormulaUpdate(BaseModel):
    id: int
    formula: str
    qty: int
    weight_per_m: float

class TemplateFormulaUpdateList(BaseModel):
    formulas: List[FormulaUpdate]

class TemplateCreate(BaseModel):
    system_id: int
    code: str
    name: str
    type: str
    accessory_brand: Optional[str] = "Draho"
    glass_type: Optional[str] = "k8cl"
    percent_aluminum: Optional[float] = 45.0
    percent_glass: Optional[float] = 10.0
    percent_accessories: Optional[float] = 20.0
    percent_labor: Optional[float] = 25.0

class ProfileFormulaUpdate(BaseModel):
    id: int
    name: str
    code: str
    dimension_type: str
    formula: str
    qty: int
    weight_per_m: float

class ProfileFormulaUpdateList(BaseModel):
    formulas: List[ProfileFormulaUpdate]

class AccessoryFormulaUpdate(BaseModel):
    id: int
    name: str
    code: str
    qty: float

class AccessoryFormulaUpdateList(BaseModel):
    accessories: List[AccessoryFormulaUpdate]

class MaterialCreate(BaseModel):
    code: str
    name: str
    category: str
    unit: str
    default_price: float
    weight_per_m: Optional[float] = 0.0

class MaterialUpdate(BaseModel):
    name: str
    category: str
    unit: str
    default_price: float
    weight_per_m: float

class TemplateUpdate(BaseModel):
    system_id: int
    code: str
    name: str
    type: str
    accessory_brand: Optional[str] = "Draho"
    glass_type: Optional[str] = "k8cl"
    percent_aluminum: Optional[float] = 45.0
    percent_glass: Optional[float] = 10.0
    percent_accessories: Optional[float] = 20.0
    percent_labor: Optional[float] = 25.0

# API Endpoints

# 1. Projects Management
@app.get("/api/projects")
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects ORDER BY created_at DESC")
    projects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return projects

@app.post("/api/projects")
def create_project(project: ProjectCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO projects (name, description) VALUES (%s, %s) RETURNING id", (project.name, project.description))
        project_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": project_id, "name": project.name, "description": project.description}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/projects/{project_id}")
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
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 2. Project Doors Management
@app.get("/api/projects/{project_id}/doors")
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

@app.post("/api/projects/{project_id}/doors")
def add_project_door(project_id: int, door: DoorCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO project_doors (project_id, code, template_id, width, height, width1, height1, width2, height2, qty)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (project_id, door.code, door.template_id, door.width, door.height, door.width1, door.height1, door.width2, door.height2, door.qty))
        door_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": door_id, "project_id": project_id, **door.dict()}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/projects/{project_id}/doors/{door_id}")
def update_project_door(project_id: int, door_id: int, door: DoorCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        UPDATE project_doors 
        SET code = %s, template_id = %s, width = %s, height = %s, 
            width1 = %s, height1 = %s, width2 = %s, height2 = %s, qty = %s
        WHERE id = %s AND project_id = %s
        """, (door.code, door.template_id, door.width, door.height, 
              door.width1, door.height1, door.width2, door.height2, door.qty, 
              door_id, project_id))
        conn.commit()
        return {"id": door_id, "project_id": project_id, **door.dict()}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/projects/{project_id}/doors/{door_id}")
def delete_project_door(project_id: int, door_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM project_doors WHERE id = %s AND project_id = %s", (door_id, project_id))
        conn.commit()
        return {"message": "Door deleted successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 3. Templates & Formulas Management
@app.get("/api/systems")
def get_systems():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM systems")
    systems = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return systems

@app.get("/api/templates")
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

@app.post("/api/templates")
def create_template(t: TemplateCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO templates (system_id, code, name, type, accessory_brand, glass_type, percent_aluminum, percent_glass, percent_accessories, percent_labor)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (t.system_id, t.code, t.name, t.type, t.accessory_brand, t.glass_type, t.percent_aluminum, t.percent_glass, t.percent_accessories, t.percent_labor))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": new_id, "message": "Template created successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/templates/{template_id}")
def update_template(template_id: int, t: TemplateUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        UPDATE templates
        SET system_id = %s, code = %s, name = %s, type = %s, accessory_brand = %s, glass_type = %s,
            percent_aluminum = %s, percent_glass = %s, percent_accessories = %s, percent_labor = %s
        WHERE id = %s
        """, (t.system_id, t.code, t.name, t.type, t.accessory_brand, t.glass_type,
              t.percent_aluminum, t.percent_glass, t.percent_accessories, t.percent_labor, template_id))
        conn.commit()
        return {"message": "Template updated successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/templates/{template_id}")
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
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/templates/{template_id}/formulas")
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

@app.post("/api/templates/{template_id}/profile-formulas")
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
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/profile-formulas/{formula_id}")
def delete_profile_formula(formula_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM profile_formulas WHERE id = %s", (formula_id,))
        conn.commit()
        return {"message": "Profile formula deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/templates/{template_id}/profile-formulas")
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
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/templates/{template_id}/accessory-formulas")
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
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/accessory-formulas/{formula_id}")
def delete_accessory_formula(formula_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM accessory_formulas WHERE id = %s", (formula_id,))
        conn.commit()
        return {"message": "Accessory formula deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/templates/{template_id}/accessory-formulas")
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
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 3.5. Materials Management
@app.get("/api/materials")
def get_materials():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM materials ORDER BY category, code")
    materials = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return materials

@app.post("/api/materials")
def create_material(m: MaterialCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (m.code, m.name, m.category, m.unit, m.default_price, m.weight_per_m))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": new_id, "message": "Material created successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/materials/{material_id}")
def update_material(material_id: int, m: MaterialUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        UPDATE materials
        SET name = %s, category = %s, unit = %s, default_price = %s, weight_per_m = %s
        WHERE id = %s
        """, (m.name, m.category, m.unit, m.default_price, m.weight_per_m, material_id))
        conn.commit()
        return {"message": "Material updated successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/materials/{material_id}")
def delete_material(material_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM materials WHERE id = %s", (material_id,))
        conn.commit()
        return {"message": "Material deleted successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 4. Import & Calculate API
@app.post("/api/projects/{project_id}/import-opera")
async def import_opera(project_id: int, file: UploadFile = File(...)):
    # Save upload file
    file_ext = os.path.splitext(file.filename)[1]
    if file_ext.lower() not in ['.xls', '.xlsx']:
        raise HTTPException(status_code=400, detail="Only Excel files (.xls, .xlsx) are supported.")
        
    temp_file_path = os.path.join(UPLOAD_DIR, f"project_{project_id}_import{file_ext}")
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Currently, parse_opera_file only supports .xls via xlrd.
        # If it is .xlsx, we might need openpyxl or warning.
        # Opera usually exports as .xls.
        records_imported = parse_opera_file(project_id, temp_file_path)
        return {"message": "Opera BOM file imported successfully", "records_imported": records_imported}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse file: {str(e)}")

@app.post("/api/projects/{project_id}/calculate")
def calculate_estimates(project_id: int):
    try:
        results = calculate_project_estimates(project_id)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")

@app.get("/api/projects/{project_id}/export")
def export_estimates(project_id: int):
    # We will locate the template file in the workspace
    template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "BAO GIA-NHOM KINH NOVA EC.xlsx"))
    output_filename = f"BAO_GIA_DU_AN_{project_id}.xlsx"
    output_path = os.path.join(UPLOAD_DIR, output_filename)
    
    if not os.path.exists(template_path):
        raise HTTPException(status_code=500, detail="Excel template file BAO GIA-NHOM KINH NOVA EC.xlsx not found in workspace.")
        
    try:
        success = generate_excel_report(project_id, template_path, output_path)
        if success:
            return FileResponse(
                path=output_path, 
                filename=output_filename, 
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to generate report.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8080, reload=True)
