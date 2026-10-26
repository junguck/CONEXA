#!/usr/bin/env python3
"""Refuse log statements that may carry personal data.

Scans TypeScript/JavaScript/Python sources for logger or console calls whose
arguments mention a sensitive field (WhatsApp number, matricule, OTP, MoMo
number, token, password) without passing through a masking helper.

This is a static heuristic: it complements, and does not replace, the runtime
masking tests of the services. A reviewed exception is marked on the line with
`// pii-check: ignore` (or `# pii-check: ignore` in Python).

Usage:
  python3 tools/check-pii-logs.py [--root .]
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "lib"))

from check_common import ROOT, report  # noqa: E402

SOURCES = ("services", "packages", "apps", "db")
SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".cjs", ".py"}
IGNORED = {"node_modules", "dist", ".next", ".turbo", "coverage", "__pycache__", ".venv"}
LOG_CALL = re.compile(
    r"(?:\bconsole\.(?:log|info|warn|error|debug|trace)|\b(?:this\.)?(?:logger|log|req\.log)\."
    r"(?:info|warn|error|debug|trace|fatal)|\bpino\()",
)
SENSITIVE = re.compile(
    r"\b(phone|phone_number|whatsapp|msisdn|matricule|student_id|momo|momo_number|otp|pin|"
    r"password|passwd|secret|token|access_token|refresh_token|authorization|cookie)\b",
    re.IGNORECASE,
)
MASKED = re.compile(r"\b(?:mask|redact|hash|sha256|hmac|fingerprint)\w*", re.IGNORECASE)
ALLOW = re.compile(r"(?://|#)\s*pii-check:\s*ignore")


def log_block(lines: list[str], start: int) -> tuple[str, int]:
    """Return the call text starting at `start` and the number of lines it spans."""
    depth = 0
    seen_open = False
    block: list[str] = []
    for index in range(start, min(len(lines), start + 30)):
        line = lines[index]
        block.append(line)
        for char in line:
            if char == "(":
                depth += 1
                seen_open = True
            elif char == ")":
                depth -= 1
        if not seen_open:
            return "\n".join(block), 1
        if depth <= 0:
            return "\n".join(block), index - start + 1
    return "\n".join(block), len(block)


def scan(root: pathlib.Path) -> list[str]:
    errors: list[str] = []
    for top in SOURCES:
        base = root / top
        if not base.exists():
            continue
        for directory, dirnames, filenames in os.walk(base):
            dirnames[:] = sorted(name for name in dirnames if name not in IGNORED)
            for name in sorted(filenames):
                file = pathlib.Path(directory, name)
                if file.suffix not in SUFFIXES:
                    continue
                relative = file.relative_to(root).as_posix()
                try:
                    lines = file.read_text(encoding="utf-8").splitlines()
                except (UnicodeDecodeError, OSError):
                    continue
                index = 0
                while index < len(lines):
                    line = lines[index]
                    if not LOG_CALL.search(line) or ALLOW.search(line):
                        index += 1
                        continue
                    block, span = log_block(lines, index)
                    if not ALLOW.search(block) and SENSITIVE.search(block) and not MASKED.search(block):
                        fields = sorted({m.group(0) for m in SENSITIVE.finditer(block)})
                        errors.append(
                            f"{relative}:{index + 1} : journal potentiellement porteur de PII ({', '.join(fields)}) "
                            "sans masquage — masquer la valeur ou justifier avec « pii-check: ignore »"
                        )
                    index += span
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    errors = scan(pathlib.Path(args.root).resolve())
    return report(f"PII OK · aucun journal sensible détecté", errors)


if __name__ == "__main__":
    sys.exit(main())
