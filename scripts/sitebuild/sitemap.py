"""Sitemap, robots.txt and explicit editorial date validation."""
import datetime
import re
from .catalog import games_db
from .context import EPS, EPS_BY_NUM, NEWS, PAGE_META, ROOT, SERIES, SITE
from .output import write_output


def static_page_dates():
    """Editorial dates, never build dates. Null explicitly omits unknown lastmod."""
    paths = ("guide.html", "otayori.html", "privacy.html")
    if not isinstance(PAGE_META, dict) or set(PAGE_META) != set(paths):
        raise ValueError("page_meta.json: guide.html / otayori.html / privacy.html を指定してください")
    result = []
    for path in paths:
        entry = PAGE_META[path]
        if not isinstance(entry, dict) or "updated" not in entry:
            raise ValueError(f"page_meta.json: {path} に updated が必要です")
        date = entry["updated"]
        if date is not None:
            if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                raise ValueError(f"page_meta.json: {path} の updated は YYYY-MM-DD または null です")
            datetime.date.fromisoformat(date)
        result.append((path, date))
    return result


def build_sitemap():
    base = SITE["base_url"].rstrip("/")
    today = datetime.date.today().isoformat()
    latest = EPS[-1]["date"] if EPS else today
    # (URL, 最終更新日): エピソード=配信日 / お知らせ=掲載日 / 一覧系=最新回の配信日
    urls = [("", latest), ("episodes/", latest), ("series/", latest), ("awq/", latest),
            ("news/", NEWS[-1]["date"] if NEWS else today),
            ("shindan.html", latest), ("lab.html", latest), ("games/", latest)]
    urls += static_page_dates()
    urls += [(f"episodes/{e['number']}.html", e["date"]) for e in EPS]
    urls += [(f"games/{i['slug']}.html", EPS_BY_NUM[max(x["num"] for x in i["eps"])]["date"])
             for i in games_db() if i["paged"]]
    urls += [(f"series/{s['slug']}.html", latest) for s in SERIES]
    urls += [(f"news/{n['slug']}.html", n["date"]) for n in NEWS]
    body = "".join(f"<url><loc>{base}/{u}</loc>" + (f"<lastmod>{d}</lastmod>" if d else "") + "</url>" for u, d in urls)
    write_output(ROOT / "sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>', encoding="utf-8")
    write_output(ROOT / "robots.txt", f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
