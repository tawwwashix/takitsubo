"""A child-module edit must invalidate the lab only, with no source mutation."""
import pathlib
import tempfile

from sitebuild import common as build
original_root = build.ROOT
scratch = original_root / '.local-preview'
scratch.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=scratch) as directory:
    root = pathlib.Path(directory)
    sources = root / 'assets/js/lab'
    sources.mkdir(parents=True)
    for source in (original_root / 'assets/js/lab').glob('*.js'):
        (sources / source.name).write_bytes(source.read_bytes())
    build.ROOT = root
    before = build.lab_version()
    common = build.navigation_version()
    for newline in (b'\n', b'\r\n'):
        for source in sources.glob('*.js'):
            source.write_bytes(source.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', newline))
        assert build.lab_version() == before, 'Checkout newline style changed the lab version'
    print('PASS LF and CRLF checkouts keep the same lab bundle version')
    for source in sources.glob('*.js'):
        content = source.read_bytes()
        source.write_bytes(content + b'\n// changed\n')
        assert build.lab_version() != before, source.name
        assert build.navigation_version() == common
        source.write_bytes(content)
        assert build.lab_version() == before
    print('PASS every lab child edit changes its bundle version without changing the common version')
