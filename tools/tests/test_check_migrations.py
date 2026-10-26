"""Tests du contrôle des migrations (T-0003)."""
from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

TOOL = pathlib.Path(__file__).resolve().parent.parent / "check-migrations.py"


def run(cwd: pathlib.Path, *args: str, env: dict | None = None) -> subprocess.CompletedProcess:
    merged = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", **(env or {})}
    return subprocess.run(
        [sys.executable, str(TOOL), *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=merged,
    )


class Repo:
    def __init__(self, root: pathlib.Path) -> None:
        self.root = root
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "test@example.com")
        self.git("config", "user.name", "test")
        (root / "db/migrations/identity").mkdir(parents=True)
        (root / "db/migrations/identity/202601010900_init.sql").write_text("create table identity.users (id uuid);\n", encoding="utf-8")
        self.commit("initial")
        self.git("branch", "origin/main")

    def git(self, *args: str) -> str:
        result = subprocess.run(["git", *args], cwd=self.root, capture_output=True, text=True, encoding="utf-8")
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        return result.stdout

    def commit(self, message: str) -> None:
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)


class MigrationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Repo(pathlib.Path(self.tmp.name))

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_timestamped_migration_passes(self) -> None:
        (self.repo.root / "db/migrations/identity/202601020900_add_phone.sql").write_text("alter table identity.users add column phone text;\n", encoding="utf-8")
        self.repo.commit("feat: migration")
        result = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_non_timestamped_name_fails(self) -> None:
        (self.repo.root / "db/migrations/identity/0002_add_phone.sql").write_text("select 1;\n", encoding="utf-8")
        self.repo.commit("feat: migration")
        result = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(result.returncode, 1)
        self.assertIn("nom non horodaté", result.stderr)

    def test_modified_merged_migration_fails(self) -> None:
        (self.repo.root / "db/migrations/identity/202601010900_init.sql").write_text("create table identity.users (id uuid, x int);\n", encoding="utf-8")
        self.repo.commit("fix: migration")
        result = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(result.returncode, 1)
        self.assertIn("déjà fusionnée", result.stderr)

    def test_destructive_statement_needs_human(self) -> None:
        (self.repo.root / "db/migrations/identity/202601020900_drop.sql").write_text("drop table identity.users;\n", encoding="utf-8")
        self.repo.commit("feat: migration")
        blocked = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(blocked.returncode, 1)
        self.assertIn("destructrice", blocked.stderr)
        allowed = run(self.repo.root, "--base", "origin/main", env={"ALLOW_DESTRUCTIVE": "1"})
        self.assertEqual(allowed.returncode, 0, allowed.stderr)

    def test_backdated_migration_fails(self) -> None:
        (self.repo.root / "db/migrations/identity/202512010900_old.sql").write_text("select 1;\n", encoding="utf-8")
        self.repo.commit("feat: migration")
        result = run(self.repo.root, "--base", "origin/main")
        self.assertEqual(result.returncode, 1)
        self.assertIn("antérieur", result.stderr)


if __name__ == "__main__":
    unittest.main()
