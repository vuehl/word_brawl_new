"""Rebuild the merged desktop source from the two supplied deliveries."""
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = Path.home() / "Desktop"
ACTORS = Path(sys.argv[1]) if len(sys.argv) > 1 else DESKTOP / "改/改/_实机测试/project"
KIT = Path(sys.argv[2]) if len(sys.argv) > 2 else DESKTOP / "工具包/字灵文具轻量版-1.0.1-开发合并包"
DEST = ROOT / "source"


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def game_merge():
    base = KIT / "merge-base/src/game.js"
    old = ACTORS / "src/game.js"
    result = (KIT / "project/src/game.js").read_text(encoding="utf-8")
    diff = subprocess.run(
        ["git", "-c", "core.autocrlf=false", "diff", "--no-index", "--ignore-space-at-eol",
         "--no-ext-diff", "--unified=3", str(base), str(old)], capture_output=True
    )
    if diff.returncode != 1:
        raise RuntimeError(diff.stderr.decode())
    # The 1.5 branch contains an earlier notebook generator. The 1.0.1 kit owns
    # this entire terrain/shader section. All actor, projectile, font and menu
    # edits outside it must apply with matching old lines and context.
    header = re.compile(r"(?m)^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@[^\n]*\n")
    patches = header.split(diff.stdout.decode("utf-8").replace("\r\n", "\n"))[1:]
    applied = []
    for line, chunk in zip(patches[::2], patches[1::2]):
        start = int(line)
        if start < 10 or 9500 <= start < 12700:
            continue
        lines = chunk.splitlines(keepends=True)
        before = "".join(x[1:] for x in lines if x.startswith((" ", "-")))
        after = "".join(x[1:] for x in lines if x.startswith((" ", "+")))
        if result.count(before) != 1:
            raise RuntimeError(f"Ambiguous game.js patch at base line {line}")
        result = result.replace(before, after, 1)
        applied.append(start)
    first = old.read_text(encoding="utf-8").splitlines()
    imports = [x for x in first[:15] if "game-font.js" in x or x == "await gameFontsReady;"
               or "import {Glyph" in x]
    if len(imports) != 4 or not applied:
        raise RuntimeError("Unexpected actor source layout")
    return "\n".join(imports) + "\n" + result, applied


def main():
    manifest = json.loads((KIT / "merge-support/manifest.json").read_text(encoding="utf-8-sig"))
    for entry in manifest["files"]:
        if digest(KIT / "project" / entry["path"]) != entry["releaseSha256"].lower():
            raise RuntimeError("Toolkit hash mismatch: " + entry["path"])
        if entry["baselineSha256"] and digest(KIT / "merge-base" / entry["path"]) != entry["baselineSha256"].lower():
            raise RuntimeError("Merge base hash mismatch: " + entry["path"])
    merged, applied = game_merge()
    for name in ("src", "public", "local", "firebase"):
        shutil.copytree(ACTORS / name, DEST / name, dirs_exist_ok=True)
    for name in ("package.json", "server.mjs"):
        shutil.copy2(ACTORS / name, DEST / name)
    choices = {}
    for entry in manifest["files"]:
        name = entry["path"]
        target = DEST / name
        if name == "src/game.js":
            target.write_text(merged, encoding="utf-8", newline="\n")
            choices[name] = "merged"
        elif name.startswith(tuple("public/overrides/assets/" + x + "/" for x in ("pmd", "icons", "portraits"))):
            if not target.is_file():
                raise RuntimeError("Missing 1.5 character art: " + name)
            choices[name] = "1.5"
        else:
            shutil.copy2(KIT / "project" / name, target)
            choices[name] = "1.0.1"
    # The published 1.5 development snapshot omits the upstream license files.
    # Recover them only from a source tree with the exact common base game.
    upstream = DESKTOP / "宝可梦轻量版/宝可梦轻量版/project"
    if (upstream / "src/game.js").is_file() and digest(upstream / "src/game.js") == digest(KIT / "merge-base/src/game.js"):
        for name in ("LICENSE", "THIRD-PARTY-NOTICES.md", "UPSTREAM-README.md"):
            shutil.copy2(upstream / name, DEST / name)
        for name in ("lite.test.mjs", "audit-assets.mjs", "audit-runtime-assets.mjs", "export-catalogs.mjs",
                     "vendor/acorn.mjs", "vendor/ACORN-LICENSE"):
            target = DEST / "tools" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(upstream / "tools" / name, target)
        (DEST / "reports").mkdir(exist_ok=True)
    report = {"toolkitFiles": len(choices), "gamePatchesFrom1_5": applied,
              "gameSHA256": digest(DEST / "src/game.js"),
              "files": {p: {"source": s, "sha256": digest(DEST / p)} for p, s in choices.items()}}
    (DEST / "merge-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Merged", len(choices), "verified toolkit files and", len(applied), "actor-side game.js patches.")


if __name__ == "__main__":
    main()
