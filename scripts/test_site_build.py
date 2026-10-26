"""Build regression checks in a disposable copy; no RSS fetch or source edits.

Optional: --reference-ref <commit> compares against its monolithic build.py.
"""
import argparse
import copy
import hashlib
import html
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import parse_qs, urlsplit
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent


def run(root, script="scripts/build.py", *args, ok=True, code=None):
    command = [sys.executable, "-X", "utf8"]
    command += ["-c", code] if code else [script, *args]
    result = subprocess.run(command, cwd=root, capture_output=True, encoding="utf-8")
    assert (result.returncode == 0) == ok, result.stdout + result.stderr
    return result


def snapshot(root):
    paths = [p for p in root.rglob("*.html") if "scripts" not in p.parts]
    paths += list((root / "data").glob("*.json"))
    paths += [root / "sitemap.xml", root / "robots.txt"]
    return {p.relative_to(root).as_posix(): (
        hashlib.sha256(p.read_bytes()).hexdigest(), p.stat().st_mtime_ns
    ) for p in paths if p.is_file()}


def content(state):
    return {path: values[0] for path, values in state.items()}


def changed(before, after):
    return {p for p in before.keys() | after.keys() if before.get(p) != after.get(p)}


def dates(root):
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return {u.findtext("s:loc", namespaces=ns): u.findtext("s:lastmod", namespaces=ns)
            for u in ET.parse(root / "sitemap.xml").getroot()}


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def check_game_search_links(root):
    # Real titles containing URL delimiters must reach search without truncation.
    cases = [(6, "クイズ&バラエティすくすく犬福"), (45, "パタポン1+2 リプレイ"),
             (57, "ダンジョンズ&ドラゴンズ"), (69, "ロックマン&フォルテ"),
             (84, "DETECTIVE X CASE FILE #1『御仏の殺人』")]
    for number, title in cases:
        page = (root / f"episodes/{number}.html").read_text(encoding="utf-8")
        links = [(html.unescape(href), html.unescape(label)) for href, label in
                 re.findall(r'<a class="tag[^\"]*" href="([^\"]*)">([^<]*)</a>', page)]
        search_links = [href for href, label in links
                        if label.endswith(title) and href.startswith("index.html?q=")]
        assert search_links, f"Missing search fallback for #{number}: {title}"
        for href in search_links:
            parsed = urlsplit(href)
            assert not parsed.fragment and parse_qs(parsed.query) == {"q": [title]}, (title, href)
    print("PASS game search links preserve ampersands, plus signs and hashes", flush=True)


def check(root, reference):
    if reference:
        (root / "scripts/build_reference.py").write_bytes(reference)
        run(root, "scripts/build_reference.py")
        baseline = content(snapshot(root))
    run(root)
    initial = snapshot(root)
    check_game_search_links(root)
    if reference:
        assert content(initial) == baseline, changed(baseline, content(initial))
        print(f"PASS reference equivalence: {len(initial)} generated/data files", flush=True)

    run(root)
    assert snapshot(root) == initial, "Unchanged build rewrote output or timestamps"
    print("PASS repeated full build preserves all content and timestamps", flush=True)

    # Only obsolete generated game detail pages may be pruned.
    obsolete = root / "games/g-obsolete-test.html"
    extra = root / "games/manual-test.html"
    obsolete.write_text("obsolete", encoding="utf-8")
    extra.write_text("keep", encoding="utf-8")
    run(root)
    assert not obsolete.exists() and extra.read_text() == "keep"
    extra.unlink()
    assert snapshot(root) == initial
    print("PASS stale game-page pruning preserves current pages and unrelated files", flush=True)

    for module, expected in [("assets/js/shindan/main.js", "shindan.html"),
                             ("assets/js/lab/cartridge.js", "lab.html")]:
        path = root / module
        original = path.read_bytes()
        path.write_bytes(original + b"\n// build regression probe\n")
        run(root)
        assert changed(initial, snapshot(root)) == {expected}, changed(initial, snapshot(root))
        path.write_bytes(original)
        run(root)
        assert content(snapshot(root)) == content(initial)
        initial = snapshot(root)
        print(f"PASS {module} edit affects only {expected}", flush=True)

    # Date values never drift with build day; explicit unknown date can be omitted.
    meta_path = root / "data/page_meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    initial_dates = dates(root)
    run(root, code="import sys, datetime; sys.path.insert(0, 'scripts'); "
        "from sitebuild import sitemap; "
        "sitemap.datetime.date = type('FutureDate', (datetime.date,), "
        "{'today': classmethod(lambda cls: cls(2040, 1, 1))}); sitemap.build_sitemap()")
    assert dates(root) == initial_dates
    edited = copy.deepcopy(meta)
    edited["guide.html"]["updated"] = "2026-10-25"
    edited["privacy.html"]["updated"] = None
    write_json(meta_path, edited)
    before = snapshot(root)
    run(root)
    assert changed(before, snapshot(root)) == {"sitemap.xml"}
    updated = dates(root)
    assert next(d for u, d in updated.items() if u.endswith('/guide.html')) == "2026-10-25"
    assert next(d for u, d in updated.items() if u.endswith('/privacy.html')) is None
    for bad in ["2026-02-30", "26-1-1", 20261025]:
        edited["guide.html"]["updated"] = bad
        write_json(meta_path, edited)
        before = snapshot(root)
        result = run(root, ok=False)
        assert "ValueError" in result.stderr
        assert snapshot(root) == before, "Invalid metadata must fail before writes"
    write_json(meta_path, meta)
    run(root)
    print("PASS explicit sitemap dates, unknown dates, clock independence, invalid-input guard", flush=True)

    # Simulate the existing RSS updater's final build, without accessing the feed.
    ep_path = root / "data/episodes.json"
    ep_data = json.loads(ep_path.read_text(encoding="utf-8"))
    new = copy.deepcopy(ep_data["episodes"][-1])
    new["number"] = max(e["number"] for e in ep_data["episodes"]) + 1
    new["date"] = "2026-11-01"
    ep_data["episodes"].append(new)
    write_json(ep_path, ep_data)
    run(root)
    assert (root / f"episodes/{new['number']}.html").exists()
    search = json.loads((root / "data/search.json").read_text(encoding="utf-8"))
    assert any(e["number"] == new["number"] for e in search["episodes"])
    weekly = content(snapshot(root))
    for url, date in initial_dates.items():
        if any(url.endswith('/' + name) for name in meta):
            assert dates(root)[url] == date
    if reference:
        run(root, "scripts/build_reference.py")
        assert content(snapshot(root)) == weekly, changed(weekly, content(snapshot(root)))
    print("PASS simulated weekly episode addition, search data and reference output", flush=True)

    # Existing title audit imports build.py via importlib; preserve that contract.
    run(root, code="import importlib.util; s=importlib.util.spec_from_file_location('build', 'scripts/build.py'); "
        "b=importlib.util.module_from_spec(s); s.loader.exec_module(b); assert b.games_db()")
    print("PASS legacy title-audit import contract", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference-ref", help="Git revision with the pre-split monolithic build.py")
    args = parser.parse_args()
    reference = subprocess.check_output(
        ["git", "show", f"{args.reference_ref}:scripts/build.py"], cwd=ROOT
    ) if args.reference_ref else None
    scratch = ROOT / ".local-preview"
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="build-test-", dir=scratch) as directory:
        root = pathlib.Path(directory)
        for name in ("scripts", "data", "assets/js", "assets/css"):
            shutil.copytree(ROOT / name, root / name, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        for name in ("episodes", "series", "news"):
            (root / name).mkdir()
        check(root, reference)


if __name__ == "__main__":
    main()
