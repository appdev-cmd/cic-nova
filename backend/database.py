import psycopg2
import psycopg2.extras
import os
import re

SUPABASE_ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "supabase-docker", ".env"))

def get_postgres_password():
    if not os.path.exists(SUPABASE_ENV_PATH):
        raise FileNotFoundError(f"Supabase .env file not found at {SUPABASE_ENV_PATH}")
        
    with open(SUPABASE_ENV_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
        
    match = re.search(r"^POSTGRES_PASSWORD=(.*)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    raise ValueError("POSTGRES_PASSWORD not found in Supabase .env file")

def get_db_connection():
    password = get_postgres_password()
    conn = psycopg2.connect(
        host="localhost",
        port=54321,
        database="postgres",
        user="postgres",
        password=password,
        cursor_factory=psycopg2.extras.DictCursor
    )
    return conn

def init_db():
    print("Database is managed by Supabase Docker. Skipping SQLite initialization.")

def seed_data():
    print("Database is seeded via migrate_to_postgres.py. Skipping local SQLite seed.")

if __name__ == "__main__":
    # Test connection
    try:
        conn = get_db_connection()
        print("Successfully connected to PostgreSQL (Supabase) database.")
        conn.close()
    except Exception as e:
        print(f"Failed to connect: {e}")
