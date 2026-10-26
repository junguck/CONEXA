"""Tests du contrôle de propriété (T-0003). Exécution : python3 -m unittest discover -s tools/tests"""
from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

TOOL = pathlib.Path(__file__).resolve().parent.parent / "check-ownership.py"

OWNERSHIP = """\
version: 1
agents:
  football:
    owns:
      - services/football/**
      - docs/domain/football.md
  platform:
    owns:
      - .github/**
      - tools/**
  orchestrator:
    owns:
      - agents/**
      - tasks/**
"""

TASK = """\
---
id: T-0042
agent: football
status: in_progress
owned_paths:
  - apps/web/src/features/football/**
branch: "agent/football/T-0042-elo"
worktree: ""
pr: ""
notes: ""
---

## Objectif
"""


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
        (root / "agents").mkdir()
        (root / "tasks").mkdir()
        (root / "agents/ownership.yaml").write_text(OWNERSHIP, encoding="utf-8")
        (root / "tasks/T-0042-elo.md").write_text(TASK, encoding="utf-8")
        (root / "services/football").mkdir(parents=True)
        (root / "services/football/elo.ts").write_text("export const elo = 1;\n", encoding="utf-8")
        self.commit("initial")
        self.git("branch", "origin/main")

    def git(self, *args: str) -> str:
        result = subprocess.run(
            ["git", *args], cwd=self.root, capture_output=True, text=True, encoding="utf-8"
        )
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        return result.stdout

    def commit(self, message: str) -> None:
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)


class OwnershipTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Repo(pathlib.Path(self.tmp.name))

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_owned_path_and_task_path_pass(self) -> None:
        (self.repo.root / "services/football/elo.ts").write_text("export const elo = 2;\n", encoding="utf-8")
        app = self.repo.root / "apps/web/src/features/football"
        app.mkdir(parents=True)
        (app / "screen.tsx").write_text("export {};\n", encoding="utf-8")
        (self.repo.root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n", encoding="utf-8")
        self.repo.commit("feat: elo")
        result = run(self.repo.root, "--base", "origin/main", "--branch", "agent/football/T-0042-elo")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("propriété OK", result.stdout)

    def test_generated_lockfile_is_always_allowed(self) -> None:
        (self.repo.root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n", encoding="utf-8")
        self.repo.commit("build: lockfile")
        result = run(self.repo.root, "--base", "origin/main", "--branch", "agent/football/T-0042-elo")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("propriété OK", result.stdout)

    def test_foreign_path_fails_with_agent_and_rule(self) -> None:
        (self.repo.root / "services/football/elo.ts").write_text("export const elo = 3;\n", encoding="utf-8")
        (self.repo.root / "package.json").write_text("{}\n", encoding="utf-8")
        self.repo.commit("feat: elo + root")
        result = run(self.repo.root, "--base", "origin/main", "--branch", "agent/football/T-0042-elo")
        self.assertEqual(result.returncode, 1)
        self.assertIn("package.json", result.stderr)
        self.assertIn("football", result.stderr)

    def test_task_file_editable_fields_pass_others_fail(self) -> None:
        task = self.repo.root / "tasks/T-0042-elo.md"
        task.write_text(TASK.replace("status: in_progress", "status: review"), encoding="utf-8")
        self.repo.commit("chore: status")
        ok = run(self.repo.root, "--base", "origin/main", "--branch", "agent/football/T-0042-elo")
        self.assertEqual(ok.returncode, 0, ok.stderr)

        task.write_text(task.read_text(encoding="utf-8").replace("agent: football", "agent: platform"), encoding="utf-8")
        self.repo.commit("chore: agent")
        bad = run(self.repo.root, "--base", "origin/main", "--branch", "agent/football/T-0042-elo")
        self.assertEqual(bad.returncode, 1)
        self.assertIn("agent", bad.stderr)

    def test_task_owned_path_extends_agent_paths(self) -> None:
        task = self.repo.root / "tasks/T-0042-elo.md"
        task.write_text(TASK.replace("branch: \"agent/football/T-0042-elo\"", "branch: \"v1/football\""), encoding="utf-8")
        self.repo.commit("chore: branch")
        (self.repo.root / "apps/web/src/features/football").mkdir(parents=True)
        (self.repo.root / "apps/web/src/features/football/nav.ts").write_text("export {};\n", encoding="utf-8")
        self.repo.commit("feat: nav")
        result = run(self.repo.root, "--base", "origin/main", "--branch", "v1/football")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_task_fails(self) -> None:
        (self.repo.root / "services/football/lib.ts").write_text("export {};\n", encoding="utf-8")
        self.repo.commit("feat: lib")
        result = run(self.repo.root, "--base", "origin/main", "--branch", "agent/football/T-9999-nope")
        self.assertEqual(result.returncode, 1)
        self.assertIn("aucune tâche", result.stderr)


if __name__ == "__main__":
    unittest.main()
