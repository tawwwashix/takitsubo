"""Shared source data and repository paths for one build invocation."""
import html
import pathlib
from .validation import load_sources


ROOT = pathlib.Path(__file__).resolve().parents[2]


SOURCES = load_sources(ROOT)
SITE = SOURCES["site"]


EPS = SOURCES["episodes"]["episodes"]


SERIES = SOURCES["series"]["series"]


NEWS = SOURCES["news"]["news"]


PAGE_META = SOURCES["page_meta"]


RANKING = SOURCES["ranking"]


EPS_BY_NUM = {e["number"]: e for e in EPS}


EP_COUNT = sum(1 for e in EPS if e["number"] > 0)


esc = html.escape
