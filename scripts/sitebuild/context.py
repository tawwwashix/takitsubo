"""Shared source data and repository paths for one build invocation."""
import html
import json
import pathlib


ROOT = pathlib.Path(__file__).resolve().parents[2]


SITE = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))


EPS = json.loads((ROOT / "data/episodes.json").read_text(encoding="utf-8"))["episodes"]


SERIES = json.loads((ROOT / "data/series.json").read_text(encoding="utf-8"))["series"]


NEWS = json.loads((ROOT / "data/news.json").read_text(encoding="utf-8"))["news"]


PAGE_META = json.loads((ROOT / "data/page_meta.json").read_text(encoding="utf-8"))


try:
    RANKING = json.loads((ROOT / "data/ranking.json").read_text(encoding="utf-8"))
except (FileNotFoundError, json.JSONDecodeError):
    RANKING = {"seasons": [], "quizzes": []}


EPS_BY_NUM = {e["number"]: e for e in EPS}


EP_COUNT = sum(1 for e in EPS if e["number"] > 0)


esc = html.escape
