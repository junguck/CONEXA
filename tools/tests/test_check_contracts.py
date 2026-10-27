"""Tests du contrôle des contrats (T-0003)."""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

TOOL = pathlib.Path(__file__).resolve().parent.parent / "check-contracts.py"

EVENT = {
    "title": "embedding.computed",
    "type": "object",
    "required": ["eventId", "vector"],
    "properties": {
        "eventId": {"type": "string"},
        "vector": {"type": "array", "items": {"type": "number"}},
        "model": {"type": "string"},
    },
}


def run(cwd: pathlib.Path, *args: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    return subprocess.run(
        [sys.executable, str(TOOL), *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )


class Repo:
    def __init__(self, root: pathlib.Path) -> None:
        self.root = root
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "test@example.com")
        self.git("config", "user.name", "test")
        (root / "packages/events/src/ai").mkdir(parents=True)
        self.write("packages/events/src/ai/embedding.computed.v1.json", EVENT)
        self.commit("initial")
        self.git("branch", "origin/main")

    def write(self, path: str, payload: dict) -> None:
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    def git(self, *args: str) -> str:
        result = subprocess.run(["git", *args], cwd=self.root, capture_output=True, text=True, encoding="utf-8")
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        return result.stdout

    def commit(self, message: str) -> None:
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)


class ContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Repo(pathlib.Path(self.tmp.name))

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_added_optional_field_passes(self) -> None:
        changed = json.loads(json.dumps(EVENT))
        changed["properties"]["traceId"] = {"type": "string"}
        self.repo.write("packages/events/src/ai/embedding.computed.v1.json", changed)
        self.repo.commit("feat: optional field")
        result = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_removed_field_fails(self) -> None:
        changed = json.loads(json.dumps(EVENT))
        del changed["properties"]["model"]
        self.repo.write("packages/events/src/ai/embedding.computed.v1.json", changed)
        self.repo.commit("feat: remove field")
        result = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(result.returncode, 1)
        self.assertIn("model", result.stderr)
        self.assertIn("supprimé", result.stderr)

    def test_type_change_fails(self) -> None:
        changed = json.loads(json.dumps(EVENT))
        changed["properties"]["eventId"]["type"] = "number"
        self.repo.write("packages/events/src/ai/embedding.computed.v1.json", changed)
        self.repo.commit("feat: type")
        result = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(result.returncode, 1)
        self.assertIn("type changé", result.stderr)

    def test_new_required_field_fails(self) -> None:
        changed = json.loads(json.dumps(EVENT))
        changed["required"].append("model")
        self.repo.write("packages/events/src/ai/embedding.computed.v1.json", changed)
        self.repo.commit("feat: required")
        result = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(result.returncode, 1)
        self.assertIn("obligatoire", result.stderr)

    def test_removed_openapi_route_fails(self) -> None:
        openapi = {
            "openapi": "3.1.0",
            "info": {"title": "x", "version": "1"},
            "paths": {"/health": {"get": {"responses": {"200": {"description": "ok"}}}}},
        }
        self.repo.write("openapi.json", openapi)
        self.repo.commit("feat: openapi")
        broken = json.loads(json.dumps(openapi))
        broken["paths"] = {}
        self.repo.write("openapi.json", broken)
        self.repo.commit("feat: remove route")
        result = run(self.repo.root, "--base", "HEAD~1")
        self.assertEqual(result.returncode, 1)
        self.assertIn("route", result.stderr)


if __name__ == "__main__":
    unittest.main()
