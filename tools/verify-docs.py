#!/usr/bin/env python3
import re, sys, pathlib, yaml, fnmatch
root = pathlib.Path(__file__).resolve().parent.parent
err = []
def read(p):
    return p.read_text(encoding="utf-8")

road = read(root/"docs/ROADMAP.md")
rows = re.findall(r"^\| (F\d\.\d+) \| (.*?) \| (.*?) \| ?(.*?) ?\| ([SML]) \|$", road, re.M)
ids = {r[0]: r for r in rows}
own = yaml.safe_load(read(root/"agents/ownership.yaml"))
agents = set(own["agents"])
# prompts <-> roadmap
pf = read(root/"agents/PROMPTS_FEATURES.md")
pids = re.findall(r"^### (F\d\.\d+) ", pf, re.M)
if set(pids) != set(ids): err.append(f"IDs mismatch roadmap/prompts: {set(ids)^set(pids)}")
if len(pids) != len(set(pids)): err.append("duplicate prompt IDs")
# agent + deps
graph = {}
for i, (_, title, ag, dep, size) in ids.items():
    for a in [x.strip() for x in ag.split(",")]:
        if a not in agents: err.append(f"{i}: unknown agent {a}")
    deps = [d.strip() for d in dep.split(",") if d.strip()]
    for d in deps:
        if d not in ids: err.append(f"{i}: unknown dep {d}")
    graph[i] = deps
    # prompt header agent matches roadmap
    m = re.search(rf"### {re.escape(i)} .*?\n\*\*Agent\*\* (.*?) · \*\*Dépend de\*\* (.*?) · \*\*Taille\*\* ([SML])", pf)
    if not m: err.append(f"{i}: header missing"); continue
    pa = sorted(x.strip(" `") for x in m.group(1).split(","))
    if pa != sorted(x.strip() for x in ag.split(",")): err.append(f"{i}: agent differs {pa} vs {ag}")
    pd = [x.strip() for x in m.group(2).split(",") if x.strip() and x.strip() != "—"]
    if sorted(pd) != sorted(deps): err.append(f"{i}: deps differ prompt={pd} roadmap={deps}")
    if m.group(3) != size: err.append(f"{i}: size differs")
# acyclic
state = {}
def dfs(n, path):
    if state.get(n) == 1: err.append("cycle: " + " -> ".join(path+[n])); return
    if state.get(n) == 2: return
    state[n] = 1
    for d in graph.get(n, []): dfs(d, path+[n])
    state[n] = 2
for n in graph: dfs(n, [])
# every agent has README, listed in agents/README.md
ar = read(root/"agents/README.md")
for a in agents:
    if not (root/f"agents/{a}/README.md").exists(): err.append(f"missing README {a}")
    elif f"{a}/README.md" not in ar: err.append(f"{a} not linked in agents/README.md")
    elif "<!-- OWNERSHIP -->" in read(root/f"agents/{a}/README.md"): err.append(f"{a}: ownership not generated")
    if a not in read(root/"agents/PROMPTS_BASE.md"): err.append(f"{a}: no base prompt")
# glob overlap: identical or one is prefix-dir of another
flat = [(a, g) for a, s in own["agents"].items() for g in s["owns"]]
def base(g): return g.split("**")[0].rstrip("/*")
for i, (a1, g1) in enumerate(flat):
    for a2, g2 in flat[i+1:]:
        if a1 == a2: continue
        b1, b2 = base(g1), base(g2)
        if g1 == g2 or (("*" in g1 and (b2 == b1 or b2.startswith(b1 + "/"))) or ("*" in g2 and (b1 == b2 or b1.startswith(b2 + "/")))):
            err.append(f"overlap {a1}:{g1} <> {a2}:{g2}")
# relative md links
IGNORED_DIRS = {"node_modules", ".git", ".turbo", "dist", ".next", "coverage", ".pnpm-store"}
for f in root.rglob("*.md"):
    if IGNORED_DIRS & set(f.relative_to(root).parts):
        continue
    for m in re.finditer(r"\]\(([^)#\s]+)(?:#[^)]*)?\)", read(f)):
        t = m.group(1)
        if re.match(r"\w+://|mailto:", t): continue
        if not (f.parent/t).resolve().exists(): err.append(f"broken link {f.relative_to(root)} -> {t}")
print(f"{len(ids)} roadmap IDs, {len(pids)} prompts, {len(agents)} agents")
print("\n".join(err) if err else "ALL CHECKS PASSED"); sys.exit(1 if err else 0)
