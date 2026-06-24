import sys
import os
import psycopg2

# Add backend directory to Python path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_path)

from database import get_db_connection

def run_migration():
    print("Running database migrations...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Create materials table
    print("Creating materials table if not exists...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS materials (
        id SERIAL PRIMARY KEY,
        code VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL, -- 'aluminum', 'accessory', 'glass', 'other'
        unit VARCHAR(50) NOT NULL DEFAULT 'pc',
        default_price REAL NOT NULL DEFAULT 0.0,
        weight_per_m REAL NOT NULL DEFAULT 0.0
    )
    """)
    conn.commit()
    
    # 2. Extract existing materials from profile_formulas & accessory_formulas and insert into materials catalog
    print("Extracting materials from profile_formulas...")
    cursor.execute("SELECT DISTINCT code, name, weight_per_m FROM profile_formulas")
    profiles = cursor.fetchall()
    
    seeded_count = 0
    for p in profiles:
        code = p['code']
        name = p['name']
        weight = p['weight_per_m']
        try:
            # Default price for profiles is 98000.0 VND/kg
            cursor.execute("""
            INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
            VALUES (%s, %s, 'aluminum', 'kg', 98000.0, %s)
            ON CONFLICT (code) DO NOTHING
            """, (code, name, weight))
            if cursor.rowcount > 0:
                seeded_count += 1
                print(f"Seeded profile material: {code} - {name}")
        except Exception as e:
            print(f"Error seeding profile {code}: {e}")
            
    print("Extracting materials from accessory_formulas...")
    cursor.execute("SELECT DISTINCT code, name FROM accessory_formulas")
    accessories = cursor.fetchall()
    
    for a in accessories:
        code = a['code']
        name = a['name']
        try:
            # Default unit price for accessory is 0.0 (user will update it)
            cursor.execute("""
            INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
            VALUES (%s, %s, 'accessory', 'pc', 0.0, 0.0)
            ON CONFLICT (code) DO NOTHING
            """, (code, name))
            if cursor.rowcount > 0:
                seeded_count += 1
                print(f"Seeded accessory material: {code} - {name}")
        except Exception as e:
            print(f"Error seeding accessory {code}: {e}")
            
    # 3. Add default glass material
    try:
        cursor.execute("""
        INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
        VALUES ('k8cl', 'Kính trắng cường lực dày 8mm', 'glass', 'm2', 240000.0, 0.0)
        ON CONFLICT (code) DO NOTHING
        """)
        if cursor.rowcount > 0:
            seeded_count += 1
            print("Seeded glass material: k8cl")
    except Exception as e:
        print(f"Error seeding glass k8cl: {e}")

    conn.commit()
    conn.close()
    print(f"Migration completed successfully. Seeded {seeded_count} new materials.")

if __name__ == "__main__":
    run_migration()
