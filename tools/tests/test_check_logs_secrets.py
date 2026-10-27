"""Tests des gardes PII et secrets (T-0003)."""
from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

PII = pathlib.Path(__file__).resolve().parent.parent / "check-pii-logs.py"
SECRETS = pathlib.Path(__file__).resolve().parent.parent / "check-secrets.py"


def run(tool: pathlib.Path, root: pathlib.Path) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    return subprocess.run(
        [sys.executable, str(tool), "--root", str(root)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )


class PiiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        (self.root / "services/identity/src").mkdir(parents=True)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, content: str) -> None:
        (self.root / "services/identity/src/auth.ts").write_text(content, encoding="utf-8")

    def test_phone_in_log_fails(self) -> None:
        self.write("logger.info({ phone }, 'otp sent');\n")
        result = run(PII, self.root)
        self.assertEqual(result.returncode, 1)
        self.assertIn("phone", result.stderr)

    def test_multiline_object_fails(self) -> None:
        self.write("logger.info({\n  userId: user.id,\n  matricule: user.matricule,\n}, 'login');\n")
        result = run(PII, self.root)
        self.assertEqual(result.returncode, 1)
        self.assertIn("matricule", result.stderr)

    def test_masked_value_passes(self) -> None:
        self.write("logger.info({ phone: maskPhone(phone) }, 'otp sent');\n")
        self.assertEqual(run(PII, self.root).returncode, 0)

    def test_explicit_ignore_passes(self) -> None:
        self.write("logger.info({ phone }, 'raw'); // pii-check: ignore\n")
        self.assertEqual(run(PII, self.root).returncode, 0)

    def test_clean_log_passes(self) -> None:
        self.write("logger.info({ userId: user.id }, 'ok');\n")
        self.assertEqual(run(PII, self.root).returncode, 0)


class SecretTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, name: str, content: str) -> None:
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def test_fake_github_token_fails_without_value(self) -> None:
        token = "ghp_" + "A" * 36
        self.write("deploy/config.ts", f'const token = "{token}";\n')
        result = run(SECRETS, self.root)
        self.assertEqual(result.returncode, 1)
        self.assertIn("jeton GitHub", result.stderr)
        self.assertNotIn(token, result.stderr)

    def test_private_key_fails(self) -> None:
        self.write("deploy/key.pem", "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n")  # gitleaks:allow
        result = run(SECRETS, self.root)
        self.assertEqual(result.returncode, 1)
        self.assertIn("clé privée", result.stderr)

    def test_placeholder_passes(self) -> None:
        self.write(".env.example", 'CAMPAPP_API_KEY="changeme"\nAPI_KEY="your_key_here"\n')
        self.assertEqual(run(SECRETS, self.root).returncode, 0)

    def test_allowlist_marker_passes(self) -> None:
        self.write("tests/fixture.ts", 'const token = "ghp_' + "A" * 36 + '"; // gitleaks:allow\n')
        self.assertEqual(run(SECRETS, self.root).returncode, 0)


if __name__ == "__main__":
    unittest.main()
