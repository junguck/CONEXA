#!/usr/bin/env python3
"""Refuse a change that touches a path outside the author's ownership.

Sources of truth: `agents/ownership.yaml` (agent globs) and the `owned_paths`
of the branch's task file. The task file itself is the only shared file an
agent may touch, and only through `status`, `branch`, `worktree`, `pr`, `notes`.

Usage:
  python3 tools/check-ownership.py                      # branch vs origin/main
  python3 tools/check-ownership.py --working-tree       # include uncommitted work
  python3 tools/check-ownership.py --base main --head HEAD
  python3 tools/check-ownership.py --branch agent/football/T-0042-elo
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "lib"))

from check_common import (  # noqa: E402
    ROOT,
    changed_files,
    changed_frontmatter_keys,
    current_branch,
    find_task,
    load_ownership,
    matches_glob,
    report,
    task_frontmatter,
    task_frontmatter_at,
)

TASK_EDITABLE_FIELDS = {"status", "branch", "worktree", "pr", "notes"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--branch", default=None)
    parser.add_argument("--agent", default=None)
    parser.add_argument("--task", default=None)
    parser.add_argument("--working-tree", action="store_true")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()

    root = pathlib.Path(args.root).resolve()
    branch = args.branch or current_branch()
    task_path: str | None = None
    if args.task:
        task_path = args.task.replace("\\", "/")
        if not (root / task_path).exists():
            return report("", [f"tâche introuvable : {args.task}"])
    else:
        task_path = find_task(branch, args.head)

    agent = args.agent
    if agent is None:
        match = re.match(r"agent/([^/]+)/", branch)
        agent = match.group(1) if match else None

    errors: list[str] = []
    task_meta: dict = {}
    if task_path:
        try:
            task_meta = task_frontmatter_at(args.head, task_path)
        except RuntimeError:
            task_meta = task_frontmatter(root / task_path)
    if agent is None:
        agent = task_meta.get("agent")
    if agent is None:
        return report("", [f"impossible de déduire l'agent de la branche « {branch} » (utiliser --agent)"])

    ownership = load_ownership(root)
    agents = ownership.get("agents", {})
    if agent not in agents:
        return report("", [f"agent inconnu dans agents/ownership.yaml : {agent}"])

    task_id = task_meta.get("id")
    if task_path is None:
        errors.append(
            f"aucune tâche pour la branche « {branch} » : une branche = une tâche "
            "(nommer agent/<agent>/T-xxxx-… ou déclarer branch: dans la tâche)"
        )
    elif task_meta.get("agent") != agent:
        errors.append(
            f"la tâche {task_id or task_path.name} appartient à « {task_meta.get('agent')} », "
            f"mais la branche est celle de « {agent} »"
        )

    patterns = list(agents[agent].get("owns", []))
    patterns += list(task_meta.get("owned_paths") or [])
    if not patterns:
        errors.append(f"aucun chemin autorisé pour {agent} (ownership.yaml + owned_paths)")

    changes = changed_files(args.base, args.head, working_tree=args.working_tree)
    task_status = next((status for status, path in changes if path == task_path), None)
    checked = 0
    for status, raw_path in changes:
        path = raw_path.replace("\\", "/")
        checked += 1
        if task_path is not None and path == task_path:
            if not args.working_tree and task_status != "A":
                illegal = changed_frontmatter_keys(args.base, args.head, path) - TASK_EDITABLE_FIELDS
                if illegal:
                    errors.append(
                        f"{path} : champs de tâche interdits modifiés ({', '.join(sorted(illegal))}) ; "
                        f"seuls {', '.join(sorted(TASK_EDITABLE_FIELDS))} sont autorisés"
                    )
            continue
        if not any(matches_glob(path, pattern) for pattern in patterns):
            errors.append(
                f"{path} ({status}) n'est pas dans les chemins de « {agent} » ni de {task_id or task_path}"
                f" — chemins autorisés : {', '.join(patterns)}"
            )

    if not changes:
        print("aucun fichier modifié")
        return 0
    return report(
        f"propriété OK · {agent} · {task_id or 'sans tâche'} · {checked} fichier(s) · {branch}",
        errors,
    )


if __name__ == "__main__":
    sys.exit(main())
