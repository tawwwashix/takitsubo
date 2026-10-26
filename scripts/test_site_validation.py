"""Exercise publication failures in a disposable checkout, without network or Git writes."""
import copy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from sitebuild.validation import load_sources, ValidationError
from validate_site import audit_generated

ROOT = Path(__file__).resolve().parent.parent


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')


def snapshot(root):
    paths = list(root.rglob('*.html')) + [root / p for p in ('data/search.json', 'data/shindan.json', 'sitemap.xml', 'robots.txt')]
    return {str(p): (p.read_bytes(), p.stat().st_mtime_ns) for p in paths}


def rejects(call, expected):
    try:
        call()
    except ValidationError as error:
        assert expected in str(error), str(error)
    else:
        raise AssertionError('Invalid data was accepted: ' + expected)


def main():
    scratch = ROOT / '.local-preview'
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='validation-test-', dir=scratch) as directory:
        root = Path(directory)
        for name in ('scripts', 'data', 'assets'):
            shutil.copytree(ROOT / name, root / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        for name in ('episodes', 'series', 'news'):
            (root / name).mkdir()
        command = [sys.executable, '-X', 'utf8', 'scripts/build.py']
        run = subprocess.run(command, cwd=root, capture_output=True, encoding='utf-8')
        assert run.returncode == 0, run.stderr
        baseline = snapshot(root)
        source = load_sources(root)
        assert audit_generated(root, source)['pages'] >= 700
        print('PASS current data, intentional null AWQ rounds, complete generated site', flush=True)

        mutations = [
            ('episodes', lambda d: d['episodes'].append(copy.deepcopy(d['episodes'][0])), 'duplicate values'),
            ('episodes', lambda d: d['episodes'][0].update(number=True), '.number'),
            ('episodes', lambda d: d['episodes'][0].update(series='unknown-series'), 'unknown or missing series'),
            ('episodes', lambda d: d['episodes'][0].update(image='assets/img/missing-image.png'), 'image not found'),
            ('episodes', lambda d: d['episodes'][0].update(image='../outside.png'), 'site-relative'),
            ('episodes', lambda d: d['episodes'][0].update(image=[]), '.image'),
            ('episodes', lambda d: d['episodes'][0].update(games={}), '.games'),
            ('episodes', lambda d: d['episodes'][0].update(date='2026-02-30'), 'calendar date'),
            ('episodes', lambda d: d['episodes'][0].pop('title'), '.title'),
            ('site', lambda d: d.update(recommended_episodes=[99999, 80, 100, 38]), 'recommended_episodes'),
            ('site', lambda d: d.update(featured_series=['unknown-series']), 'featured_series'),
            ('site', lambda d: d.update(ga_id=None), '.ga_id'),
            ('site', lambda d: d.update(title_suffix=[]), '.title_suffix'),
            ('series', lambda d: d['series'][0].update(slug='../escape'), '.slug'),
            ('news', lambda d: d['news'][0].update(body=[]), '.body'),
            ('ranking', lambda d: d['quizzes'][0].update(round=99999), 'unknown episode number'),
            ('aliases', lambda d: d.update(titles=[{'canonical':'game', 'aliases':[None]}]), '.aliases'),
            ('game_readings', lambda d: d.update(readings=[]), '.readings'),
            ('game_series', lambda d: d.update(series={'game': {'add': True}}), '.add'),
        ]
        for name, mutate, expected in mutations:
            path = root / f'data/{name}.json'
            original = path.read_bytes()
            value = copy.deepcopy(source[name])
            mutate(value)
            write_json(path, value)
            rejects(lambda: load_sources(root), expected)
            # Real entry point must reject before replacing any generated output.
            run = subprocess.run(command, cwd=root, capture_output=True, encoding='utf-8')
            assert run.returncode != 0 and 'ValidationError' in run.stderr, run.stderr
            assert snapshot(root) == baseline, 'Invalid input changed generated output'
            path.write_bytes(original)
        print(f'PASS {len(mutations)} invalid-source cases stop before any output write', flush=True)

        path = root / 'data/game_readings.json'
        original = path.read_bytes()
        for text, expected in [('{', 'data/game_readings.json'),
                               ('{"readings":{"same":"A","same":"B"}}', 'duplicate JSON key'),
                               ('{"readings":{"same":NaN}}', 'non-finite')]:
            path.write_text(text, encoding='utf-8')
            rejects(lambda: load_sources(root), expected)
        path.unlink()
        rejects(lambda: load_sources(root), 'data/game_readings.json')
        path.write_bytes(original)
        print('PASS malformed/missing JSON, duplicate keys and non-finite numbers', flush=True)

        # The command used by Actions must return a failure status on broken output.
        index = root / 'index.html'
        original = index.read_bytes()
        index.write_bytes(original + b'<a href="episodes/missing.html">broken</a>')
        gate = subprocess.run([sys.executable, 'scripts/validate_site.py'], cwd=root, capture_output=True, encoding='utf-8')
        assert gate.returncode == 1 and 'missing local reference' in gate.stderr, gate.stderr
        index.write_bytes(original)
        for markup, expected in [('<a href="#missing-anchor">broken</a>', 'missing anchor'),
                                  ('<div id="repeated"></div><div id="repeated"></div>', 'duplicate IDs')]:
            index.write_text(original.decode('utf-8') + markup, encoding='utf-8')
            rejects(lambda: audit_generated(root, source), expected)
            index.write_bytes(original)
        missing = root / '404.html'
        original_404 = missing.read_bytes()
        missing.unlink()
        rejects(lambda: audit_generated(root, source), 'required page missing')
        missing.write_bytes(original_404)
        missing.write_text(original_404.decode('utf-8').replace('content="noindex"', 'content="index"'), encoding='utf-8')
        rejects(lambda: audit_generated(root, source), 'requires noindex')
        missing.write_bytes(original_404)
        missing.write_text(original_404.decode('utf-8').replace('src="/assets/img/datyou.png"', 'src="assets/img/datyou.png"'), encoding='utf-8')
        rejects(lambda: audit_generated(root, source), 'arbitrary depths')
        missing.write_bytes(original_404)
        search_path = root / 'data/search.json'
        original_search = search_path.read_bytes()
        search = json.loads(original_search)
        search['episodes'][0]['title'] = 'stale search'
        write_json(search_path, search)
        rejects(lambda: audit_generated(root, source), 'stale or inconsistent')
        search_path.write_bytes(original_search)
        sitemap = root / 'sitemap.xml'
        original_sitemap = sitemap.read_bytes()
        sitemap.write_bytes(original_sitemap.replace(b'</urlset>', b'<url><loc>https://game-takitsubo.com/404.html</loc></url></urlset>'))
        rejects(lambda: audit_generated(root, source), 'URLs must match')
        sitemap.write_bytes(original_sitemap)
        assert audit_generated(root, load_sources(root))['pages'] >= 700
        print('PASS broken links/anchors, duplicate IDs, missing 404, noindex, deep paths, stale data, sitemap and CLI failure status', flush=True)


if __name__ == '__main__':
    main()
