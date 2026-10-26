#!/usr/bin/env python3
"""Guard the database migrations: naming, order, immutability, danger.

Rules (agents/GIT_WORKFLOW.md §8):
 - one directory per schema: `db/migrations/<schema>/`;
 - a timestamped, forward-only name: `YYYYMMDDHHMM_description.sql`;
 - a merged migration is never modified or deleted — write a new one;
 - a destructive statement needs the `human-ok` review, passed here as
   `ALLOW_DESTRUCTIVE=1`.

Usage:
  python3 tools/check-migrations.py [--base origin/main] [--head HEAD] [--working-tree]
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "lib"))

from check_common import ROOT, changed_files, git, report  # noqa: E402

NAME = re.compile(r"^(?P<stamp>\d{12})_[a-z0-9]+(?:[-_][a-z0-9]+)*\.sql$")
SCHEMA = re.compile(r"^[a-z][a-z0-9_]*$")
DESTRUCTIVE = re.compile(
    r"\b(drop\s+(table|column|schema|type|constraint|index)|truncate\b|"
    r"alter\s+column\s+\S+\s+type\b|delete\s+from\b)",
    re.IGNORECASE,
)


def migrations_at(base: str) -> dict[str, str]:
    """Map path -> content at a git revision."""
    paths = git("ls-tree", "-r", "-z", "--name-only", base, "--", "db/migrations")
    result: dict[str, str] = {}
    for path in filter(None, paths.split("\0")):
        if path.endswith(".sql"):
            result[path] = git("show", f"{base}:{path}")
    return result


def migrations_worktree(root: pathlib.Path) -> dict[str, str]:
    result: dict[str, str] = {}
    base = root / "db/migrations"
    if base.exists():
        for file in sorted(base.glob("*/*.sql")):
            result[file.relative_to(root).as_posix()] = file.read_text(encoding="utf-8")
    return result


def schema_of(path: str) -> str:
    parts = path.split("/")
    return parts[2] if len(parts) > 3 else ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--working-tree", action="store_true")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    root = pathlib.Path(args.root).resolve()

    base = migrations_at(args.base)
    head = migrations_worktree(root) if args.working_tree else migrations_at(args.head)
    changes = [(status, path) for status, path in changed_files(args.base, args.head, args.working_tree)
               if path.startswith("db/migrations/")]
    errors: list[str] = []

    for status, path in changes:
        if path in base and status in {"M", "D"}:
            errors.append(f"{path} : une migration déjà fusionnée ne se modifie ni ne se supprime (nouvelle migration à la place)")
        if status == "A" and path in head:
            name = path.rsplit("/", 1)[-1]
            schema = schema_of(path)
            if not SCHEMA.match(schema):
                errors.append(f"{path} : schéma invalide « {schema} » (minuscules, chiffres, _)")
            if not NAME.match(name):
                errors.append(f"{path} : nom non horodaté ; attendu YYYYMMDDHHMM_description.sql")

    for path, content in head.items():
        if path not in base and DESTRUCTIVE.search(content) and os.environ.get("ALLOW_DESTRUCTIVE") != "1":
            errors.append(
                f"{path} : instruction destructrice détectée ; exige la revue human-ok "
                "(relancer avec ALLOW_DESTRUCTIVE=1 une fois validée)"
            )

    for schema in sorted({schema_of(path) for path in head}):
        files = sorted(path.rsplit("/", 1)[-1] for path in head if schema_of(path) == schema)
        stamps = [m.group("stamp") for name in files if (m := NAME.match(name))]
        if stamps != sorted(set(stamps)):
            errors.append(f"{schema} : ordre des migrations incohérent ou horodatage dupliqué ({', '.join(files)})")
        newest_base = max(
            (int(m.group("stamp")) for path in base if schema_of(path) == schema
             for m in [NAME.match(path.rsplit("/", 1)[-1])] if m),
            default=0,
        )
        for path in (p for p in head if schema_of(p) == schema and p not in base):
            match = NAME.match(path.rsplit("/", 1)[-1])
            if match and int(match.group("stamp")) < newest_base:
                errors.append(f"{path} : horodatage antérieur à la dernière migration fusionnée de {schema}")

    if not changes:
        print("aucune migration modifiée")
    return report(f"migrations OK · {len(changes)} changement(s) · {len(head)} fichier(s)", errors)


if __name__ == "__main__":
    sys.exit(main())
