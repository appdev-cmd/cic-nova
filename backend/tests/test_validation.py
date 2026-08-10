import os
import sys
import tempfile
import unittest

from pydantic import ValidationError

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import (
    DoorCreate,
    QUOTE_STATUS_TRANSITIONS,
    QuoteVersionStatusUpdate,
    TemplateCreate,
    UserRegister,
    generate_quote_pdf_bytes,
    parse_opera_xml_bom,
    safe_upload_name,
)


class RequestValidationTests(unittest.TestCase):
    def test_upload_name_removes_path_components(self):
        self.assertEqual(safe_upload_name(r"..\..\secret.xlsx"), "secret.xlsx")
        self.assertEqual(safe_upload_name("../../secret.xlsx"), "secret.xlsx")

    def test_door_dimensions_must_be_positive(self):
        with self.assertRaises(ValidationError):
            DoorCreate(code="D1", template_id=1, width=-1, height=1200, qty=1)

    def test_template_percentages_must_total_one_hundred(self):
        with self.assertRaises(ValidationError):
            TemplateCreate(
                system_id=1,
                code="D1",
                name="Cửa mẫu",
                type="Cửa đi",
                percent_aluminum=50,
                percent_glass=20,
                percent_accessories=20,
                percent_labor=20,
            )

    def test_new_user_requires_strong_minimum_length(self):
        with self.assertRaises(ValidationError):
            UserRegister(username="admin", password="123", name="Admin", role="admin")

    def test_quote_status_lifecycle_is_forward_only(self):
        self.assertEqual({"approved", "cancelled"}, QUOTE_STATUS_TRANSITIONS["draft"])
        self.assertEqual(set(), QUOTE_STATUS_TRANSITIONS["accepted"])
        with self.assertRaises(ValidationError):
            QuoteVersionStatusUpdate(status="deleted")

    def test_opera_xml_preview_extracts_door_and_material(self):
        xml = """<?xml version="1.0"?>
        <opera><component><cmp_position>D01</cmp_position><cmp_name>CSL-50.01</cmp_name>
        <cmp_width>1200</cmp_width><cmp_height>1500</cmp_height><cmp_quantity>2</cmp_quantity>
        <materials><material><mat_alternative_code>N50</mat_alternative_code>
        <mat_name>Nhôm khung</mat_name><mat_quantity>8.5</mat_quantity><mat_unit>m</mat_unit>
        <mat_unit_weight>1.2</mat_unit_weight></material></materials></component></opera>"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".xml", encoding="utf-8", delete=False) as fixture:
            fixture.write(xml)
            fixture_path = fixture.name
        try:
            doors, rows = parse_opera_xml_bom(fixture_path)
            self.assertEqual("D01", doors[0]["code"])
            self.assertEqual(2, doors[0]["qty"])
            self.assertEqual("N50", rows[0]["code"])
            self.assertEqual(8.5, rows[0]["quantity"])
        finally:
            os.remove(fixture_path)

    def test_quote_pdf_is_generated_from_snapshot(self):
        pdf = generate_quote_pdf_bytes("Dự án kiểm thử", 1, [{
            "code": "D01", "name": "Cửa đi", "width": 1200, "height": 2200,
            "qty": 1, "total_area": 2.64, "price_per_m2": 2500000,
            "total_price": 6600000,
        }])
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 1000)


if __name__ == "__main__":
    unittest.main()
