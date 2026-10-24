# -*- coding: utf-8 -*-
"""Static site build entry point. Generated HTML remains committed to Git.

python scripts/build.py
python scripts/build.py --page lab --page shindan
Implementation and templates: scripts/sitebuild/.
"""
import pathlib
import sys

# Support both CLI execution and legacy importlib users such as title_audit.py.
_script_dir = str(pathlib.Path(__file__).resolve().parent)
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)

from sitebuild.cli import main
from sitebuild.catalog import games_db  # Backward-compatible title_audit entry.

if __name__ == "__main__":
    raise SystemExit(main())
