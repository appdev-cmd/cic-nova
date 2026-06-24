import sys
import os
import psycopg2
import psycopg2.extras

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import get_postgres_password

def migrate_to_cloud():
    print("Starting migration to Supabase Cloud...")
    
    # 1. Connect to Local PostgreSQL
    local_password = get_postgres_password()
    print("Connecting to Local PostgreSQL...")
    local_conn = psycopg2.connect(
        host="localhost",
        port=54321,
        database="postgres",
        user="postgres",
        password=local_password,
        cursor_factory=psycopg2.extras.DictCursor
    )
    local_cur = local_conn.cursor()
    
    # 2. Connect to Supabase Cloud PostgreSQL
    cloud_host = "db.jjzjfmxnmfvfxehejrui.supabase.co"
    cloud_password = "z3drlXVQifeWA6K3"
    print(f"Connecting to Supabase Cloud PostgreSQL at {cloud_host}...")
    cloud_conn = psycopg2.connect(
        host=cloud_host,
        port=5432,
        database="postgres",
        user="postgres",
        password=cloud_password,
        cursor_factory=psycopg2.extras.DictCursor
    )
    cloud_cur = cloud_conn.cursor()
    
    # 3. DDL definitions for tables
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
                category VARCHAR(50) NOT NULL,
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
    
    # Create tables on Supabase Cloud
    print("Creating tables on Supabase Cloud if not exists...")
    for table_name, ddl in tables_ddl.items():
        print(f"  Creating table {table_name}...")
        cloud_cur.execute(ddl)
    cloud_conn.commit()
    print("All tables created successfully.")
    
    # 4. Migrate Data Table by Table
    table_order = ['systems', 'templates', 'profile_formulas', 'accessory_formulas', 'materials', 'projects', 'project_doors', 'project_material_prices']
    for table in table_order:
        print(f"Migrating table {table}...")
        local_cur.execute(f"SELECT * FROM {table}")
        rows = local_cur.fetchall()
        if not rows:
            print(f"  No rows in local table {table}, skipping.")
            continue
            
        columns = list(rows[0].keys())
        col_list = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        # We use ON CONFLICT DO NOTHING to avoid duplicate key errors if run multiple times
        conflict_target = "id"
        if table == 'systems':
            conflict_target = "name"
        elif table == 'templates':
            conflict_target = "code"
        elif table == 'materials':
            conflict_target = "code"
        elif table == 'project_material_prices':
            conflict_target = "project_id, material_code"
            
        insert_query = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) ON CONFLICT ({conflict_target}) DO NOTHING"
        
        cloud_data = []
        for r in rows:
            cloud_data.append(tuple(r[col] for col in columns))
            
        cloud_cur.executemany(insert_query, cloud_data)
        cloud_conn.commit()
        print(f"  Successfully migrated {len(cloud_data)} rows into {table}.")
        
        # Reset sequence for postgres SERIAL primary key if 'id' exists
        if 'id' in columns:
            try:
                cloud_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), coalesce(max(id), 1), max(id) is not null) FROM {table}")
                cloud_conn.commit()
                print(f"  Reset sequence for {table}.")
            except Exception as seq_err:
                print(f"  Warning: could not reset sequence for {table}: {seq_err}")
                cloud_conn.rollback()
                
    local_conn.close()
    cloud_conn.close()
    print("Database migration to Supabase Cloud completed successfully!")

if __name__ == "__main__":
    migrate_to_cloud()
