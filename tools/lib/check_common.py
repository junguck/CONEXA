"""Shared helpers for the repository guard scripts (F0.3).

Every guard reads the same sources of truth as the agents: `agents/ownership.yaml`
and the `owned_paths` of the task file. Output is meant for humans: one line per
problem, prefixed by the rule that failed.
"""
from __future__ import annotations

import fnmatch
import pathlib
import re
import subprocess
import sys

import yaml

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

def git(*args: str, cwd: pathlib.Path | None = None) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd or ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def _repo_root() -> pathlib.Path:
    try:
        top = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        ).stdout.strip()
        if top:
            return pathlib.Path(top)
    except OSError:
        pass
    return pathlib.Path(__file__).resolve().parent.parent.parent


ROOT = _repo_root()


def read_text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def load_yaml(path: pathlib.Path) -> dict:
    return yaml.safe_load(read_text(path))


def load_ownership(root: pathlib.Path = ROOT) -> dict:
    return load_yaml(root / "agents/ownership.yaml")


def task_frontmatter(path: pathlib.Path) -> dict:
    """Parse the YAML front matter of a task file (`---` ... `---`)."""
    text = read_text(path)
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end == -1:
        return {}
    return yaml.safe_load(text[4:end]) or {}


def task_paths_at(rev: str) -> list[str]:
    """Task files as they exist at a revision (the PR head, not the reviewer's tree)."""
    output = git("ls-tree", "-r", "--name-only", rev, "--", "tasks")
    return [path for path in output.splitlines() if re.match(r"tasks/T-\d{4}-.+\.md$", path)]


def task_frontmatter_at(rev: str, path: str) -> dict:
    text = git("show", f"{rev}:{path}")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    return (yaml.safe_load(text[4:end]) or {}) if end != -1 else {}


def find_task(branch: str, rev: str = "HEAD") -> str | None:
    """Resolve the task of a branch: `agent/<id>/T-0042-...` or a declared `branch:`."""
    paths = task_paths_at(rev)
    match = re.match(r"agent/[^/]+/(T-\d{4})-", branch)
    if match:
        candidates = [path for path in paths if path.startswith(f"tasks/{match.group(1)}-")]
        return sorted(candidates)[0] if candidates else None
    for path in paths:
        if task_frontmatter_at(rev, path).get("branch") == branch:
            return path
    return None


def matches_glob(path: str, pattern: str) -> bool:
    """Match a repository path against an ownership pattern.

    `dir/**` covers the directory itself and everything below it; other patterns
    are shell globs (fnmatch). Paths are normalized to forward slashes.
    """
    path = path.replace("\\", "/")
    pattern = pattern.replace("\\", "/")
    if pattern.endswith("/**"):
        base = pattern[:-3]
        return path == base or path.startswith(base + "/")
    return fnmatch.fnmatchcase(path, pattern)


def changed_files(base: str, head: str, working_tree: bool = False) -> list[tuple[str, str]]:
    """Return (status, path) for every change introduced by the branch.

    Uses the merge base so that commits already on `base` are never re-checked.
    """
    merge_base = git("merge-base", base, head).strip()
    if working_tree:
        diff = git("diff", "--name-status", "--find-renames", merge_base)
    else:
        diff = git("diff", "--name-status", "--find-renames", f"{merge_base}..{head}")
    changes: list[tuple[str, str]] = []
    for line in diff.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("R") and len(parts) >= 3:
            changes.append(("D", parts[1]))
            changes.append(("A", parts[2]))
        elif len(parts) >= 2:
            changes.append((status[0], parts[1]))
    if working_tree:
        seen = {path for _, path in changes}
        for path in git("ls-files", "--others", "--exclude-standard").splitlines():
            if path and path not in seen:
                changes.append(("A", path))
    return changes


def changed_frontmatter_keys(base: str, head: str, path: str) -> set[str]:
    """Keys whose frontmatter line changed in `path` between base and head."""
    merge_base = git("merge-base", base, head).strip()
    diff = git("diff", "-U0", f"{merge_base}..{head}", "--", path)
    keys: set[str] = set()
    for line in diff.splitlines():
        if not line.startswith(("+", "-")) or line.startswith(("+++", "---")):
            continue
        match = re.match(r"^[+-]([a-z_]+):", line)
        if match:
            keys.add(match.group(1))
    return keys


def current_branch() -> str:
    return git("rev-parse", "--abbrev-ref", "HEAD").strip()


def fail(messages: list[str]) -> int:
    for message in messages:
        print(f"ERREUR  {message}", file=sys.stderr)
    if messages:
        print(f"\n{len(messages)} problème(s). Voir tasks/T-0003-ci-et-garde-fous.md.", file=sys.stderr)
        return 1
    return 0


def report(ok_message: str, messages: list[str]) -> int:
    code = fail(messages)
    if not messages:
        print(ok_message)
    return code
