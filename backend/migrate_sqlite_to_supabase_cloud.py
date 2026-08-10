import sqlite3
import psycopg2
import psycopg2.extras
import os
import sys
import re

from database import load_backend_env

def migrate_sqlite_to_cloud():
    sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cic_nova.db')
    print(f"Connecting to SQLite: {sqlite_path}")
    lite_conn = sqlite3.connect(sqlite_path)
    lite_conn.row_factory = sqlite3.Row
    lite_cur = lite_conn.cursor()
    
    cloud_env = load_backend_env()
    cloud_host = os.getenv("SUPABASE_DB_HOST") or cloud_env.get("SUPABASE_DB_HOST")
    cloud_password = os.getenv("SUPABASE_DB_PASSWORD") or cloud_env.get("SUPABASE_DB_PASSWORD")
    cloud_user = os.getenv("SUPABASE_DB_USER") or cloud_env.get("SUPABASE_DB_USER")
    cloud_port = int(os.getenv("SUPABASE_DB_PORT") or cloud_env.get("SUPABASE_DB_PORT", 6543))
    if not cloud_host or not cloud_password or not cloud_user:
        raise RuntimeError("SUPABASE_DB_HOST, SUPABASE_DB_USER and SUPABASE_DB_PASSWORD are required.")
    print(f"Connecting to Supabase Cloud PostgreSQL via pooler at {cloud_host}...")
    cloud_conn = psycopg2.connect(
        host=cloud_host,
        port=cloud_port,
        database="postgres",
        user=cloud_user,
        password=cloud_password,
        cursor_factory=psycopg2.extras.DictCursor
    )
    cloud_cur = cloud_conn.cursor()
    
    # DDL for Supabase Cloud
    tables_ddl = {
        'systems': """
            CREATE TABLE IF NOT EXISTS systems (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL
            )
        """,
        'templates': """
            CREATE TABLE IF NOT EXISTS templates (
                id SERIAL PRIMARY KEY,
                system_id INTEGER NOT NULL REFERENCES systems(id),
                code VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                accessory_brand VARCHAR(100),
                glass_type VARCHAR(100),
                percent_aluminum REAL DEFAULT 45.0,
                percent_glass REAL DEFAULT 10.0,
                percent_accessories REAL DEFAULT 20.0,
                percent_labor REAL DEFAULT 25.0
            )
        """,
        'profile_formulas': """
            CREATE TABLE IF NOT EXISTS profile_formulas (
                id SERIAL PRIMARY KEY,
                template_id INTEGER NOT NULL REFERENCES templates(id),
                name VARCHAR(255) NOT NULL,
                code VARCHAR(255) NOT NULL,
                dimension_type VARCHAR(50) NOT NULL,
                formula VARCHAR(255) NOT NULL,
                qty INTEGER NOT NULL DEFAULT 1,
                weight_per_m REAL NOT NULL DEFAULT 0.0
            )
        """,
        'accessory_formulas': """
            CREATE TABLE IF NOT EXISTS accessory_formulas (
                id SERIAL PRIMARY KEY,
                template_id INTEGER NOT NULL REFERENCES templates(id),
                name VARCHAR(255) NOT NULL,
                code VARCHAR(255) NOT NULL,
                qty REAL NOT NULL DEFAULT 1.0
            )
        """,
        'materials': """
            CREATE TABLE IF NOT EXISTS materials (
                id SERIAL PRIMARY KEY,
                code VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(50) NOT NULL, -- 'aluminum', 'accessory', 'glass', 'other'
                unit VARCHAR(50) NOT NULL DEFAULT 'pc',
                default_price REAL NOT NULL DEFAULT 0.0,
                weight_per_m REAL NOT NULL DEFAULT 0.0
            )
        """,
        'projects': """
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """,
        'project_doors': """
            CREATE TABLE IF NOT EXISTS project_doors (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id),
                code VARCHAR(255) NOT NULL,
                template_id INTEGER NOT NULL REFERENCES templates(id),
                width REAL NOT NULL,
                height REAL NOT NULL,
                width1 REAL,
                height1 REAL,
                width2 REAL,
                height2 REAL,
                qty INTEGER NOT NULL DEFAULT 1
            )
        """,
        'project_material_prices': """
            CREATE TABLE IF NOT EXISTS project_material_prices (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id),
                material_code VARCHAR(255) NOT NULL,
                material_name VARCHAR(255),
                unit VARCHAR(50),
                price REAL NOT NULL DEFAULT 0.0,
                weight REAL DEFAULT 0.0,
                UNIQUE(project_id, material_code)
            )
        """
    }
    
    # 1. Create all tables on Supabase Cloud
    print("Creating tables on Supabase Cloud...")
    for table_name, ddl in tables_ddl.items():
        print(f"  Creating table {table_name}...")
        cloud_cur.execute(ddl)
    cloud_conn.commit()
    
    # 2. Migrate basic data from SQLite
    table_order = ['systems', 'templates', 'profile_formulas', 'accessory_formulas', 'projects', 'project_doors', 'project_material_prices']
    for table in table_order:
        print(f"Migrating table {table}...")
        lite_cur.execute(f"SELECT * FROM {table}")
        rows = lite_cur.fetchall()
        if not rows:
            print(f"  No rows in SQLite table {table}, skipping.")
            continue
            
        columns = rows[0].keys()
        col_list = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        conflict_target = "id"
        if table == 'systems':
            conflict_target = "name"
        elif table == 'templates':
            conflict_target = "code"
        elif table == 'project_material_prices':
            conflict_target = "project_id, material_code"
            
        insert_query = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) ON CONFLICT ({conflict_target}) DO NOTHING"
        
        pg_data = []
        for r in rows:
            pg_data.append(tuple(r[col] for col in columns))
            
        cloud_cur.executemany(insert_query, pg_data)
        cloud_conn.commit()
        print(f"  Migrated {len(pg_data)} rows into {table}.")
        
        if 'id' in columns:
            try:
                cloud_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), coalesce(max(id), 1), max(id) is not null) FROM {table}")
                cloud_conn.commit()
            except Exception as seq_err:
                print(f"  Warning: could not reset sequence for {table}: {seq_err}")
                cloud_conn.rollback()
                
    # 3. Handle 'materials' table
    print("Checking if 'materials' table exists in SQLite...")
    lite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='materials'")
    materials_exists = lite_cur.fetchone()
    
    if materials_exists:
        print("Migrating 'materials' table from SQLite...")
        lite_cur.execute("SELECT * FROM materials")
        rows = lite_cur.fetchall()
        if rows:
            columns = rows[0].keys()
            col_list = ", ".join(columns)
            placeholders = ", ".join(["%s"] * len(columns))
            insert_query = f"INSERT INTO materials ({col_list}) VALUES ({placeholders}) ON CONFLICT (code) DO NOTHING"
            
            pg_data = [tuple(r[col] for col in columns) for r in rows]
            cloud_cur.executemany(insert_query, pg_data)
            cloud_conn.commit()
            print(f"  Migrated {len(pg_data)} rows into materials.")
            
            try:
                cloud_cur.execute("SELECT setval(pg_get_serial_sequence('materials', 'id'), coalesce(max(id), 1), max(id) is not null) FROM materials")
                cloud_conn.commit()
            except:
                cloud_conn.rollback()
    else:
        print("'materials' table does not exist in SQLite. Generating from formulas...")
        # Extract and seed materials just like run_migration.py
        cloud_cur.execute("SELECT DISTINCT code, name, weight_per_m FROM profile_formulas")
        profiles = cloud_cur.fetchall()
        seeded_count = 0
        for p in profiles:
            code = p['code']
            name = p['name']
            weight = p['weight_per_m']
            cloud_cur.execute("""
            INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
            VALUES (%s, %s, 'aluminum', 'kg', 98000.0, %s)
            ON CONFLICT (code) DO NOTHING
            """, (code, name, weight))
            if cloud_cur.rowcount > 0:
                seeded_count += 1
                
        cloud_cur.execute("SELECT DISTINCT code, name FROM accessory_formulas")
        accessories = cloud_cur.fetchall()
        for a in accessories:
            code = a['code']
            name = a['name']
            cloud_cur.execute("""
            INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
            VALUES (%s, %s, 'accessory', 'pc', 0.0, 0.0)
            ON CONFLICT (code) DO NOTHING
            """, (code, name))
            if cloud_cur.rowcount > 0:
                seeded_count += 1
                
        # Seed default glass
        cloud_cur.execute("""
        INSERT INTO materials (code, name, category, unit, default_price, weight_per_m)
        VALUES ('k8cl', 'Kính trắng cường lực dày 8mm', 'glass', 'm2', 240000.0, 0.0)
        ON CONFLICT (code) DO NOTHING
        """)
        if cloud_cur.rowcount > 0:
            seeded_count += 1
            
        cloud_conn.commit()
        print(f"Generated and seeded {seeded_count} materials from formulas on Supabase Cloud.")
        
    lite_conn.close()
    cloud_conn.close()
    print("Migration from SQLite to Supabase Cloud completed successfully!")

if __name__ == "__main__":
    migrate_sqlite_to_cloud()
