import hashlib
import os
import hmac
import base64
import json
import time
import secrets
import warnings
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db_connection, load_backend_env

_backend_env = load_backend_env()
_environment = os.getenv("NOVA_ENV", _backend_env.get("NOVA_ENV", "development")).lower()
SECRET_KEY = os.getenv("NOVA_JWT_SECRET") or _backend_env.get("NOVA_JWT_SECRET")
if not SECRET_KEY:
    if _environment == "production":
        raise RuntimeError("NOVA_JWT_SECRET is required in production.")
    SECRET_KEY = secrets.token_urlsafe(48)
    warnings.warn(
        "NOVA_JWT_SECRET is not configured; using an ephemeral development key. "
        "Sessions will be invalidated when the backend restarts.",
        RuntimeWarning,
    )

JWT_ISSUER = "cic-nova"
PBKDF2_ITERATIONS = 600_000
security = HTTPBearer()

# Password Hashing Utilities using PBKDF2
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${key.hex()}"

def verify_password(password: str, hashed_password: str) -> bool:
    try:
        if hashed_password.startswith("pbkdf2_sha256$"):
            _, iterations_raw, salt_hex, key_hex = hashed_password.split('$', 3)
            iterations = int(iterations_raw)
        else:
            # Backward compatibility for hashes created by earlier releases.
            salt_hex, key_hex = hashed_password.split('.')
            iterations = 100_000
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac(
            'sha256', password.encode('utf-8'), salt, iterations
        )
        return hmac.compare_digest(new_key, key)
    except Exception:
        return False

# Pure Python JWT Helper (HS256)
def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: dict, expires_in: int = 28800) -> str:
    """Create JWT token valid for 8 hours by default"""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = payload.copy()
    payload["iss"] = JWT_ISSUER
    payload["iat"] = int(time.time())
    payload["exp"] = int(time.time()) + expires_in
    
    header_json = json.dumps(header, separators=(',', ':')).encode('utf-8')
    payload_json = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    
    header_b64 = base64url_encode(header_json)
    payload_b64 = base64url_encode(payload_json)
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_jwt(token: str) -> dict:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts

        header = json.loads(base64url_decode(header_b64).decode('utf-8'))
        if header.get("alg") != "HS256" or header.get("typ") != "JWT":
            return None
        
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        expected_signature_b64 = base64url_encode(expected_signature)
        
        if not hmac.compare_digest(signature_b64, expected_signature_b64):
            return None
            
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        if payload.get("iss") != JWT_ISSUER:
            return None
        if payload.get("exp", 0) < time.time():
            return None  # Token expired
            
        return payload
    except Exception:
        return None

# Dependency to get current user from DB
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_jwt(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token thiếu thông tin định danh.",
        )
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, username, name, role FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Người dùng không tồn tại trên hệ thống.",
            )
        return dict(user)
    finally:
        cursor.close()
        conn.close()

# Role enforcers
class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện hành động này.",
            )
        return current_user

# Pre-defined checkers
allow_any_user = get_current_user
allow_editor_admin = RoleChecker(["admin", "editor"])
allow_admin_only = RoleChecker(["admin"])
