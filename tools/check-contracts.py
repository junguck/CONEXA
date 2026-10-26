#!/usr/bin/env python3
"""Refuse a breaking change to a published contract.

Contracts are OpenAPI documents (`openapi*.json|yaml`) and event JSON Schemas
(`packages/events/src/**/*.json`, one file per event). Only compatible changes
are allowed: new optional fields, new endpoints, new enum values. Removing a
field, an operation, a status code or an enum value, changing a type, or making
a field required is breaking.

`oasdiff` is used for OpenAPI when it is installed (as in CI); a dependency-free
structural check covers the cases it does not and all event schemas.

Usage:
  python3 tools/check-contracts.py [--base origin/main] [--head HEAD] [--working-tree]
"""
from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "lib"))

from check_common import ROOT, changed_files, git, report  # noqa: E402


def is_contract(path: str) -> bool:
    name = path.rsplit("/", 1)[-1]
    return (
        (name.startswith("openapi") and name.endswith((".json", ".yaml", ".yml")))
        or (path.startswith("packages/events/src/") and path.endswith(".json"))
    )


def files_at(base: str) -> dict[str, str]:
    paths = git("ls-tree", "-r", "-z", "--name-only", base).split("\0")
    return {path: git("show", f"{base}:{path}") for path in filter(None, paths) if is_contract(path)}


def files_worktree(root: pathlib.Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for top in ("packages/events/src", "."):
        base_dir = root / top
        if not base_dir.exists():
            continue
        candidates = base_dir.rglob("*") if top == "packages/events/src" else base_dir.glob("openapi*")
        for file in candidates:
            if file.is_file() and "node_modules" not in file.parts:
                path = file.relative_to(root).as_posix()
                if is_contract(path):
                    result[path] = file.read_text(encoding="utf-8")
    return result


def parse(path: str, text: str) -> object:
    return json.loads(text) if path.endswith(".json") else yaml.safe_load(text)


def schema_errors(old: object, new: object, where: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(old, dict) or not isinstance(new, dict):
        if old != new:
            errors.append(f"{where} : définition modifiée de façon incompatible")
        return errors

    old_type, new_type = old.get("type"), new.get("type")
    if old_type and new_type and old_type != new_type:
        errors.append(f"{where} : type changé ({old_type} → {new_type})")
    if isinstance(old_type, list):
        removed = set(old_type) - set(new_type if isinstance(new_type, list) else [new_type])
        if removed:
            errors.append(f"{where} : type(s) retiré(s) ({', '.join(sorted(removed))})")

    old_props = old.get("properties") or {}
    new_props = new.get("properties") or {}
    for name in old_props:
        if name not in new_props:
            errors.append(f"{where} : champ « {name} » supprimé")
        else:
            errors += schema_errors(old_props[name], new_props[name], f"{where}.{name}")

    old_required = set(old.get("required") or [])
    new_required = set(new.get("required") or [])
    for name in sorted(new_required - old_required):
        errors.append(f"{where} : champ « {name} » devient obligatoire")

    old_enum = old.get("enum")
    new_enum = new.get("enum")
    if isinstance(old_enum, list):
        removed = [value for value in old_enum if value not in (new_enum or [])]
        if removed:
            errors.append(f"{where} : valeur(s) d'énumération retirée(s) ({removed})")

    for keyword in ("items", "additionalProperties"):
        if keyword in old:
            errors += schema_errors(old[keyword], new.get(keyword), f"{where}.{keyword}")
    if "oneOf" in old or "anyOf" in old:
        keyword = "oneOf" if "oneOf" in old else "anyOf"
        if len(new.get(keyword) or []) < len(old[keyword]):
            errors.append(f"{where} : variante retirée de {keyword}")
    return errors


def content_errors(old: dict, new: dict, where: str) -> list[str]:
    errors: list[str] = []
    for media, old_media in (old.get("content") or {}).items():
        new_media = (new.get("content") or {}).get(media)
        if new_media is None:
            errors.append(f"{where} : média « {media} » supprimé")
        else:
            errors += schema_errors(old_media.get("schema"), new_media.get("schema"), f"{where} [{media}]")
    return errors


def openapi_errors(old: dict, new: dict, path: str) -> list[str]:
    errors: list[str] = []
    old_paths, new_paths = old.get("paths") or {}, new.get("paths") or {}
    for route, old_item in old_paths.items():
        if route not in new_paths:
            errors.append(f"{path} : route « {route} » supprimée")
            continue
        new_item = new_paths[route] or {}
        for method, old_op in (old_item or {}).items():
            if not isinstance(old_op, dict) or method.startswith("x-") or method == "parameters":
                continue
            if method not in new_item:
                errors.append(f"{path} : opération {method.upper()} {route} supprimée")
                continue
            new_op = new_item[method] or {}
            if "requestBody" in old_op and "requestBody" not in new_op:
                errors.append(f"{path} : corps de requête supprimé sur {method.upper()} {route}")
            old_params = {(p.get("name"), p.get("in")): p for p in old_op.get("parameters") or []}
            new_params = {(p.get("name"), p.get("in")): p for p in new_op.get("parameters") or []}
            for key in old_params:
                if key not in new_params:
                    errors.append(f"{path} : paramètre {key[0]} ({key[1]}) supprimé de {method.upper()} {route}")
                else:
                    errors += schema_errors(
                        old_params[key].get("schema"), new_params[key].get("schema"),
                        f"{path} {method.upper()} {route} paramètre {key[0]}",
                    )
            for key, new_param in new_params.items():
                if key not in old_params and new_param.get("required"):
                    errors.append(f"{path} : paramètre {key[0]} ({key[1]}) ajouté obligatoire sur {method.upper()} {route}")
            old_responses, new_responses = old_op.get("responses") or {}, new_op.get("responses") or {}
            for code in old_responses:
                if code not in new_responses:
                    errors.append(f"{path} : réponse {code} supprimée sur {method.upper()} {route}")
                else:
                    errors += content_errors(
                        old_responses[code], new_responses[code], f"{path} {method.upper()} {route} → {code}"
                    )
            if "requestBody" in old_op and "requestBody" in new_op:
                errors += content_errors(
                    old_op["requestBody"], new_op["requestBody"], f"{path} {method.upper()} {route} corps"
                )
    for name, old_schema in (old.get("components", {}).get("schemas") or {}).items():
        new_schema = (new.get("components", {}).get("schemas") or {}).get(name)
        if new_schema is None:
            errors.append(f"{path} : composant « {name} » supprimé")
        else:
            errors += schema_errors(old_schema, new_schema, f"{path} components/{name}")
    return errors


def oasdiff_errors(old_text: str, new_text: str) -> list[str]:
    binary = shutil.which("oasdiff")
    if binary is None:
        return []
    with tempfile.TemporaryDirectory() as tmp:
        old_file = pathlib.Path(tmp, "old.yaml")
        new_file = pathlib.Path(tmp, "new.yaml")
        old_file.write_text(old_text, encoding="utf-8")
        new_file.write_text(new_text, encoding="utf-8")
        result = subprocess.run([binary, "breaking", str(old_file), str(new_file)], capture_output=True, text=True)
        if result.returncode != 0:
            return [f"oasdiff : {line}" for line in result.stdout.splitlines() if line.strip()]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--working-tree", action="store_true")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    root = pathlib.Path(args.root).resolve()

    base = files_at(args.base)
    head = files_worktree(root) if args.working_tree else files_at(args.head)
    errors: list[str] = []
    touched = [path for path in head if path not in base or base[path] != head[path]]

    for path in touched:
        if path not in base:
            continue  # a new contract cannot break an existing consumer
        try:
            old, new = parse(path, base[path]), parse(path, head[path])
        except (json.JSONDecodeError, yaml.YAMLError) as error:
            errors.append(f"{path} : document illisible ({error})")
            continue
        if path.rsplit("/", 1)[-1].startswith("openapi"):
            errors += openapi_errors(old, new, path)  # type: ignore[arg-type]
            errors += oasdiff_errors(base[path], head[path])
        else:
            errors += schema_errors(old, new, path)

    changed = [status for status, path in changed_files(args.base, args.head, args.working_tree) if is_contract(path)]
    if not changed:
        print("aucun contrat modifié")
    return report(f"contrats OK · {len(touched)} contrat(s) vérifié(s)", errors)


if __name__ == "__main__":
    sys.exit(main())
