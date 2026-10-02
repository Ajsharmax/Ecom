"""Smoke tests for the local SQLite-backed owner admin API."""

import json
import tempfile
import threading
import unittest
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

import server as store_server


class AdminApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        store_server.DB_PATH = Path(cls.temp_dir.name) / "markettech-test.sqlite3"
        store_server.initialize_database()
        cls.httpd = store_server.MarkettechServer(("127.0.0.1", 0), store_server.StoreHandler)
        cls.httpd.sessions = {}
        cls.httpd.sessions_lock = threading.Lock()
        cls.httpd.setup_lock = threading.Lock()
        cls.httpd.login_attempts = {}
        cls.httpd.login_lock = threading.Lock()
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.httpd.server_port}"
        cls.opener = build_opener(HTTPCookieProcessor(CookieJar()))

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=3)
        cls.temp_dir.cleanup()

    def request(self, path, method="GET", payload=None, expected=200):
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"} if body is not None else {}
        request = Request(self.base_url + path, data=body, method=method, headers=headers)
        try:
            response = self.opener.open(request, timeout=5)
            status, contents = response.status, response.read()
        except HTTPError as error:
            status, contents = error.code, error.read()
        self.assertEqual(status, expected, contents.decode("utf-8", errors="replace"))
        return json.loads(contents) if contents else {}

    def test_owner_setup_catalog_inventory_and_settings(self):
        self.assertTrue(self.request("/api/health")["ok"])
        self.assertEqual(len(self.request("/api/products")), 6)
        self.request("/api/admin/products", expected=401)
        self.assertTrue(self.request("/api/auth/status")["setupRequired"])
        self.request(
            "/api/auth/setup", "POST",
            {"password": "short", "confirmPassword": "short"}, expected=400,
        )

        password = "test-only-owner-password-39"
        self.request(
            "/api/auth/setup", "POST",
            {"password": password, "confirmPassword": password}, expected=201,
        )
        self.assertTrue(self.request("/api/auth/me")["authenticated"])
        self.assertEqual(self.request("/api/admin/summary")["products"], 6)

        product = {
            "name": "Test Storage Box", "sku": "TEST-001", "category": "Storage",
            "description": "A test product", "details": "Temporary test listing",
            "price": 1200, "stock": 2, "lowStockThreshold": 2,
            "image": "assets/product-basket.jpg", "imageAlt": "Test product image",
            "badge": "TEST ITEM", "active": True,
        }
        created = self.request("/api/admin/products", "POST", product, expected=201)
        product_id = created["id"]
        self.assertEqual(created["stock"], 2)
        self.request("/api/admin/products", "POST", product, expected=409)

        adjusted = self.request(
            f"/api/admin/inventory/{product_id}", "POST", {"delta": -1}
        )
        self.assertEqual(adjusted["stock"], 1)
        self.request(
            f"/api/admin/inventory/{product_id}", "POST", {"delta": -5}, expected=400
        )
        updated = self.request(
            f"/api/admin/products/{product_id}", "PUT", {**product, "price": 1350, "stock": 4}
        )
        self.assertEqual(updated["price"], 1350)
        self.assertEqual(updated["stock"], 4)

        settings = self.request(
            "/api/admin/settings", "PUT",
            {"announcement": "Owner-managed preview", "support_email": "hello@example.com"},
        )
        self.assertEqual(settings["announcement"], "Owner-managed preview")
        self.assertEqual(self.request("/api/store-settings")["support_email"], "hello@example.com")

        self.request(f"/api/admin/products/{product_id}", "DELETE")
        public_ids = {item["id"] for item in self.request("/api/products")}
        self.assertNotIn(product_id, public_ids)
        self.request("/api/auth/logout", "POST", {})
        self.assertFalse(self.request("/api/auth/me")["authenticated"])
        self.request("/api/admin/products", expected=401)


if __name__ == "__main__":
    unittest.main()
