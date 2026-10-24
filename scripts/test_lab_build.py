"""A child-module edit must invalidate the lab only, with no source mutation."""
import importlib.util
import pathlib
import tempfile

spec = importlib.util.spec_from_file_location('site_build', pathlib.Path(__file__).with_name('build.py'))
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
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
    for source in sources.glob('*.js'):
        content = source.read_bytes()
        source.write_bytes(content + b'\n// changed\n')
        assert build.lab_version() != before, source.name
        assert build.navigation_version() == common
        source.write_bytes(content)
        assert build.lab_version() == before
    print('PASS every lab child edit changes its bundle version without changing the common version')
