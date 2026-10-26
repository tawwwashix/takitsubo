"""Stable asset versions across checkouts and isolated lab invalidation."""
import hashlib
import pathlib
import shutil
import tempfile

from sitebuild import common as build
original_root = build.ROOT
scratch = original_root / '.local-preview'
scratch.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=scratch) as directory:
    root = pathlib.Path(directory)
    for directory_name in ('assets/js', 'assets/css'):
        shutil.copytree(original_root / directory_name, root / directory_name)
    (root / 'data').mkdir()
    for name in ('search.json', 'shindan.json'):
        shutil.copyfile(original_root / 'data' / name, root / 'data' / name)
    sources = root / 'assets/js/lab'
    build.ROOT = root
    before = build.lab_version()
    common = build.navigation_version()
    assets = [path for path in root.rglob('*') if path.suffix in ('.js', '.css', '.json')]
    versions = {path.relative_to(root).as_posix(): build.av(path.relative_to(root)) for path in assets}
    for newline in (b'\n', b'\r\n'):
        for source in assets:
            source.write_bytes(source.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', newline))
        assert all(build.av(path) == version for path, version in versions.items()), 'Checkout newline style changed an asset version'
        assert build.lab_version() == before, 'Checkout newline style changed the lab version'
        assert build.navigation_version() == common, 'Checkout newline style changed the navigation version'
    print('PASS LF and CRLF checkouts keep all JS, CSS, JSON and bundle versions unchanged')
    for source in assets:
        content = source.read_bytes()
        source.write_bytes(content + b'\nchanged\n')
        assert build.av(source.relative_to(root)) != versions[source.relative_to(root).as_posix()], source.name
        source.write_bytes(content)
    print('PASS real edits invalidate each individual asset version')
    binary = root / 'image.png'
    for content in (b'\x89PNG\r\n\x1a\n', b'\x89PNG\n\x1a\n'):
        binary.write_bytes(content)
        assert build.av('image.png') == hashlib.md5(content).hexdigest()[:8]
    assert build.av('missing.js') == '0'
    print('PASS binary asset hashing and missing-file behavior are preserved')
    for source in sources.glob('*.js'):
        content = source.read_bytes()
        source.write_bytes(content + b'\n// changed\n')
        assert build.lab_version() != before, source.name
        assert build.navigation_version() == common
        source.write_bytes(content)
        assert build.lab_version() == before
    print('PASS every lab child edit changes its bundle version without changing the common version')
