import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app import app  # noqa: E402


class RouteSecurityTests(unittest.TestCase):
    def test_every_business_api_route_requires_authentication(self):
        public_paths = {
            "/api/auth/setup-status",
            "/api/auth/register-init",
            "/api/auth/login",
        }
        auth_dependencies = {
            "get_current_user",
            "allow_editor_admin",
            "allow_admin_only",
        }
        unprotected = []

        for route in app.routes:
            path = getattr(route, "path", "")
            if not path.startswith("/api/") or path in public_paths:
                continue
            dependency_names = set()
            pending = list(route.dependant.dependencies)
            while pending:
                dependency = pending.pop()
                dependency_names.add(getattr(dependency.call, "__name__", ""))
                pending.extend(dependency.dependencies)
            if dependency_names.isdisjoint(auth_dependencies):
                unprotected.append(f"{','.join(sorted(route.methods))} {path}")

        self.assertEqual([], unprotected, f"Unprotected API routes: {unprotected}")


if __name__ == "__main__":
    unittest.main()
