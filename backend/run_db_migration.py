import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import get_db_connection

def run_migrations():
    print("Connecting to the database to apply schema upgrades...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    queries = [
        # 1. Users table
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'viewer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        # 2. Price books table
        """
        CREATE TABLE IF NOT EXISTS price_books (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        # 3. Material price book items
        """
        CREATE TABLE IF NOT EXISTS material_price_book_items (
            id SERIAL PRIMARY KEY,
            price_book_id INTEGER NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
            material_code VARCHAR(255) NOT NULL REFERENCES materials(code) ON DELETE CASCADE,
            price REAL NOT NULL DEFAULT 0.0,
            UNIQUE(price_book_id, material_code)
        );
        """,
        # 4. Indirect cost configs
        """
        CREATE TABLE IF NOT EXISTS indirect_cost_configs (
            id SERIAL PRIMARY KEY,
            cost_type VARCHAR(50) NOT NULL,
            option_name VARCHAR(255) NOT NULL,
            value_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
            value REAL NOT NULL DEFAULT 0.0,
            description TEXT
        );
        """,
        # 5. Project indirect cost selections
        """
        CREATE TABLE IF NOT EXISTS project_indirect_cost_selections (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            cost_type VARCHAR(50) NOT NULL,
            indirect_cost_config_id INTEGER REFERENCES indirect_cost_configs(id) ON DELETE SET NULL,
            custom_value REAL DEFAULT NULL,
            UNIQUE(project_id, cost_type)
        );
        """,
        # 6. Alter projects table to add new columns
        """
        ALTER TABLE projects 
        ADD COLUMN IF NOT EXISTS price_book_id INTEGER REFERENCES price_books(id) ON DELETE SET NULL;
        """,
        """
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS target_profit_margin REAL DEFAULT 10.0;
        """,
        """
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS target_total_price REAL DEFAULT 0.0;
        """,
        # 7. Alter project_doors table to add description and override columns
        """
        ALTER TABLE project_doors
        ADD COLUMN IF NOT EXISTS description TEXT;
        """,
        """
        ALTER TABLE project_doors
        ADD COLUMN IF NOT EXISTS override_transport_cost REAL DEFAULT NULL;
        """,
        """
        ALTER TABLE project_doors
        ADD COLUMN IF NOT EXISTS override_installation_cost REAL DEFAULT NULL;
        """,
        """
        ALTER TABLE project_doors
        ADD COLUMN IF NOT EXISTS override_labor_cost REAL DEFAULT NULL;
        """,
        """
        ALTER TABLE project_doors
        ADD COLUMN IF NOT EXISTS price_per_m2 REAL DEFAULT 0.0;
        """
    ]
    
    try:
        for i, query in enumerate(queries, 1):
            print(f"Executing query {i}/{len(queries)}...")
            cursor.execute(query)
        
        # Seed default indirect cost configs if empty
        cursor.execute("SELECT COUNT(*) FROM indirect_cost_configs")
        if cursor.fetchone()[0] == 0:
            print("Seeding default indirect cost configurations...")
            default_configs = [
                ('transport', 'Dưới 10km', 'fixed', 500000.0, 'Vận chuyển nội thành cự ly ngắn dưới 10km'),
                ('transport', 'Từ 11km đến 50km', 'fixed', 1500000.0, 'Vận chuyển cự ly trung bình từ 11km đến 50km'),
                ('transport', 'Trên 50km', 'fixed', 3000000.0, 'Vận chuyển liên tỉnh cự ly dài trên 50km'),
                ('installation', 'Lắp đặt Tiêu chuẩn', 'percent', 5.0, 'Chi phí nhân công lắp đặt tính theo 5% giá trị vật tư'),
                ('installation', 'Lắp đặt Cao tầng', 'percent', 8.0, 'Chi phí nhân công lắp đặt nhà cao tầng tính theo 8% giá trị vật tư'),
                ('fabrication', 'Gia công Tiêu chuẩn', 'fixed', 150000.0, 'Gia công tại xưởng: 150,000 VND/m2'),
                ('contingency', 'Dự phòng rủi ro mặc định', 'percent', 2.0, 'Dự phòng rủi ro hao hụt vật tư: 2%')
            ]
            for config in default_configs:
                cursor.execute(
                    "INSERT INTO indirect_cost_configs (cost_type, option_name, value_type, value, description) VALUES (%s, %s, %s, %s, %s)",
                    config
                )
        
        # Seed an initial default price book if empty
        cursor.execute("SELECT COUNT(*) FROM price_books")
        if cursor.fetchone()[0] == 0:
            print("Seeding default price book...")
            cursor.execute("INSERT INTO price_books (name, description) VALUES ('Hệ đơn giá Tiêu chuẩn', 'Hệ đơn giá mặc định toàn hệ thống')")
            
        conn.commit()
        print("Database migrations applied successfully!")
    except Exception as e:
        conn.rollback()
        print(f"Migration error occurred: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_migrations()
