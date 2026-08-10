import psycopg2
import psycopg2.extras
import os
import re

SUPABASE_ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "supabase-docker", ".env"))
BACKEND_ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".env"))

def load_backend_env():
    env_vars = {}
    if os.path.exists(BACKEND_ENV_PATH):
        try:
            with open(BACKEND_ENV_PATH, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            key = parts[0].strip()
                            val = parts[1].strip()
                            # Strip quotes if present
                            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                                val = val[1:-1]
                            env_vars[key] = val
        except Exception as e:
            print(f"Warning: Could not read backend .env file: {e}")
    return env_vars

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
    # Process-level variables take precedence in containers/CI; backend/.env is
    # only a local-development fallback.
    env = {**load_backend_env(), **os.environ}
    if env.get('SUPABASE_DB_HOST'):
        # Connect to Supabase Cloud
        conn = psycopg2.connect(
            host=env['SUPABASE_DB_HOST'],
            port=int(env.get('SUPABASE_DB_PORT', 6543)),
            database=env.get('SUPABASE_DB_NAME', 'postgres'),
            user=env['SUPABASE_DB_USER'],
            password=env['SUPABASE_DB_PASSWORD'],
            sslmode=env.get('SUPABASE_DB_SSLMODE', 'require'),
            connect_timeout=int(env.get('SUPABASE_DB_CONNECT_TIMEOUT', 10)),
            cursor_factory=psycopg2.extras.DictCursor
        )
        return conn
        
    # 2. Fallback to Local Docker PostgreSQL
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
