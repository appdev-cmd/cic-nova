import sqlite3
import psycopg2
import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import get_db_connection

def migrate():
    sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cic_nova.db')
    print(f"Connecting to SQLite: {sqlite_path}")
    lite_conn = sqlite3.connect(sqlite_path)
    lite_conn.row_factory = sqlite3.Row
    lite_cur = lite_conn.cursor()

    print("Connecting to PostgreSQL...")
    pg_conn = get_db_connection()
    pg_cur = pg_conn.cursor()

    # DDL for Postgres
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

    # 1. Create tables
    for table_name, ddl in tables_ddl.items():
        print(f"Creating table {table_name} if not exists...")
        pg_cur.execute(ddl)
    pg_conn.commit()

    # 2. Migrate data
    table_order = ['systems', 'templates', 'profile_formulas', 'accessory_formulas', 'projects', 'project_doors', 'project_material_prices']
    for table in table_order:
        print(f"Migrating table {table}...")
        lite_cur.execute(f"SELECT * FROM {table}")
        rows = lite_cur.fetchall()
        if not rows:
            print(f"No rows in SQLite table {table}, skipping.")
            continue
            
        columns = rows[0].keys()
        col_list = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        insert_query = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
        
        pg_data = []
        for r in rows:
            pg_data.append(tuple(r[col] for col in columns))
            
        pg_cur.executemany(insert_query, pg_data)
        pg_conn.commit()
        print(f"Migrated {len(pg_data)} rows into {table}.")

        # Reset sequence for postgres SERIAL primary key if 'id' exists
        if 'id' in columns:
            pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), coalesce(max(id), 1), max(id) is not null) FROM {table}")
            pg_conn.commit()

    lite_conn.close()
    pg_conn.close()
    print("Migration finished successfully!")

if __name__ == "__main__":
    migrate()
