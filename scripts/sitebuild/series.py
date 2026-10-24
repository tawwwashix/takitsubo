"""Series index and detail pages."""
from .common import SVG, ep_card, footer, head, header, series_card
from .context import EPS, ROOT, SERIES, SITE, esc
from .output import write_output


def build_series():
    root = "../"
    cards = "".join(series_card(s, root) for s in SERIES)

    page = head("名物企画", "ゲームの滝壺の名物企画・シリーズ一覧。", root, "series/")
    page += header(root, "series")
    page += f"""<main class="container">
<div class="page-head"><h1 class="page-title"><span class="en">SPECIAL SERIES</span>名物企画</h1>
<p style="font-size:13px;color:var(--sub);">繰り返し配信しているシリーズ企画のまとめです。気になる企画からどうぞ。</p></div>
<div class="grid-2" style="margin-top:14px;">{cards}</div>
</main>"""
    page += footer(root)
    write_output(ROOT / "series/index.html", page, encoding="utf-8")

    for s in SERIES:
        eps = [e for e in EPS if e["series"] == s["slug"]]
        rows = "".join(
            ep_card(e, root, meta_prefix=f'<span class="ep-hash">ep{idx:02d}</span>')
            for idx, e in enumerate(eps, 1))
        base = SITE["base_url"].rstrip("/")
        crumbs_ld = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ホーム", "item": base + "/"},
                {"@type": "ListItem", "position": 2, "name": "名物企画", "item": base + "/series/"},
                {"@type": "ListItem", "position": 3, "name": s["name"]},
            ],
        }
        page = head(s["name"], f"名物企画「{s['name']}」の全エピソード。{s['description'][:60]}", root, f"series/{s['slug']}.html", jsonld=crumbs_ld)
        page += header(root, "series")
        page += f"""<main class="container">
<div class="page-head">
<a class="back-link" href="index.html">{SVG['arrow_l']}名物企画一覧へ</a>
<div class="card series-hero" style="margin-bottom:20px;">
<div style="font-size:11px;color:var(--faint);font-family:var(--font-num);">名物企画</div>
<h1 class="s-name" style="font-size:22px;">{esc(s['name'])}</h1>
<p class="s-desc" style="font-size:13px;">{esc(s['description'])}</p>
<div class="s-count">全{len(eps)}回</div>
</div></div>
<div class="ep-grid">{rows}</div>
</main>"""
        page += footer(root)
        write_output(ROOT / f"series/{s['slug']}.html", page, encoding="utf-8")
