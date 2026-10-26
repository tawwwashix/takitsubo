"""Read-only publication gate: source JSON, local references and sitemap."""
import argparse
from collections import Counter
from functools import lru_cache
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET

from sitebuild.validation import load_sources, ValidationError

ROOT = Path(__file__).resolve().parent.parent
PAGE_DIRS = ('episodes', 'games', 'series', 'news', 'awq')


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.refs, self.ids, self.canonical, self.noindex = [], [], [], False
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name') == 'robots':
            self.noindex = 'noindex' in attrs.get('content', '').split(',')
        for key in ('href', 'src', 'poster', 'action', 'data-full', 'data-module', 'data-source', 'data-share-module'):
            if attrs.get(key):
                self.refs.append((tag, key, attrs[key]))


def audit_generated(root, sources):
    root = Path(root).resolve()
    base = sources['site']['base_url'].rstrip('/') + '/'
    parsed_base = urlsplit(base)
    files = list(root.glob('*.html'))
    for directory in PAGE_DIRS:
        files.extend((root / directory).glob('*.html'))
    pages = {path.relative_to(root).as_posix(): Page(path) for path in files}
    errors, count, directory_names = [], 0, {}

    @lru_cache(maxsize=None)
    def local_target(path):
        target = root / path[len(parsed_base.path):]
        if not target.resolve().is_relative_to(root):
            return None, 'reference outside site directory'
        if target.is_dir():
            target /= 'index.html'
        if not target.is_file():
            return None, 'missing local reference'
        exact = target.relative_to(root).as_posix()
        current = root
        for part in Path(exact).parts:
            if current not in directory_names:
                directory_names[current] = {p.name for p in current.iterdir()}
            if part not in directory_names[current]:
                return None, 'path case mismatch'
            current /= part
        return exact, None

    required = {'index.html', '404.html', 'guide.html', 'otayori.html', 'privacy.html', 'lab.html', 'shindan.html'}
    required.update(f'{directory}/index.html' for directory in PAGE_DIRS)
    required.update(f'episodes/{e["number"]}.html' for e in sources['episodes']['episodes'])
    required.update(f'series/{s["slug"]}.html' for s in sources['series']['series'])
    required.update(f'news/{n["slug"]}.html' for n in sources['news']['news'])
    errors.extend(f'{name}: required page missing' for name in sorted(required - pages.keys()))
    for rel, page in pages.items():
        page_url = urljoin(base, rel)
        expected_canonical = urljoin(base, rel[:-10] if rel.endswith('index.html') else rel)
        if rel == '404.html':
            if not page.noindex or page.canonical:
                errors.append('404.html: requires noindex and no canonical URL')
        elif page.noindex or page.canonical != [expected_canonical]:
            errors.append(f'{rel}: incorrect canonical URL or unexpected noindex')
        duplicates = [key for key, n in Counter(page.ids).items() if n > 1]
        if duplicates:
            errors.append(f'{rel}: duplicate IDs: {duplicates}')
        for tag, key, ref in page.refs:
            parsed = urlsplit(urljoin(page_url, ref))
            if parsed.scheme not in ('http', 'https') or parsed.netloc != parsed_base.netloc:
                continue
            count += 1
            path = unquote(parsed.path)
            if not path.startswith(parsed_base.path):
                errors.append(f'{rel}: reference outside site base: {ref}')
                continue
            exact, error = local_target(path)
            if error:
                errors.append(f'{rel}: {error}: {ref}')
                continue
            if rel == '404.html' and not ref.startswith(('/', 'https://', 'http://')):
                errors.append(f'404.html: local reference must work at arbitrary depths: {ref}')
            if parsed.fragment and tag == 'a' and exact in pages:
                anchor = unquote(parsed.fragment)
                if not anchor.startswith('t=') and anchor not in pages[exact].ids:
                    errors.append(f'{rel}: missing anchor: {ref}')
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    try:
        locs = [loc.text for loc in ET.parse(root / 'sitemap.xml').findall('.//s:loc', ns)]
        canonicals = {url for page in pages.values() for url in page.canonical}
        if len(locs) != len(set(locs)) or set(locs) != canonicals:
            errors.append('sitemap.xml: URLs must match all indexable pages exactly, with no duplicates')
    except (OSError, ET.ParseError) as error:
        locs = []
        errors.append(f'sitemap.xml: {error}')
    try:
        search = json.loads((root / 'data/search.json').read_text(encoding='utf-8'))['episodes']
        fields = ('number', 'title', 'date', 'tags', 'image')
        expected = [{key: e.get(key) for key in fields} for e in sources['episodes']['episodes']]
        if [{key: e.get(key) for key in fields} for e in search] != expected:
            errors.append('data/search.json: stale or inconsistent episode data; run the full build')
        diagnosis = json.loads((root / 'data/shindan.json').read_text(encoding='utf-8'))
        if diagnosis['latest_episode'] != max(e['number'] for e in sources['episodes']['episodes']):
            errors.append('data/shindan.json: stale latest episode; run the full build')
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        errors.append(f'generated JSON: {error}')
    if errors:
        raise ValidationError('Generated-site validation failed:\n- ' + '\n- '.join(errors))
    return {'pages': len(pages), 'local_references': count, 'sitemap_urls': len(locs)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-only', action='store_true', help='Check input JSON before generating pages')
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args(argv)
    try:
        sources = load_sources(args.root)
        print('PASS source JSON: types, duplicate keys/numbers, references, dates and images')
        if not args.source_only:
            result = audit_generated(args.root, sources)
            print('PASS generated site: ' + json.dumps(result))
    except (ValidationError, OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
