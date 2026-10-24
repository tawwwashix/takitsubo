"""Read-only audit of this branch's generated pages against its merge base.

Only the new lab, homepage bubble and diagnosis markup may change page bodies.
All other HTML must differ solely in the lab navigation/loader and asset versions.
"""
import pathlib
import re
import subprocess

from sitebuild.sitemap import static_page_dates

ROOT = pathlib.Path(__file__).resolve().parent.parent


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8')


def normalize(text):
    text = re.sub(r'<a href="(?:\.\./)*lab\.html">.*?</a>', '', text)
    text = re.sub(r'<script src="[^"\n]*assets/js/lab-loader\.js[^"\n]*"></script>\n?', '', text)
    text = re.sub(r'\?v=[0-9a-f]+', '?v=VERSION', text)
    text = re.sub(r'data-version="[0-9a-f]+"', 'data-version="VERSION"', text)
    return text


if __name__ == '__main__':
    base = git('merge-base', 'main', 'HEAD').strip()
    paths = git('ls-tree', '-r', '--name-only', base).splitlines()
    checked, unexpected = 0, []
    for path in paths:
        if not path.endswith('.html') or path in {'index.html', 'shindan.html'}:
            continue
        old = git('show', f'{base}:{path}')
        current = ROOT / path
        if not current.exists() or normalize(old) != normalize(current.read_text(encoding='utf-8')):
            unexpected.append(path)
        checked += 1
    data_changes = git('diff', '--name-only', base, '--', 'data').splitlines()
    assert not unexpected, f'Unexpected generated content changes: {unexpected}'
    # Explicit static-page editorial dates were added during the build cleanup.
    # All existing episode/catalog/ranking data must still match the merge base.
    assert set(data_changes) <= {'data/page_meta.json'}, f'Unexpected data changes: {data_changes}'
    static_page_dates()
    print(f'PASS {checked} existing pages: only navigation/loader/asset versions changed; existing data unchanged')
