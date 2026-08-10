import os
import sys
import time
import unittest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from auth import create_jwt, hash_password, verify_jwt, verify_password


class AuthTests(unittest.TestCase):
    def test_new_password_hash_round_trip(self):
        encoded = hash_password("MatKhauAnToan123")
        self.assertTrue(encoded.startswith("pbkdf2_sha256$600000$"))
        self.assertTrue(verify_password("MatKhauAnToan123", encoded))
        self.assertFalse(verify_password("sai-mat-khau", encoded))

    def test_legacy_password_hash_remains_valid(self):
        import hashlib

        salt = bytes.fromhex("00112233445566778899aabbccddeeff")
        key = hashlib.pbkdf2_hmac("sha256", b"legacy-password", salt, 100_000)
        legacy = f"{salt.hex()}.{key.hex()}"
        self.assertTrue(verify_password("legacy-password", legacy))

    def test_jwt_round_trip_and_tamper_detection(self):
        token = create_jwt({"sub": "admin"}, expires_in=60)
        self.assertEqual(verify_jwt(token)["sub"], "admin")

        header, payload, signature = token.split(".")
        tampered = f"{header}.{payload}.{signature[:-1]}A"
        self.assertIsNone(verify_jwt(tampered))

    def test_expired_jwt_is_rejected(self):
        token = create_jwt({"sub": "admin"}, expires_in=-1)
        time.sleep(0.01)
        self.assertIsNone(verify_jwt(token))


if __name__ == "__main__":
    unittest.main()
