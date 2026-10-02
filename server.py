#!/usr/bin/env python3
"""Small standard-library server for the Markettech preview and owner admin.

This is a development starter, not a production deployment. It uses SQLite,
PBKDF2 password hashing, one owner account, and in-memory sessions. Production
launch still needs HTTPS hosting, tested backups, and a reviewed auth setup.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = Path(os.environ.get("MARKETTECH_DB_PATH", DATA_DIR / "markettech.sqlite3")).resolve()
SESSION_COOKIE = "markettech_admin_session"
SESSION_TTL = 12 * 60 * 60
PBKDF2_ROUNDS = 310_000
MAX_BODY_BYTES = 64 * 1024
LOW_STOCK_DEFAULT = 5

CATEGORIES = {
    "Kitchen": "Kitchen essentials",
    "Storage": "Smart storage",
    "Home": "Home & living",
}
ALLOWED_IMAGES = {
    "assets/product-prep.jpg",
    "assets/product-storage.jpg",
    "assets/product-organizer.jpg",
    "assets/product-textiles.jpg",
    "assets/product-utensils.jpg",
    "assets/product-basket.jpg",
}
DEFAULT_SETTINGS = {
    "announcement": "Store preview · Sample products and prices · Checkout is not connected yet",
    "hero_description": "Useful little finds for the kitchen and home, chosen to make everyday routines feel a bit more lovely.",
    "about_description": "Markettech is being imagined as a thoughtful corner of the internet for useful kitchen and home finds. The aim is simple: clear product details, a smooth way to shop, and a store that feels as welcoming as home.",
    "support_email": "",
}
SEED_PRODUCTS = [
    {
        "id": "acacia-board", "name": "Acacia Prep Board", "sku": "MT-KIT-001",
        "category": "Kitchen", "description": "A warm, sturdy everyday board for chopping, serving and the little rituals around a good meal.",
        "details": "Material: acacia wood · Sample listing · Product dimensions to be confirmed",
        "price": 899, "stock": 12, "low_stock_threshold": 4,
        "image": "assets/product-prep.jpg", "image_alt": "Natural acacia chopping board with wooden kitchen tools",
        "badge": "A DAILY FAVOURITE", "active": True,
    },
    {
        "id": "pantry-jars", "name": "Clear Pantry Jar Trio", "sku": "MT-STO-001",
        "category": "Storage", "description": "A simple way to keep pantry staples visible, tidy and close at hand.",
        "details": "Set of 3 · Glass jars with natural-look lids · Capacity to be confirmed",
        "price": 749, "stock": 8, "low_stock_threshold": 3,
        "image": "assets/product-storage.jpg", "image_alt": "Three clear pantry jars with wood lids",
        "badge": "TIDY THE PANTRY", "active": True,
    },
    {
        "id": "sage-caddy", "name": "Sage Sink Caddy", "sku": "MT-HOM-001",
        "category": "Home", "description": "A neat home for the small things that make the daily clean-up a little easier.",
        "details": "Sample listing · Exact material and size to be confirmed",
        "price": 449, "stock": 7, "low_stock_threshold": 3,
        "image": "assets/product-organizer.jpg", "image_alt": "Sage-green sink organizer with a sponge and dish brush",
        "badge": "A TIDIER SINK", "active": True,
    },
    {
        "id": "cotton-towels", "name": "Everyday Cotton Towels", "sku": "MT-KIT-002",
        "category": "Kitchen", "description": "Soft, useful kitchen towels in a calm palette made for everyday cooking and clean-up.",
        "details": "Sample set · Fabric, count and care instructions to be confirmed",
        "price": 599, "stock": 9, "low_stock_threshold": 4,
        "image": "assets/product-textiles.jpg", "image_alt": "Folded cotton kitchen towels in cream, sage and terracotta",
        "badge": "SOFT & USEFUL", "active": True,
    },
    {
        "id": "bamboo-utensils", "name": "Bamboo Utensil Set", "sku": "MT-KIT-003",
        "category": "Kitchen", "description": "Everyday cooking tools with a natural look, ready to sit by the stove.",
        "details": "Sample listing · Set contents and care instructions to be confirmed",
        "price": 699, "stock": 15, "low_stock_threshold": 5,
        "image": "assets/product-utensils.jpg", "image_alt": "Bamboo cooking utensils standing in a cream ceramic crock",
        "badge": "READY TO COOK", "active": True,
    },
    {
        "id": "woven-basket", "name": "Woven Pantry Basket", "sku": "MT-STO-002",
        "category": "Storage", "description": "A versatile basket to bring a little order to open shelves and kitchen counters.",
        "details": "Sample listing · Material, dimensions and care to be confirmed",
        "price": 799, "stock": 5, "low_stock_threshold": 2,
        "image": "assets/product-basket.jpg", "image_alt": "Woven natural-fiber basket with pantry jars and a folded towel",
        "badge": "MAKE SPACE", "active": True,
    },
]


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 15000")
    return connection


def initialize_database() -> None:
    with get_connection() as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sku TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                details TEXT NOT NULL DEFAULT '',
                price INTEGER NOT NULL CHECK (price >= 0),
                stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
                low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
                image TEXT NOT NULL,
                image_alt TEXT NOT NULL DEFAULT '',
                badge TEXT NOT NULL DEFAULT '',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                order_number TEXT NOT NULL UNIQUE,
                customer_name TEXT NOT NULL,
                email TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                delivery_address TEXT NOT NULL DEFAULT '',
                payment_method TEXT NOT NULL DEFAULT 'unknown',
                payment_status TEXT NOT NULL DEFAULT 'pending',
                fulfillment_status TEXT NOT NULL DEFAULT 'new',
                subtotal INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                entity TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_products_active_name ON products(active, name);
            CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
            """
        )
        if db.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            stamp = now_utc()
            for product in SEED_PRODUCTS:
                db.execute(
                    """INSERT INTO products
                       (id,name,sku,category,description,details,price,stock,low_stock_threshold,
                        image,image_alt,badge,active,created_at,updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (product["id"], product["name"], product["sku"], product["category"],
                     product["description"], product["details"], product["price"], product["stock"],
                     product["low_stock_threshold"], product["image"], product["image_alt"],
                     product["badge"], int(product["active"]), stamp, stamp),
                )
        for key, value in DEFAULT_SETTINGS.items():
            db.execute("INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)", (key, value))


def product_to_dict(row: sqlite3.Row, admin: bool = False) -> dict:
    item = {
        "id": row["id"], "name": row["name"], "category": row["category"],
        "categoryLabel": CATEGORIES.get(row["category"], row["category"]),
        "description": row["description"], "details": row["details"], "price": row["price"],
        "stock": row["stock"], "image": row["image"], "imageAlt": row["image_alt"],
        "badge": row["badge"], "active": bool(row["active"]),
        "lowStock": row["stock"] <= row["low_stock_threshold"],
    }
    if admin:
        item.update({"sku": row["sku"], "lowStockThreshold": row["low_stock_threshold"],
                     "createdAt": row["created_at"], "updatedAt": row["updated_at"]})
    return item


def settings_dict(db: sqlite3.Connection) -> dict:
    result = dict(DEFAULT_SETTINGS)
    result.update({row["key"]: row["value"] for row in db.execute("SELECT key,value FROM settings")})
    return result


def record_audit(db: sqlite3.Connection, action: str, entity: str, entity_id: str, detail: str = "") -> None:
    db.execute(
        "INSERT INTO audit_log(action,entity,entity_id,detail,created_at) VALUES (?,?,?,?,?)",
        (action, entity, entity_id, detail[:300], now_utc()),
    )


def valid_int(value, name: str, minimum: int = 0, maximum: int = 10_000_000) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{name} must be a whole number.")
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a whole number.")
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}.")
    return parsed


def valid_text(value, name: str, maximum: int, required: bool = False) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{name} must be text.")
    cleaned = value.strip()
    if required and not cleaned:
        raise ValueError(f"{name} is required.")
    if len(cleaned) > maximum:
        raise ValueError(f"{name} must be {maximum} characters or fewer.")
    return cleaned


def parse_bool(value, name: str) -> bool:
    if isinstance(value, bool):
        return value
    if value in (0, 1):
        return bool(value)
    raise ValueError(f"{name} must be true or false.")


def clean_product_payload(payload: dict, existing: sqlite3.Row | None = None) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Product details are missing.")
    name = valid_text(payload.get("name", existing["name"] if existing else ""), "Product name", 120, True)
    sku = valid_text(payload.get("sku", existing["sku"] if existing else ""), "SKU", 40, True)
    category = valid_text(payload.get("category", existing["category"] if existing else ""), "Category", 30, True)
    if category not in CATEGORIES:
        raise ValueError("Choose Kitchen, Storage, or Home for the category.")
    image = valid_text(payload.get("image", existing["image"] if existing else ""), "Product image", 120, True)
    if image not in ALLOWED_IMAGES or not (ROOT / image).is_file():
        raise ValueError("Choose one of the available product images.")
    description = valid_text(payload.get("description", existing["description"] if existing else ""), "Short description", 600)
    details = valid_text(payload.get("details", existing["details"] if existing else ""), "Product details", 300)
    image_alt = valid_text(payload.get("imageAlt", existing["image_alt"] if existing else name), "Image description", 180)
    badge = valid_text(payload.get("badge", existing["badge"] if existing else ""), "Small label", 40)
    price = valid_int(payload.get("price", existing["price"] if existing else 0), "Price (INR)", 0, 10_000_000)
    stock = valid_int(payload.get("stock", existing["stock"] if existing else 0), "Stock quantity", 0, 1_000_000)
    threshold = valid_int(payload.get("lowStockThreshold", existing["low_stock_threshold"] if existing else LOW_STOCK_DEFAULT), "Low-stock warning", 0, 1_000_000)
    active = parse_bool(payload.get("active", bool(existing["active"]) if existing else True), "Store visibility")
    return {"name": name, "sku": sku, "category": category, "description": description,
            "details": details, "price": price, "stock": stock, "threshold": threshold,
            "image": image, "image_alt": image_alt, "badge": badge, "active": active}


class StoreHandler(SimpleHTTPRequestHandler):
    server_version = "MarkettechPreview/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; "
            "form-action 'self'; base-uri 'self'",
        )
        if urlsplit(self.path).path.endswith((".html", ".css", ".js")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Avoid logging form bodies or credentials; standard access log is enough.
        super().log_message(fmt, *args)

    def send_json(self, status: int, data: dict | list, extra_headers: dict | None = None):
        body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def send_api_error(self, status: int, message: str):
        self.send_json(status, {"error": message})

    def read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid request size.")
        if length < 0 or length > MAX_BODY_BYTES:
            raise ValueError("Request is too large.")
        if length == 0:
            return {}
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("Please send valid form data.")
        if not isinstance(value, dict):
            raise ValueError("Please send valid form data.")
        return value

    def current_session(self) -> str | None:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        morsel = cookie.get(SESSION_COOKIE)
        if not morsel:
            return None
        token = morsel.value
        with self.server.sessions_lock:
            expiry = self.server.sessions.get(token)
            if not expiry:
                return None
            if expiry < time.time():
                self.server.sessions.pop(token, None)
                return None
            self.server.sessions[token] = time.time() + SESSION_TTL
        return token

    def require_admin(self) -> bool:
        if self.current_session():
            return True
        self.send_api_error(401, "Please sign in to the owner panel.")
        return False

    def cookie_header(self, token: str | None, clear: bool = False) -> str:
        value = "" if clear else token or ""
        age = 0 if clear else SESSION_TTL
        header = f"{SESSION_COOKIE}={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}"
        forwarded_proto = self.headers.get("X-Forwarded-Proto", "").lower()
        if forwarded_proto == "https":
            header += "; Secure"
        return header

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path.startswith("/api/"):
            self.api_get(path)
            return
        if path == "/admin":
            self.send_response(302)
            self.send_header("Location", "/admin.html")
            self.end_headers()
            return
        allowed = {"/", "/index.html", "/styles.css", "/app.js", "/admin.html", "/admin.css", "/admin.js"}
        if path in allowed:
            super().do_GET()
            return
        if path.startswith("/assets/"):
            candidate = (ROOT / path.lstrip("/")).resolve()
            try:
                candidate.relative_to((ROOT / "assets").resolve())
            except ValueError:
                self.send_error(404)
                return
            if candidate.is_file() and candidate.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
                super().do_GET()
                return
        self.send_error(404)

    def api_get(self, path: str):
        try:
            if path == "/api/health":
                self.send_json(200, {"ok": True, "mode": "preview"})
                return
            with get_connection() as db:
                if path == "/api/auth/status":
                    exists = db.execute("SELECT 1 FROM admins WHERE id=1").fetchone() is not None
                    self.send_json(200, {"setupRequired": not exists})
                    return
                if path == "/api/auth/me":
                    signed_in = bool(self.current_session())
                    self.send_json(200, {"authenticated": signed_in, "user": "owner" if signed_in else None})
                    return
                if path == "/api/products":
                    rows = db.execute("SELECT * FROM products WHERE active=1 ORDER BY rowid").fetchall()
                    self.send_json(200, [product_to_dict(row) for row in rows])
                    return
                if path == "/api/store-settings":
                    self.send_json(200, settings_dict(db))
                    return
                if not path.startswith("/api/admin/"):
                    self.send_api_error(404, "That API route was not found.")
                    return
                if not self.require_admin():
                    return
                if path == "/api/admin/products":
                    rows = db.execute("SELECT * FROM products ORDER BY updated_at DESC, name COLLATE NOCASE").fetchall()
                    self.send_json(200, [product_to_dict(row, admin=True) for row in rows])
                    return
                if path == "/api/admin/summary":
                    total = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
                    active = db.execute("SELECT COUNT(*) FROM products WHERE active=1").fetchone()[0]
                    low = db.execute("SELECT COUNT(*) FROM products WHERE active=1 AND stock<=low_stock_threshold").fetchone()[0]
                    orders = db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
                    unfulfilled = db.execute("SELECT COUNT(*) FROM orders WHERE fulfillment_status IN ('new','processing','packed')").fetchone()[0]
                    low_rows = db.execute("SELECT * FROM products WHERE active=1 AND stock<=low_stock_threshold ORDER BY stock,name LIMIT 8").fetchall()
                    self.send_json(200, {"products": total, "activeProducts": active, "lowStock": low,
                                         "orders": orders, "unfulfilledOrders": unfulfilled,
                                         "lowStockProducts": [product_to_dict(row, admin=True) for row in low_rows]})
                    return
                if path == "/api/admin/orders":
                    rows = db.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").fetchall()
                    self.send_json(200, [dict(row) for row in rows])
                    return
                if path == "/api/admin/settings":
                    self.send_json(200, settings_dict(db))
                    return
                if path == "/api/admin/activity":
                    rows = db.execute("SELECT action,entity,entity_id,detail,created_at FROM audit_log ORDER BY id DESC LIMIT 25").fetchall()
                    self.send_json(200, [dict(row) for row in rows])
                    return
                self.send_api_error(404, "That API route was not found.")
        except Exception as exc:
            print(f"GET {path} failed: {type(exc).__name__}: {exc}", flush=True)
            self.send_api_error(500, "The store could not load that information. Please try again.")

    def do_POST(self):
        path = unquote(urlsplit(self.path).path)
        if not path.startswith("/api/"):
            self.send_error(405)
            return
        try:
            payload = self.read_json()
            if path == "/api/auth/setup":
                self.auth_setup(payload)
                return
            if path == "/api/auth/login":
                self.auth_login(payload)
                return
            if path == "/api/auth/logout":
                token = self.current_session()
                if token:
                    with self.server.sessions_lock:
                        self.server.sessions.pop(token, None)
                self.send_json(200, {"ok": True}, {"Set-Cookie": self.cookie_header(None, clear=True)})
                return
            if path == "/api/admin/products":
                if not self.require_admin():
                    return
                self.create_product(payload)
                return
            match = re.fullmatch(r"/api/admin/inventory/([a-zA-Z0-9_-]+)", path)
            if match:
                if not self.require_admin():
                    return
                self.adjust_inventory(match.group(1), payload)
                return
            self.send_api_error(404, "That API route was not found.")
        except ValueError as exc:
            self.send_api_error(400, str(exc))
        except sqlite3.IntegrityError:
            self.send_api_error(409, "That SKU is already in use. Choose a different SKU.")
        except Exception as exc:
            print(f"POST {path} failed: {type(exc).__name__}: {exc}", flush=True)
            self.send_api_error(500, "The store could not complete that change. Please try again.")

    def do_PUT(self):
        path = unquote(urlsplit(self.path).path)
        if not path.startswith("/api/"):
            self.send_error(405)
            return
        if not self.require_admin():
            return
        try:
            payload = self.read_json()
            match = re.fullmatch(r"/api/admin/products/([a-zA-Z0-9_-]+)", path)
            if match:
                self.update_product(match.group(1), payload)
                return
            match = re.fullmatch(r"/api/admin/orders/([a-zA-Z0-9_-]+)", path)
            if match:
                self.update_order(match.group(1), payload)
                return
            if path == "/api/admin/settings":
                self.update_settings(payload)
                return
            self.send_api_error(404, "That API route was not found.")
        except ValueError as exc:
            self.send_api_error(400, str(exc))
        except sqlite3.IntegrityError as exc:
            self.send_api_error(409, "That SKU is already in use. Choose a different SKU.")
        except Exception as exc:
            print(f"PUT {path} failed: {type(exc).__name__}: {exc}", flush=True)
            self.send_api_error(500, "The store could not save that change. Please try again.")

    def do_DELETE(self):
        path = unquote(urlsplit(self.path).path)
        if not path.startswith("/api/"):
            self.send_error(405)
            return
        if not self.require_admin():
            return
        match = re.fullmatch(r"/api/admin/products/([a-zA-Z0-9_-]+)", path)
        if not match:
            self.send_api_error(404, "That API route was not found.")
            return
        product_id = match.group(1)
        try:
            with get_connection() as db:
                row = db.execute("SELECT name FROM products WHERE id=?", (product_id,)).fetchone()
                if not row:
                    self.send_api_error(404, "That product was not found.")
                    return
                db.execute("UPDATE products SET active=0,updated_at=? WHERE id=?", (now_utc(), product_id))
                record_audit(db, "Archived", "product", product_id, row["name"])
            self.send_json(200, {"ok": True, "archived": True})
        except Exception as exc:
            print(f"DELETE product failed: {type(exc).__name__}: {exc}", flush=True)
            self.send_api_error(500, "The product could not be archived. Please try again.")

    def auth_setup(self, payload: dict):
        password = payload.get("password")
        confirmation = payload.get("confirmPassword")
        if not isinstance(password, str) or len(password) < 12:
            self.send_api_error(400, "Choose a password with at least 12 characters.")
            return
        if len(password) > 256:
            self.send_api_error(400, "That password is too long.")
            return
        if not isinstance(confirmation, str) or not hmac.compare_digest(password, confirmation):
            self.send_api_error(400, "The passwords do not match.")
            return
        with self.server.setup_lock:
            with get_connection() as db:
                if db.execute("SELECT 1 FROM admins WHERE id=1").fetchone():
                    self.send_api_error(409, "Owner setup is already complete. Please sign in.")
                    return
                salt = secrets.token_bytes(16)
                password_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
                db.execute("INSERT INTO admins(id,salt,password_hash,created_at) VALUES (1,?,?,?)", (salt, password_hash, now_utc()))
                record_audit(db, "Created owner account", "admin", "owner", "First-time setup")
        self.create_session()
        self.send_json(201, {"ok": True, "user": "owner"}, {"Set-Cookie": self.cookie_header(self._new_session_token)})

    def auth_login(self, payload: dict):
        client = self.client_address[0]
        now = time.time()
        with self.server.login_lock:
            attempts, started = self.server.login_attempts.get(client, (0, now))
            if now - started > 15 * 60:
                attempts, started = 0, now
            if attempts >= 8:
                self.send_api_error(429, "Too many sign-in attempts. Wait 15 minutes and try again.")
                return
        password = payload.get("password")
        if not isinstance(password, str) or len(password) > 256:
            password = ""
        with get_connection() as db:
            admin = db.execute("SELECT salt,password_hash FROM admins WHERE id=1").fetchone()
        if not admin:
            self.send_api_error(409, "Create the owner account before signing in.")
            return
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), admin["salt"], PBKDF2_ROUNDS)
        if not hmac.compare_digest(candidate, admin["password_hash"]):
            with self.server.login_lock:
                previous, started = self.server.login_attempts.get(client, (0, now))
                if now - started > 15 * 60:
                    previous, started = 0, now
                self.server.login_attempts[client] = (previous + 1, started)
            self.send_api_error(401, "That password did not match. Please try again.")
            return
        with self.server.login_lock:
            self.server.login_attempts.pop(client, None)
        self.create_session()
        self.send_json(200, {"ok": True, "user": "owner"}, {"Set-Cookie": self.cookie_header(self._new_session_token)})

    def create_session(self):
        token = secrets.token_urlsafe(32)
        with self.server.sessions_lock:
            self.server.sessions[token] = time.time() + SESSION_TTL
        self._new_session_token = token

    def create_product(self, payload: dict):
        values = clean_product_payload(payload)
        base = re.sub(r"[^a-z0-9]+", "-", values["name"].lower()).strip("-")[:42] or "product"
        product_id = f"{base}-{uuid.uuid4().hex[:6]}"
        stamp = now_utc()
        with get_connection() as db:
            db.execute(
                """INSERT INTO products
                   (id,name,sku,category,description,details,price,stock,low_stock_threshold,
                    image,image_alt,badge,active,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (product_id, values["name"], values["sku"], values["category"], values["description"],
                 values["details"], values["price"], values["stock"], values["threshold"],
                 values["image"], values["image_alt"], values["badge"], int(values["active"]), stamp, stamp),
            )
            record_audit(db, "Created", "product", product_id, values["name"])
            row = db.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
        self.send_json(201, product_to_dict(row, admin=True))

    def update_product(self, product_id: str, payload: dict):
        with get_connection() as db:
            existing = db.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
            if not existing:
                self.send_api_error(404, "That product was not found.")
                return
            values = clean_product_payload(payload, existing)
            stamp = now_utc()
            db.execute(
                """UPDATE products SET name=?,sku=?,category=?,description=?,details=?,price=?,stock=?,
                   low_stock_threshold=?,image=?,image_alt=?,badge=?,active=?,updated_at=? WHERE id=?""",
                (values["name"], values["sku"], values["category"], values["description"], values["details"],
                 values["price"], values["stock"], values["threshold"], values["image"], values["image_alt"],
                 values["badge"], int(values["active"]), stamp, product_id),
            )
            record_audit(db, "Updated", "product", product_id, values["name"])
            row = db.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
        self.send_json(200, product_to_dict(row, admin=True))

    def adjust_inventory(self, product_id: str, payload: dict):
        delta = valid_int(payload.get("delta"), "Stock change", -1_000_000, 1_000_000)
        if delta == 0:
            raise ValueError("Enter a stock change other than zero.")
        with get_connection() as db:
            row = db.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
            if not row:
                self.send_api_error(404, "That product was not found.")
                return
            new_stock = row["stock"] + delta
            if new_stock < 0:
                raise ValueError("Stock cannot be less than zero.")
            db.execute("UPDATE products SET stock=?,updated_at=? WHERE id=?", (new_stock, now_utc(), product_id))
            change = f"{row['name']}: {row['stock']} → {new_stock}"
            record_audit(db, "Adjusted stock", "product", product_id, change)
            updated = db.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
        self.send_json(200, product_to_dict(updated, admin=True))

    def update_settings(self, payload: dict):
        limits = {"announcement": 180, "hero_description": 300, "about_description": 600, "support_email": 160}
        updates = {}
        for key, maximum in limits.items():
            if key in payload:
                updates[key] = valid_text(payload[key], key.replace("_", " ").title(), maximum)
        if "support_email" in updates and updates["support_email"]:
            if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", updates["support_email"]):
                raise ValueError("Enter a valid support email address, or leave it blank.")
        with get_connection() as db:
            for key, value in updates.items():
                db.execute("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
            record_audit(db, "Updated store settings", "settings", "store", ", ".join(updates.keys()))
            result = settings_dict(db)
        self.send_json(200, result)

    def update_order(self, order_id: str, payload: dict):
        fulfillment = payload.get("fulfillmentStatus")
        allowed = {"new", "processing", "packed", "shipped", "delivered", "cancelled", "returned"}
        if fulfillment not in allowed:
            raise ValueError("Choose a valid order status.")
        with get_connection() as db:
            order = db.execute("SELECT order_number FROM orders WHERE id=?", (order_id,)).fetchone()
            if not order:
                self.send_api_error(404, "That order was not found.")
                return
            db.execute("UPDATE orders SET fulfillment_status=?,updated_at=? WHERE id=?", (fulfillment, now_utc(), order_id))
            record_audit(db, "Updated order status", "order", order_id, f"{order['order_number']}: {fulfillment}")
            updated = db.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        self.send_json(200, dict(updated))


    def serve_forever(self):  # pragma: no cover - HTTPServer owns this method
        super().serve_forever()


class MarkettechServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Run the Markettech storefront preview and admin panel.")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "4173")))
    args = parser.parse_args()
    initialize_database()
    httpd = MarkettechServer((args.host, args.port), StoreHandler)
    httpd.sessions = {}
    httpd.sessions_lock = threading.Lock()
    httpd.setup_lock = threading.Lock()
    httpd.login_attempts = {}
    httpd.login_lock = threading.Lock()
    print(f"Markettech preview running at http://{args.host}:{args.port}", flush=True)
    print(f"SQLite data file: {DB_PATH}", flush=True)
    print("Open /admin.html to create the one-time owner account. The first setup locks after creation.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
