import os
import sqlite3
import tempfile
import unittest

from werkzeug.security import generate_password_hash

from app import app
from routes import auth as auth_routes
from login_limit import _failures


class LoginLimitTests(unittest.TestCase):
    def setUp(self):
        fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)

        self.original_get_db = auth_routes.get_db
        auth_routes.get_db = self.get_test_db
        _failures.clear()

        conn = self.get_test_db()
        conn.execute("""
            CREATE TABLE people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT,
                password_hash TEXT,
                role TEXT NOT NULL DEFAULT 'user'
            )
        """)

        conn.executemany("""
            INSERT INTO people
                (first_name, last_name, email, password_hash)
            VALUES (?, ?, ?, ?)
        """, [
            ("Alice", "Test", "alice@example.com",
             generate_password_hash("AlicePassword123")),
            ("Bob", "Test", "bob@example.com",
             generate_password_hash("BobPassword123")),
        ])
        conn.commit()
        conn.close()

        app.config["TESTING"] = True
        self.client = app.test_client()

    def tearDown(self):
        auth_routes.get_db = self.original_get_db
        _failures.clear()
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def get_test_db(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def login(self, email, password):
        return self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )

    def test_five_failures_then_429_and_correct_password_blocked(self):
        for _ in range(5):
            self.assertEqual(
                self.login("alice@example.com", "wrong-password").status_code,
                401,
            )

        response = self.login("alice@example.com", "wrong-password")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json["error"], "Too many attempts")
        self.assertGreater(int(response.headers["Retry-After"]), 0)

        response = self.login("alice@example.com", "AlicePassword123")
        self.assertEqual(response.status_code, 429)

    def test_successful_login_resets_counter(self):
        for _ in range(4):
            self.assertEqual(
                self.login("alice@example.com", "wrong-password").status_code,
                401,
            )

        self.assertEqual(
            self.login("alice@example.com", "AlicePassword123").status_code,
            200,
        )

        for _ in range(5):
            self.assertEqual(
                self.login("alice@example.com", "wrong-password").status_code,
                401,
            )

        self.assertEqual(
            self.login("alice@example.com", "wrong-password").status_code,
            429,
        )

    def test_blocking_one_account_does_not_affect_another(self):
        for _ in range(5):
            self.assertEqual(
                self.login("alice@example.com", "wrong-password").status_code,
                401,
            )

        self.assertEqual(
            self.login("alice@example.com", "wrong-password").status_code,
            429,
        )
        self.assertEqual(
            self.login("bob@example.com", "BobPassword123").status_code,
            200,
        )


if __name__ == "__main__":
    unittest.main()
