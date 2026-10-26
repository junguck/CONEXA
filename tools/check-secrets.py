#!/usr/bin/env python3
"""Fast local secret scan, complementary to gitleaks in CI.

Looks for high-signal credentials in the working tree (private keys, cloud and
GitHub tokens, generic long secret assignments) and never prints the value.
gitleaks remains the authority for git history; this script fails a pull request
before CI when an obvious credential is committed.

A reviewed false positive is marked `pragma: allowlist secret` or
`gitleaks:allow` on the same line.

Usage:
  python3 tools/check-secrets.py [--root .]
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "lib"))

from check_common import ROOT, report  # noqa: E402

IGNORED = {
    ".git", "node_modules", "dist", ".next", ".turbo", "coverage", "__pycache__",
    ".venv", ".pgdata", "docs", "tasks", "agents",
}
TEXT_SUFFIXES = {
    "", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yaml", ".yml", ".toml",
    ".sql", ".md", ".env", ".example", ".sh", ".py", ".config", ".ini", ".pem",
    ".key", ".crt", ".txt", ".cfg", ".xml", ".properties",
}
PATTERNS = [
    ("clé privée", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("jeton AWS", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("jeton GitHub", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b")),
    ("jeton Slack", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("clé API", re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
    (
        "affectation de secret",
        re.compile(
            r"\b(?:api[_-]?key|client[_-]?secret|secret[_-]?key|access[_-]?token|refresh[_-]?token|"
            r"password|passwd|private[_-]?key)\b\s*[:=]\s*['\"](?P<value>[^'\"]{12,})['\"]",
            re.IGNORECASE,
        ),
    ),
]
PLACEHOLDER = re.compile(
    r"(example|placeholder|changeme|change_me|dummy|fake|sample|your[_-]|xxx+|<[^>]+>|\$\{|\{\{|"
    r"conexa_dev|dev_only|localhost)",
    re.IGNORECASE,
)
ALLOW = re.compile(r"(?:pragma:\s*allowlist secret|gitleaks:allow)", re.IGNORECASE)


def candidates(root: pathlib.Path):
    for directory, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(name for name in dirnames if name not in IGNORED)
        for name in filenames:
            file = pathlib.Path(directory, name)
            if file.suffix.lower() not in TEXT_SUFFIXES and name not in {".npmrc", ".gitignore"}:
                continue
            yield file


def scan(root: pathlib.Path) -> list[str]:
    errors: list[str] = []
    for file in candidates(root):
        try:
            text = file.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        relative = file.relative_to(root).as_posix()
        for number, line in enumerate(text.splitlines(), 1):
            if ALLOW.search(line):
                continue
            for label, pattern in PATTERNS:
                match = pattern.search(line)
                if not match:
                    continue
                value = match.groupdict().get("value")
                if value and PLACEHOLDER.search(value):
                    continue
                errors.append(f"{relative}:{number} : {label} détecté (valeur non affichée) — révoquer et déplacer dans un secret")
                break
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    errors = scan(pathlib.Path(args.root).resolve())
    return report("secrets OK · aucun secret détecté dans l'arbre de travail", errors)


if __name__ == "__main__":
    sys.exit(main())
