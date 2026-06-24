import os
import re
import pandas as pd
import openpyxl
import xml.etree.ElementTree as ET
from copy import copy
from openpyxl.utils.dataframe import dataframe_to_rows
from database import get_db_connection

def parse_opera_file(project_id, file_path):
    """
    Parse Opera export (.xls, .xlsx, or .xml) and:
    1. Save material prices to project_material_prices.
    2. Automatically extract doors and create them in project_doors.
    3. Generate static formulas (profile & accessory formulas) for templates.
    """
    print(f"Parsing Opera file: {file_path} for Project: {project_id}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    file_ext = os.path.splitext(file_path)[1].lower()
    
    if file_ext == '.xml':
        imported_count = parse_opera_xml(project_id, file_path, cursor, conn)
    else:
        imported_count = parse_opera_excel(project_id, file_path, cursor, conn)
        
    conn.commit()
    conn.close()
    return imported_count

def parse_opera_xml(project_id, file_path, cursor, conn):
    print("Parsing Opera XML file...")
    tree = ET.parse(file_path)
    root = tree.getroot()
    
    # 1. Import material prices globally and project-specifically
    materials_inserted = 0
    unique_materials = {}
    
    for mat in root.findall(".//material"):
        code = (mat.findtext("mat_alternative_code") or mat.findtext("mat_supplier_code") or "").strip()
        name = (mat.findtext("mat_name") or mat.findtext("mat_description") or "").strip()
        unit = (mat.findtext("mat_unit") or "pc").strip()
        
        price_val = mat.findtext("mat_price")
        if not price_val:
            price_val = mat.findtext("mat_full_price")
        try:
            price = float(price_val) if price_val else 0.0
        except (ValueError, TypeError):
            price = 0.0
            
        weight_val = mat.findtext("mat_unit_weight") or mat.findtext("mat_weight")
        try:
            weight = float(weight_val) if weight_val else 0.0
        except (ValueError, TypeError):
            weight = 0.0
            
        if code and code != 'nan':
            unique_materials[code] = {
                'name': name,
                'unit': unit,
                'price': price,
                'weight': weight
            }
            
    for code, m in unique_materials.items():
        mat_category = 'other'
        if 'nhôm' in m['name'].lower() or 'khung' in m['name'].lower() or 'cánh' in m['name'].lower():
            mat_category = 'aluminum'
        elif 'kính' in m['name'].lower() or 'glass' in m['name'].lower():
            mat_category = 'glass'
        elif 'gioăng' in m['name'].lower() or 'keo' in m['name'].lower() or 'sealant' in m['name'].lower():
            mat_category = 'other'
        elif m['unit'] == 'pc':
            mat_category = 'accessory'
            
        cursor.execute("""
        INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            default_price = EXCLUDED.default_price,
            weight_per_m = EXCLUDED.weight_per_m
        """, (code, m['name'], mat_category, m['unit'], m['price'], m['weight']))
        
        cursor.execute("""
        INSERT INTO project_material_prices (project_id, material_code, material_name, unit, price, weight)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (project_id, material_code) DO UPDATE SET
            material_name = EXCLUDED.material_name,
            unit = EXCLUDED.unit,
            price = EXCLUDED.price,
            weight = EXCLUDED.weight
        """, (project_id, code, m['name'], m['unit'], m['price'], m['weight']))
        materials_inserted += 1

    # 2. Extract systems, templates, formulas and create doors
    components = root.findall(".//component")
    for comp in components:
        cmp_pos = (comp.findtext("cmp_position") or "").strip()
        cmp_name = (comp.findtext("cmp_name") or "").strip()
        cmp_system = (comp.findtext("cmp_system") or "Nova System").strip()
        
        try:
            width = float(comp.findtext("cmp_width") or 1000.0)
            height = float(comp.findtext("cmp_height") or 2000.0)
            qty = int(comp.findtext("cmp_quantity") or 1)
        except (ValueError, TypeError):
            width = 1000.0
            height = 2000.0
            qty = 1
            
        if not cmp_name:
            continue
            
        cursor.execute("SELECT id FROM systems WHERE name = %s", (cmp_system,))
        sys_row = cursor.fetchone()
        if sys_row:
            system_id = sys_row[0]
        else:
            cursor.execute("INSERT INTO systems (name) VALUES (%s) RETURNING id", (cmp_system,))
            system_id = cursor.fetchone()[0]
            
        cursor.execute("SELECT id FROM templates WHERE code = %s", (cmp_name,))
        tmpl_row = cursor.fetchone()
        
        door_type = "CỬA ĐI" if "đối" in cmp_name.lower() or "đi" in cmp_name.lower() else "CỬA SỔ"
        
        if tmpl_row:
            template_id = tmpl_row[0]
        else:
            cursor.execute("""
            INSERT INTO templates (system_id, code, name, type, accessory_brand, glass_type)
            VALUES (%s, %s, %s, %s, 'Draho', 'k8cl')
            RETURNING id
            """, (system_id, cmp_name, cmp_name, door_type))
            template_id = cursor.fetchone()[0]
            
        cursor.execute("DELETE FROM profile_formulas WHERE template_id = %s", (template_id,))
        cursor.execute("DELETE FROM accessory_formulas WHERE template_id = %s", (template_id,))
        
        comp_materials = comp.findall(".//materials/material")
        for mat in comp_materials:
            m_code = (mat.findtext("mat_alternative_code") or mat.findtext("mat_supplier_code") or "").strip()
            m_name = (mat.findtext("mat_name") or mat.findtext("mat_description") or "").strip()
            m_type = (mat.findtext("mat_type") or "").strip()
            
            try:
                m_qty = float(mat.findtext("mat_quantity") or 0.0)
                m_pieces = int(mat.findtext("mat_pieces") or 1)
            except (ValueError, TypeError):
                m_qty = 0.0
                m_pieces = 1
                
            try:
                m_unit_weight = float(mat.findtext("mat_unit_weight") or 0.0)
            except (ValueError, TypeError):
                m_unit_weight = 0.0
                
            if not m_code:
                continue
                
            qty_per_set = m_qty / qty if qty > 0 else m_qty
            
            if 'profile' in m_type.lower():
                cursor.execute("""
                INSERT INTO profile_formulas (template_id, name, code, dimension_type, formula, qty, weight_per_m)
                VALUES (%s, %s, %s, 'W', %s, %s, %s)
                """, (template_id, m_name, m_code, f"{qty_per_set:.4f}", m_pieces, m_unit_weight))
            else:
                cursor.execute("""
                INSERT INTO accessory_formulas (template_id, name, code, qty)
                VALUES (%s, %s, %s, %s)
                """, (template_id, m_name, m_code, qty_per_set))
                
        panes = comp.findall(".//cmp_panes_details/pane_details")
        for idx, pane in enumerate(panes):
            g_code = (pane.findtext("mat_name") or f"glass_{template_id}").strip()
            g_name = (pane.findtext("mat_description") or "Kính").strip()
            try:
                g_w = float(pane.findtext("mat_width") or 0.0)
                g_h = float(pane.findtext("mat_height") or 0.0)
                g_qty = float(pane.findtext("mat_quantity") or 1.0)
                area = (g_w * g_h / 1000000.0) * g_qty
            except (ValueError, TypeError):
                area = 0.0
            
            qty_per_set = area / qty if qty > 0 else area
            if qty_per_set > 0:
                cursor.execute("""
                INSERT INTO accessory_formulas (template_id, name, code, qty)
                VALUES (%s, %s, %s, %s)
                """, (template_id, g_name, g_code, qty_per_set))
                
        cursor.execute("SELECT id FROM project_doors WHERE project_id = %s AND code = %s", (project_id, cmp_pos))
        door_row = cursor.fetchone()
        if door_row:
            cursor.execute("""
            UPDATE project_doors 
            SET template_id = %s, width = %s, height = %s, qty = %s
            WHERE id = %s
            """, (template_id, width, height, qty, door_row[0]))
        else:
            cursor.execute("""
            INSERT INTO project_doors (project_id, code, template_id, width, height, qty)
            VALUES (%s, %s, %s, %s, %s, %s)
            """, (project_id, cmp_pos, template_id, width, height, qty))
            
    return materials_inserted

def parse_opera_excel(project_id, file_path, cursor, conn):
    print("Parsing Opera Excel file...")
    df = pd.read_excel(file_path, engine='xlrd')
    df.columns = [col.strip() if isinstance(col, str) else col for col in df.columns]
    
    if 'Typology Name' in df.columns:
        return parse_typologies_excel_format(project_id, df, cursor, conn)
        
    imported_count = 0
    for idx, row in df.iterrows():
        code = str(row.get('Code', '')).strip()
        name = str(row.get('Description', '')).strip()
        if not name or name == 'nan':
            name = str(row.get('Name', '')).strip()
            
        unit = str(row.get('QuantityUnit', 'pc')).strip()
        price_val = row.get('ID')
        if pd.isna(price_val) or price_val == '':
            price_val = row.get('Unit Price')
            
        unit_weight = row.get('Unit Weight')
        
        try:
            price = float(price_val) if not pd.isna(price_val) else 0.0
        except (ValueError, TypeError):
            price = 0.0
            
        try:
            weight = float(unit_weight) if not pd.isna(unit_weight) else 0.0
        except (ValueError, TypeError):
            weight = 0.0
            
        if not code or code == 'nan':
            continue
            
        cursor.execute("""
        INSERT INTO project_material_prices (project_id, material_code, material_name, unit, price, weight)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT(project_id, material_code) DO UPDATE SET
            material_name=excluded.material_name,
            unit=excluded.unit,
            price=excluded.price,
            weight=excluded.weight
        """, (project_id, code, name, unit, price, weight))
        imported_count += 1
        
    return imported_count

def parse_typologies_excel_format(project_id, df, cursor, conn):
    print("Detected ĐỊNH MỨC TYPOLOGIES Excel format...")
    unique_materials = {}
    for idx, row in df.iterrows():
        code = str(row.get('Code', '')).strip()
        name = str(row.get('Description', '')).strip()
        if not name or name == 'nan':
            name = str(row.get('Name', '')).strip()
        unit = str(row.get('QuantityUnit', 'pc')).strip()
        
        price_val = row.get('Unit Price')
        try:
            price = float(price_val) if not pd.isna(price_val) else 0.0
        except (ValueError, TypeError):
            price = 0.0
            
        weight_val = row.get('Unit Weight')
        try:
            weight = float(weight_val) if not pd.isna(weight_val) else 0.0
        except (ValueError, TypeError):
            weight = 0.0
            
        if code and code != 'nan':
            unique_materials[code] = {
                'name': name,
                'unit': unit,
                'price': price,
                'weight': weight
            }
            
    materials_inserted = 0
    for code, m in unique_materials.items():
        mat_category = 'other'
        if 'nhôm' in m['name'].lower() or 'khung' in m['name'].lower() or 'cánh' in m['name'].lower():
            mat_category = 'aluminum'
        elif 'kính' in m['name'].lower() or 'glass' in m['name'].lower():
            mat_category = 'glass'
        elif 'gioăng' in m['name'].lower() or 'keo' in m['name'].lower() or 'sealant' in m['name'].lower():
            mat_category = 'other'
        elif m['unit'] == 'pc':
            mat_category = 'accessory'
            
        cursor.execute("""
        INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            default_price = EXCLUDED.default_price,
            weight_per_m = EXCLUDED.weight_per_m
        """, (code, m['name'], mat_category, m['unit'], m['price'], m['weight']))
        
        cursor.execute("""
        INSERT INTO project_material_prices (project_id, material_code, material_name, unit, price, weight)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (project_id, material_code) DO UPDATE SET
            material_name = EXCLUDED.material_name,
            unit = EXCLUDED.unit,
            price = EXCLUDED.price,
            weight = EXCLUDED.weight
        """, (project_id, code, m['name'], m['unit'], m['price'], m['weight']))
        materials_inserted += 1
        
    system_name = "Nova Excel System"
    cursor.execute("SELECT id FROM systems WHERE name = %s", (system_name,))
    sys_row = cursor.fetchone()
    if sys_row:
        system_id = sys_row[0]
    else:
        cursor.execute("INSERT INTO systems (name) VALUES (%s) RETURNING id", (system_name,))
        system_id = cursor.fetchone()[0]
        
    grouped = df.groupby('Typology Name')
    for typo_name, group in grouped:
        if not isinstance(typo_name, str) or not typo_name.strip():
            continue
            
        typo_name = typo_name.strip()
        
        cursor.execute("SELECT id FROM templates WHERE code = %s", (typo_name,))
        tmpl_row = cursor.fetchone()
        
        door_type = "CỬA ĐI" if "đi" in typo_name.lower() or "wa" in typo_name.lower() else "CỬA SỔ"
        
        if tmpl_row:
            template_id = tmpl_row[0]
        else:
            cursor.execute("""
            INSERT INTO templates (system_id, code, name, type, accessory_brand, glass_type)
            VALUES (%s, %s, %s, %s, 'Draho', 'k8cl')
            RETURNING id
            """, (system_id, typo_name, typo_name, door_type))
            template_id = cursor.fetchone()[0]
            
        cursor.execute("DELETE FROM profile_formulas WHERE template_id = %s", (template_id,))
        cursor.execute("DELETE FROM accessory_formulas WHERE template_id = %s", (template_id,))
        
        door_w, door_h = 1000.0, 2000.0
        glass_rows = group[group['QuantityUnit'] == 'm2']
        if not glass_rows.empty:
            max_glass = glass_rows.loc[glass_rows['Quantity'].idxmax()]
            try:
                g_w = float(max_glass.get('Width', 0.0))
                g_h = float(max_glass.get('Height', 0.0))
                if g_w > 0: door_w = g_w + 100
                if g_h > 0: door_h = g_h + 100
            except:
                pass
                
        for idx, row in group.iterrows():
            m_code = str(row.get('Code', '')).strip()
            m_name = str(row.get('Description', '')).strip()
            if not m_name or m_name == 'nan':
                m_name = str(row.get('Name', '')).strip()
            unit = str(row.get('QuantityUnit', 'pc')).strip()
            
            try:
                quantity = float(row.get('Quantity', 0.0))
                pieces = int(row.get('Pieces', 1))
            except:
                quantity = 0.0
                pieces = 1
                
            try:
                unit_weight = float(row.get('Unit Weight', 0.0))
            except:
                unit_weight = 0.0
                
            if not m_code or m_code == 'nan':
                continue
                
            qty_per_set = quantity
            
            if unit == 'm' and unit_weight > 0:
                cursor.execute("""
                INSERT INTO profile_formulas (template_id, name, code, dimension_type, formula, qty, weight_per_m)
                VALUES (%s, %s, %s, 'W', %s, %s, %s)
                """, (template_id, m_name, m_code, f"{qty_per_set:.4f}", pieces, unit_weight))
            else:
                cursor.execute("""
                INSERT INTO accessory_formulas (template_id, name, code, qty)
                VALUES (%s, %s, %s, %s)
                """, (template_id, m_name, m_code, qty_per_set))
                
        cursor.execute("SELECT id FROM project_doors WHERE project_id = %s AND code = %s", (project_id, typo_name))
        door_row = cursor.fetchone()
        if door_row:
            cursor.execute("""
            UPDATE project_doors 
            SET template_id = %s, width = %s, height = %s, qty = 1
            WHERE id = %s
            """, (template_id, door_w, door_h, door_row[0]))
        else:
            cursor.execute("""
            INSERT INTO project_doors (project_id, code, template_id, width, height, qty)
            VALUES (%s, %s, %s, %s, %s, 1)
            """, (project_id, typo_name, template_id, door_w, door_h))
            
    return materials_inserted

def eval_formula(formula_str, variables):
    """
    Safely evaluate formula string using variables dict.
    Variables include: W, H, W1, H1, W2, H2
    """
    # Clean formula string: remove spaces, convert to lowercase for comparison
    clean_formula = formula_str.upper().strip()
    
    # Replace variable names with their values
    for var, val in variables.items():
        if val is None:
            val = 0.0
        # Replace using regex to match word boundaries so 'W' doesn't replace 'W1'
        clean_formula = re.sub(r'\b' + var + r'\b', str(val), clean_formula)
        
    # Standardize basic safety check: only allow numbers, math operators
    if not re.match(r'^[\d.+\-*/()\s]+$', clean_formula):
        # If it has other characters, check if it's just a number
        try:
            return float(clean_formula)
        except ValueError:
            print(f"Warning: Invalid characters in formula evaluation: {formula_str} -> {clean_formula}")
            return 0.0
            
    try:
        # Safe eval using empty globals and locals
        result = eval(clean_formula, {"__builtins__": None}, {})
        return float(result)
    except Exception as e:
        print(f"Error evaluating formula '{formula_str}' (processed: '{clean_formula}'): {e}")
        return 0.0

def calculate_project_estimates(project_id):
    """
    Perform full project estimation calculations.
    Returns detail data of each door item.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all project doors
    cursor.execute("""
    SELECT pd.*, t.code as template_code, t.name as template_name, t.type as door_type,
           t.percent_aluminum, t.percent_glass, t.percent_accessories, t.percent_labor,
           t.glass_type, t.accessory_brand, s.name as system_name
    FROM project_doors pd
    JOIN templates t ON pd.template_id = t.id
    LEFT JOIN systems s ON t.system_id = s.id
    WHERE pd.project_id = %s
    """, (project_id,))
    doors = cursor.fetchall()
    
    # Fetch material prices for this project
    cursor.execute("SELECT material_code, price, weight, material_name, unit FROM project_material_prices WHERE project_id = %s", (project_id,))
    prices = {row['material_code']: {
        'price': row['price'], 
        'weight': row['weight'], 
        'name': row['material_name'],
        'unit': row['unit']
    } for row in cursor.fetchall()}
    
    # Fetch global materials for system-wide fallback prices
    cursor.execute("SELECT code, default_price, weight_per_m, name, unit FROM materials")
    global_materials = {row['code']: {
        'price': row['default_price'],
        'weight': row['weight_per_m'],
        'name': row['name'],
        'unit': row['unit']
    } for row in cursor.fetchall()}
    
    results = []
    
    for door in doors:
        door_id = door['id']
        template_id = door['template_id']
        door_code = door['code']
        door_name = door['template_name']
        door_type = door['door_type']
        
        # Dimensions (auto-detect meters vs millimeters)
        w = door['width']
        h = door['height']
        w_m = w if w < 10.0 else w / 1000.0
        h_m = h if h < 10.0 else h / 1000.0
        
        w1 = door['width1']
        h1 = door['height1']
        w1_m = w1 if (w1 is not None and w1 < 10.0) else (w1 / 1000.0 if w1 is not None else None)
        h1_m = h1 if (h1 is not None and h1 < 10.0) else (h1 / 1000.0 if h1 is not None else None)
        
        w2 = door['width2']
        h2 = door['height2']
        w2_m = w2 if (w2 is not None and w2 < 10.0) else (w2 / 1000.0 if w2 is not None else None)
        h2_m = h2 if (h2 is not None and h2 < 10.0) else (h2 / 1000.0 if h2 is not None else None)
        
        qty_sets = door['qty']
        
        # Area (m2) of 1 unit
        area = w_m * h_m
        total_area = area * qty_sets
        
        variables = {'W': w_m, 'H': h_m, 'W1': w1_m, 'H1': h1_m, 'W2': w2_m, 'H2': h2_m}
        
        # 1. Calculate Aluminum Profiles
        cursor.execute("SELECT * FROM profile_formulas WHERE template_id = %s", (template_id,))
        profile_formulas = cursor.fetchall()
        
        profiles_cost = 0.0
        profiles_weight = 0.0
        profiles_details = []
        
        for pf in profile_formulas:
            pf_code = pf['code']
            pf_name = pf['name']
            formula = pf['formula']
            pf_qty = pf['qty']
            
            # Get unit price & weight from imported Opera prices, fallback to global catalog, fallback to defaults
            if pf_code in prices:
                price_info = prices[pf_code]
            elif pf_code in global_materials:
                price_info = global_materials[pf_code]
            else:
                price_info = {'price': 98000.0, 'weight': pf['weight_per_m']}
                
            unit_price = price_info['price']
            weight_per_m = price_info['weight'] if price_info['weight'] > 0 else pf['weight_per_m']
            
            length = eval_formula(formula, variables)
            
            # Total weight for this profile (qty * length * weight_per_m)
            # Length in formula is in meters. If the formula gives mm, we divide by 1000.
            # Usually in estimation sheet, H & W are in meters (e.g. W=1.2, H=0.6).
            # So length in CSL-50.01 (0.59m) is already in meters.
            # Formulas like 'H - 0.01' will result in meters if H is in meters.
            weight_total = pf_qty * length * weight_per_m
            
            # Cost = Weight * Price (if priced by weight) or Qty * Length * Price (if priced by meter)
            # In our data, unit price for WSAW-5010 is 116300 VND/kg
            # Cost = weight_total * unit_price
            cost = weight_total * unit_price
            
            profiles_cost += cost
            profiles_weight += weight_total
            
            profiles_details.append({
                'name': pf_name,
                'code': pf_code,
                'formula': formula,
                'length': length,
                'qty': pf_qty,
                'weight_per_m': weight_per_m,
                'total_weight': weight_total,
                'unit_price': unit_price,
                'total_price': cost
            })
            
        # 2. Calculate Accessories
        cursor.execute("SELECT * FROM accessory_formulas WHERE template_id = %s", (template_id,))
        acc_formulas = cursor.fetchall()
        
        acc_cost = 0.0
        acc_details = []
        
        for af in acc_formulas:
            af_code = af['code']
            af_name = af['name']
            af_qty = af['qty']
            
            # Lookup price: check project prices, check global materials, fallback to 0
            if af_code in prices:
                price_info = prices[af_code]
            elif af_code in global_materials:
                price_info = global_materials[af_code]
            else:
                price_info = {'price': 0.0}
                
            unit_price = price_info['price']
            
            cost = af_qty * unit_price
            acc_cost += cost
            
            acc_details.append({
                'name': af_name,
                'code': af_code,
                'qty': af_qty,
                'unit_price': unit_price,
                'total_price': cost
            })
            
        # 3. Calculate Glass Cost (Estimated based on area)
        # Usually, glass is estimated by m2.
        # Find glass price from imported Opera file or default
        glass_type = door['glass_type']
        glass_price = 0.0
        # In Opera file, glass is represented by e.g. 'KINH 6.38MM' or '12MM GLASS' or 'KINH DAN AN TOAN 8.38MM'
        # Let's search our prices dict for a code matching glass type (case insensitive)
        glass_code = None
        for code in prices:
            if 'glass' in code.lower() or 'kinh' in code.lower():
                # Simple heuristic matching
                if glass_type.lower() in code.lower() or code.lower() in glass_type.lower():
                    glass_code = code
                    break
        
        if glass_code:
            glass_price = prices[glass_code]['price']
        else:
            # Look in global materials catalog
            for code in global_materials:
                if 'glass' in code.lower() or 'kinh' in code.lower():
                    if glass_type.lower() in code.lower() or code.lower() in glass_type.lower():
                        glass_code = code
                        break
            if glass_code:
                glass_price = global_materials[glass_code]['price']
            else:
                # Defaults based on glass type
                if '8' in glass_type:
                    glass_price = 240000.0  # VND/m2
                elif '10' in glass_type:
                    glass_price = 328000.0
                elif '12' in glass_type:
                    glass_price = 592900.0
                else:
                    glass_price = 200000.0
                
        # Estimate glass area (normally slightly less than total door area, e.g. 80-90% or calculated)
        # For simplicity of project, let's assume glass area ratio from template or just 85% of door area.
        # Or look at target file: for CSL-50.01 (W=1.2, H=0.6, Area=0.72), glass area is 0.626583 m2 (which is ~87% of door area).
        # We can calculate glass area using percent_glass or dynamic factors.
        # Let's use 87% as default glass area ratio for estimating glass cost.
        glass_area_ratio = 0.87
        glass_area = area * glass_area_ratio
        glass_cost = glass_area * glass_price
        
        # 4. Labor and Other Costs
        # From target file sheet CSL-50.01:
        # Nhôm: 47%, Kính: 9%, Vật tư phụ: 22%, Nhân công: 22%
        # Let's compute based on percentages or direct formulas.
        # In our case, we can compute direct materials cost = Aluminum Cost + Accessory Cost + Glass Cost.
        # Let Materials = 1929575 (Aluminum) + 349557 (Glass) + 920699 (Vật tư phụ) = 3,200,000
        # Actually, let's look at percent ratios:
        # Aluminum cost = 1929575
        # Glass cost = 349557
        # Accessories/Vật tư phụ = 920699
        # Labor = 903166
        # Total Price = 4,103,000 VND (Unit price per m2) -> Total for 0.72m2 is 2,954,160 VND
        # Let's establish a calculation flow:
        # We have the raw Aluminum Cost, Glass Cost, Accessory Cost from formulas.
        # We can calculate:
        # - Vật tư phụ (Auxiliary materials - glue, foam, spacers, screws...) = 15% to 22% of total price
        # - Nhân công (Labor - manufacture, installation) = 22% to 26% of total price
        # If we use the exact percentages defined in templates:
        # Let Total Cost per m2 = Raw Materials Cost / (1 - percent_auxiliary - percent_labor)
        # For CSL-50.01: %Nhôm=47%, %Kính=9%, %Vật tư phụ=22%, %Nhân công=22%
        # So Raw Materials (Nhôm + Kính) = 56% of Total Price.
        # Thus, Total Price = (Aluminum Cost + Glass Cost) / 0.56
        # Let's implement this percentage-based pricing engine!
        pct_al = door['percent_aluminum'] / 100.0
        pct_gl = door['percent_glass'] / 100.0
        pct_acc = door['percent_accessories'] / 100.0
        pct_lab = door['percent_labor'] / 100.0
        
        # Total material cost we calculated from formulas (aluminum + accessory + glass)
        # Note: in template sheet, 'Vật tư phụ' include accessory brand Draho and ke, screws, glue...
        # So we can calculate total price from Aluminum + Glass + Accessories.
        # In CSL-50.01, Nhôm (47%) + Kính (9%) + Vật tư phụ (22%) = 78% of Total. Nhân công = 22%.
        # Let's calculate: Total Price = (Aluminum Cost + Glass Cost + Accessory Cost) / (1 - pct_lab)
        # Then, we back-calculate:
        # - Labor Cost = Total Price * pct_lab
        # - Auxiliary materials cost = Total Price * pct_acc
        
        sum_materials = profiles_cost + glass_cost + acc_cost
        pct_materials = pct_al + pct_gl + pct_acc # usually 1 - pct_lab
        
        # Unit price of 1 bộ cửa (not per m2)
        total_unit_cost = sum_materials / (pct_materials if pct_materials > 0 else 0.78)
        
        # Price per m2
        price_per_m2 = total_unit_cost / area
        
        # Round price per m2 to nearest thousand (e.g. 4103000)
        price_per_m2_rounded = round(price_per_m2, -3)
        total_unit_cost_final = price_per_m2_rounded * area
        
        # Final values
        final_total_price = total_unit_cost_final * qty_sets
        
        # Back-calculate components for reporting
        final_al_cost = total_unit_cost_final * pct_al
        final_gl_cost = total_unit_cost_final * pct_gl
        final_acc_cost = total_unit_cost_final * pct_acc
        final_lab_cost = total_unit_cost_final * pct_lab
        
        results.append({
            'door_id': door_id,
            'template_code': door['template_code'],
            'code': door_code,
            'name': door_name,
            'type': door_type,
            'width': w,
            'height': h,
            'qty': qty_sets,
            'area': area,
            'total_area': total_area,
            'price_per_m2': price_per_m2_rounded,
            'unit_price': total_unit_cost_final,
            'total_price': final_total_price,
            'glass_type': glass_type,
            'components': {
                'aluminum': final_al_cost,
                'glass': final_gl_cost,
                'auxiliary': final_acc_cost,
                'labor': final_lab_cost
            },
            'profiles': profiles_details,
            'accessories': acc_details,
            'glass_price_used': glass_price,
            'glass_area_used': glass_area
        })
        
    conn.close()
    return results

def get_row_styles(ws, row_idx):
    styles = []
    for col in range(1, ws.max_column + 1):
        cell = ws.cell(row=row_idx, column=col)
        styles.append({
            'font': copy(cell.font),
            'fill': copy(cell.fill),
            'border': copy(cell.border),
            'alignment': copy(cell.alignment),
            'number_format': cell.number_format
        })
    row_height = ws.row_dimensions[row_idx].height
    return {'cells': styles, 'height': row_height}

def apply_row_styles(ws, row_idx, style_dict):
    styles = style_dict['cells']
    for col, style in enumerate(styles, 1):
        cell = ws.cell(row=row_idx, column=col)
        cell.font = copy(style['font'])
        cell.fill = copy(style['fill'])
        cell.border = copy(style['border'])
        cell.alignment = copy(style['alignment'])
        cell.number_format = style['number_format']
    if style_dict['height'] is not None:
        ws.row_dimensions[row_idx].height = style_dict['height']

def get_door_description(item):
    name = item.get('name') or item.get('template_name') or ''
    system = item.get('system_name') or 'Nova System'
    glass = item.get('glass_type') or 'k8cl'
    brand = item.get('accessory_brand') or 'Draho'
    
    # Format glass type to readable Vietnamese
    glass_str = f"Kính {glass}"
    if 'cl' in glass.lower() or 'cường lực' in glass.lower():
        thickness_match = re.search(r'\d+', glass)
        thickness = thickness_match.group(0) if thickness_match else '8'
        glass_str = f"Kính trắng cường lực dày {thickness}mm"
    elif 'dán' in glass.lower() or 'an toàn' in glass.lower():
        thickness_match = re.search(r'\d+\.?\d*', glass)
        thickness = thickness_match.group(0) if thickness_match else '8.38'
        glass_str = f"Kính dán an toàn dày {thickness}mm"
    
    # Format accessory brand
    brand_str = f"Phụ kiện đồng bộ {brand}"
    if 'draho' in brand.lower():
        brand_str = "Phụ kiện bánh xe đôi, khóa âm đồng bộ Draho" if "lùa" in name.lower() else "Phụ kiện tay nắm, bản lề chữ A đồng bộ Draho"
        if "đi" in name.lower() or "cd" in name.lower() or "cửa đi" in name.lower():
            brand_str = "Phụ kiện khóa đa điểm, bản lề 3D đồng bộ Draho"
            
    desc = f"{name}\n- Nhóm hệ {system}\n- {glass_str}\n- {brand_str}"
    return desc

def generate_excel_report(project_id, template_path, output_path):
    """
    Generate Excel Report based on project calculations, copying template styles.
    """
    print(f"Generating Excel Report from {template_path} to {output_path}")
    
    # Calculate project estimates
    calc_results = calculate_project_estimates(project_id)
    if not calc_results:
        print("No doors to estimate.")
        return False
        
    # Open template workbook
    wb = openpyxl.load_workbook(template_path)
    
    # Update sheet DETAIL
    total_row = 52 # default fallback
    if 'DETAIL' in wb.sheetnames:
        ws_detail = wb['DETAIL']
        
        # 1. Read and save the styles of the template rows so we can apply them
        # Header Row style: from Row 9 of the template
        header_styles = get_row_styles(ws_detail, 9)
        # Data Row style: from Row 10 of the template
        data_styles = get_row_styles(ws_detail, 10)
        # Total Row style: from Row 52 of the template
        total_styles = get_row_styles(ws_detail, 52)
        # Ghi chu Row style: from Row 54 and 55 of the template
        ghichu_header_styles = get_row_styles(ws_detail, 54)
        ghichu_body_styles = get_row_styles(ws_detail, 55)
        
        # Load the project name to put in the header
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM projects WHERE id = %s", (project_id,))
        proj_row = cursor.fetchone()
        project_name = proj_row[0] if proj_row else "GOLDEN CITY"
        conn.close()
        
        # Set project name in Row 2
        ws_detail.cell(row=2, column=1, value=f"Dự án: {project_name.upper()}")
        
        # 1.5. Unmerge all merged ranges from row 9 downwards to avoid write restrictions
        merged_ranges = list(ws_detail.merged_cells.ranges)
        for r_range in merged_ranges:
            if r_range.min_row >= 9:
                ws_detail.unmerge_cells(str(r_range))
        
        # 2. Clear all rows from row 9 to the max row of the worksheet
        # (This avoids any leftovers from the template)
        original_max_row = ws_detail.max_row
        for r in range(9, original_max_row + 1):
            ws_detail.row_dimensions[r].hidden = False # Unhide
            for col in range(1, ws_detail.max_column + 1):
                cell = ws_detail.cell(row=r, column=col)
                if cell.__class__.__name__ == 'Cell':
                    cell.value = None
                
        # 3. Group calc_results by door type
        grouped_items = {}
        for item in calc_results:
            t = item.get('type') or 'CỬA KHÁC'
            if t not in grouped_items:
                grouped_items[t] = []
            grouped_items[t].append(item)
            
        def type_sort_key(t):
            t_lower = t.lower()
            if 'sổ' in t_lower:
                return (0, t)
            elif 'đi' in t_lower:
                return (1, t)
            elif 'vách' in t_lower:
                return (2, t)
            else:
                return (3, t)
                
        sorted_types = sorted(grouped_items.keys(), key=type_sort_key)
        
        # Write categories and items
        current_row = 9
        category_letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
        
        for cat_idx, cat_type in enumerate(sorted_types):
            cat_letter = category_letters[cat_idx] if cat_idx < len(category_letters) else str(cat_idx + 1)
            cat_items = grouped_items[cat_type]
            
            # Write Category Header Row
            ws_detail.cell(row=current_row, column=1, value=cat_letter)
            ws_detail.cell(row=current_row, column=2, value=cat_type.upper())
            apply_row_styles(ws_detail, current_row, header_styles)
            
            # Merge columns 2 to 7 for Category Header
            try:
                ws_detail.merge_cells(start_row=current_row, start_column=2, end_row=current_row, end_column=7)
            except Exception as e:
                print(f"Warning merging cells at row {current_row}: {e}")
            
            start_r = current_row + 1
            end_r = current_row + len(cat_items)
            
            # Update Category Header subtotal formulas
            # Column H: =SUBTOTAL(9,H{start}:H{end})
            # Column J: =SUBTOTAL(9,J{start}:J{end})
            ws_detail.cell(row=current_row, column=8, value=f"=SUBTOTAL(9,H{start_r}:H{end_r})")
            ws_detail.cell(row=current_row, column=10, value=f"=SUBTOTAL(9,J{start_r}:J{end_r})")
            
            current_row += 1
            
            # Write Category Data Rows
            for item_idx, item in enumerate(cat_items, 1):
                # Column A: STT (integer)
                ws_detail.cell(row=current_row, column=1, value=item_idx)
                
                # Column B: Description
                desc = get_door_description(item)
                ws_detail.cell(row=current_row, column=2, value=desc)
                # Enable wrap text for description
                ws_detail.cell(row=current_row, column=2).alignment = openpyxl.styles.Alignment(wrap_text=True, vertical='center')
                
                # Column C: Ký hiệu
                ws_detail.cell(row=current_row, column=3, value=item.get('code') or item.get('template_code'))
                
                # Column D: Rộng (width in meters)
                w_val = item.get('width')
                w_m = w_val if w_val < 10.0 else w_val / 1000.0
                ws_detail.cell(row=current_row, column=4, value=w_m)
                
                # Column E: Cao (height in meters)
                h_val = item.get('height')
                h_m = h_val if h_val < 10.0 else h_val / 1000.0
                ws_detail.cell(row=current_row, column=5, value=h_m)
                
                # Column F: Đơn vị
                ws_detail.cell(row=current_row, column=6, value='m2')
                
                # Column G: Số lượng
                ws_detail.cell(row=current_row, column=7, value=item.get('qty'))
                
                # Column H: Tổng cộng (m2) = D*E*G
                ws_detail.cell(row=current_row, column=8, value=f"=D{current_row}*E{current_row}*G{current_row}")
                
                # Column I: Đơn giá/m2
                ws_detail.cell(row=current_row, column=9, value=item.get('price_per_m2'))
                
                # Column J: Thành tiền = H*I
                ws_detail.cell(row=current_row, column=10, value=f"=H{current_row}*I{current_row}")
                
                apply_row_styles(ws_detail, current_row, data_styles)
                current_row += 1
                
        # 4. Write Total Row
        total_row = current_row
        ws_detail.cell(row=total_row, column=1, value="Tổng cộng:")
        
        # Formulas for Total Row:
        # H: `=SUBTOTAL(9,H9:H{total_row-1})`
        # I: `=IFERROR(J{total_row}/H{total_row},"")`
        # J: `=SUBTOTAL(9,J9:J{total_row-1})`
        ws_detail.cell(row=total_row, column=8, value=f"=SUBTOTAL(9,H9:H{total_row-1})")
        ws_detail.cell(row=total_row, column=9, value=f'=IFERROR(J{total_row}/H{total_row},"")')
        ws_detail.cell(row=total_row, column=10, value=f"=SUBTOTAL(9,J9:J{total_row-1})")
        
        apply_row_styles(ws_detail, total_row, total_styles)
        current_row += 1
        
        # 5. Write Ghi chú section
        current_row += 1 # Empty row
        
        ws_detail.cell(row=current_row, column=1, value="Ghi chú:")
        apply_row_styles(ws_detail, current_row, ghichu_header_styles)
        current_row += 1
        
        # Body of Ghi chú - write as plain strings to prevent sheet reference errors
        ghi_chu_lines = [
            "- Sản phẩm sử dụng hệ nhôm hoàn thiện sơn tĩnh điện theo tiêu chuẩn AAMA2604, bảo hành sơn 20 năm, màu sơn solid (không bao gồm màu sơn metalic).",
            "- Đơn giá áp dụng cho 1 màu sơn cho toàn dự án, trường hợp dự án có nhiều màu sẽ được tính toán phụ phí và thống nhất giữa các bên.",
            "- Kích thước nghiệm thu là kích thước ô chờ.",
            "- Đối với các hạng mục có hình dạng dị hình (vòm cong, tam giác, bình hành…), khối lượng được quy về hình chữ nhật bao quanh.",
            "- Khối lượng là tạm tính.",
            "- Báo giá không bao gồm thí nghiệm mô hình."
        ]
        
        for line in ghi_chu_lines:
            ws_detail.cell(row=current_row, column=1, value=line)
            apply_row_styles(ws_detail, current_row, ghichu_body_styles)
            current_row += 1

    # Update sheet CPHoanThien
    if 'CPHoanThien' in wb.sheetnames:
        ws_summary = wb['CPHoanThien']
        for r in range(1, 100):
            val = ws_summary.cell(row=r, column=2).value # DIỄN GIẢI
            if val and 'DOANH THU' in str(val):
                ws_summary.cell(row=r, column=7, value=f"=DETAIL!J{total_row}")
            elif val and 'TỔNG CHI PHÍ' in str(val):
                total_labor = sum(item['components']['labor'] * item['qty'] for item in calc_results)
                total_al = sum(item['components']['aluminum'] * item['qty'] for item in calc_results)
                total_gl = sum(item['components']['glass'] * item['qty'] for item in calc_results)
                total_aux = sum(item['components']['auxiliary'] * item['qty'] for item in calc_results)
                total_cost = total_labor + total_al + total_gl + total_aux
                ws_summary.cell(row=r, column=7, value=total_cost)

    # Update detail breakdown sheets (CSL-50.01, CSL-50.02, CSL-50.03...)
    for item in calc_results:
        sheet_name = item['template_code']
        if sheet_name in wb.sheetnames:
            ws_sheet = wb[sheet_name]
            # Update header info
            ws_sheet.cell(row=4, column=6, value=item['price_per_m2'])
            ws_sheet.cell(row=5, column=6, value=item['area'])
            ws_sheet.cell(row=6, column=6, value=item['unit_price'])
            ws_sheet.cell(row=7, column=6, value=item['qty'])
            
            # Update profile table values
            profiles = item['profiles']
            for p in profiles:
                for r in range(12, 40):
                    cell_code = ws_sheet.cell(row=r, column=2).value
                    if cell_code == p['code']:
                        ws_sheet.cell(row=r, column=4, value=p['length'])
                        ws_sheet.cell(row=r, column=7, value=p['total_weight'])
                        ws_sheet.cell(row=r, column=9, value=p['total_price'])
                        ws_sheet.cell(row=r, column=8, value=p['unit_price'])
                        break
                        
    # Remove unused sheets
    active_templates = {item['template_code'] for item in calc_results}
    sheets_to_remove = []
    for sheet_name in wb.sheetnames:
        is_door_sheet = any(sheet_name.startswith(prefix) for prefix in ['CSL-', 'CDL-', 'CSB-', 'CDMQ-', 'VKT'])
        if is_door_sheet and sheet_name not in active_templates:
            sheets_to_remove.append(sheet_name)
            
    for sheet_name in sheets_to_remove:
        try:
            wb.remove(wb[sheet_name])
            print(f"Removed unused sheet: {sheet_name}")
        except Exception as e:
            print(f"Error removing sheet {sheet_name}: {e}")
                        
    # Save output
    wb.save(output_path)
    print(f"Excel report saved successfully to {output_path}")
    return True
                        
    # Save output
    wb.save(output_path)
    print(f"Excel report saved successfully to {output_path}")
    return True

if __name__ == "__main__":
    # Test script locally
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    # 1. Parse opera file
    parse_opera_file(1, os.path.join(base_dir, "5017.xls"))
    # 2. Run calculations
    results = calculate_project_estimates(1)
    print(f"Calculated {len(results)} doors.")
    # 3. Export
    generate_excel_report(1, os.path.join(base_dir, "BAO GIA-NHOM KINH NOVA EC.xlsx"), os.path.join(base_dir, "BAO_GIA_CALCULATED.xlsx"))
