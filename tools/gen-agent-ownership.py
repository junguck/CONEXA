#!/usr/bin/env python3
"""Fill the 'Propriété' section of each agents/<name>/README.md from agents/ownership.yaml.
Idempotent. Usage: python3 tools/gen-agent-ownership.py"""
import re, sys, pathlib, yaml
root = pathlib.Path(__file__).resolve().parent.parent
own = yaml.safe_load((root / "agents/ownership.yaml").read_text(encoding="utf-8"))
rules = own.get("review_rules", {})
S, E = "<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->", "<!-- OWNERSHIP:end -->"
missing = []
for name, spec in own["agents"].items():
    f = root / "agents" / name / "README.md"
    if not f.exists():
        missing.append(name); continue
    lines = ["Cet agent n'écrit **que** dans :", ""] + [f"- `{g}`" for g in spec["owns"]]
    lines += ["", "Tout le reste est en lecture seule. Source : `agents/ownership.yaml`."]
    block = f"{S}\n" + "\n".join(lines) + f"\n{E}"
    t = f.read_text(encoding="utf-8")
    if "<!-- OWNERSHIP -->" in t:
        t = t.replace("<!-- OWNERSHIP -->", block, 1)
    elif S[:20] in t:
        t = re.sub(re.escape(S[:20]) + r".*?" + re.escape(E), lambda m: block, t, flags=re.S)
    else:
        print(f"no marker in {f}"); continue
    f.write_text(t, encoding="utf-8", newline="\n")
if missing: print("READMEs manquants:", missing); sys.exit(1)
print("ok", len(own["agents"]), "agents")
