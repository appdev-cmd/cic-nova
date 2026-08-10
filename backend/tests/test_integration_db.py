import os
import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app import run_migrations  # noqa: E402
from database import get_db_connection  # noqa: E402


@unittest.skipUnless(
    os.getenv("NOVA_RUN_DB_TESTS") == "1",
    "Set NOVA_RUN_DB_TESTS=1 to run PostgreSQL integration tests.",
)
class DatabaseIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        run_migrations()
        cls.conn = get_db_connection()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def test_audit_and_quote_version_tables_exist(self):
        cursor = self.conn.cursor()
        try:
            cursor.execute("SELECT to_regclass('public.material_price_history'), to_regclass('public.quote_versions')")
            history_table, quote_table = cursor.fetchone()
            self.assertEqual("material_price_history", history_table)
            self.assertEqual("quote_versions", quote_table)
        finally:
            cursor.close()


if __name__ == "__main__":
    unittest.main()
