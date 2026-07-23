# -*- coding: utf-8 -*-
"""ゲームの滝壺 公式サイト ビルドスクリプト
data/*.json を読み込み、全HTMLページを生成する。
使い方:  python3 scripts/build.py
"""
import json, html, pathlib, datetime, hashlib, re, unicodedata, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent


def x_post_url(text):
    """押すとXの投稿画面が開き、textが本文に入っているリンクを返す"""
    return "https://x.com/intent/post?text=" + urllib.parse.quote(text)


def av(rel):
    """アセットのキャッシュバスター。内容が変わるとURLの ?v= も変わり、
    ブラウザ(特にスマホ)が古いCSS/JSを掴み続けるのを防ぐ。"""
    try:
        return hashlib.md5((ROOT / rel).read_bytes()).hexdigest()[:8]
    except FileNotFoundError:
        return "0"
SITE = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
EPS = json.loads((ROOT / "data/episodes.json").read_text(encoding="utf-8"))["episodes"]
SERIES = json.loads((ROOT / "data/series.json").read_text(encoding="utf-8"))["series"]
NEWS = json.loads((ROOT / "data/news.json").read_text(encoding="utf-8"))["news"]

EPS_BY_NUM = {e["number"]: e for e in EPS}
# 配信回数: 第0回(番組紹介)は「全N回」の数え上げに含めない
EP_COUNT = sum(1 for e in EPS if e["number"] > 0)
esc = html.escape


def jd(iso):  # 2026-07-01 -> 2026.07.01
    return iso.replace("-", ".")


def time_to_sec(t):
    """チャプター表記の「45:57」「1:02:03」を秒数に。解釈できなければNone"""
    try:
        sec = 0
        for p in str(t).split(":"):
            sec = sec * 60 + int(p)
        return sec
    except ValueError:
        return None


def fmt_dur_min(sec):
    """再生時間(秒)を「58分」「1時間17分」表記に。不明なら空文字"""
    if not sec:
        return ""
    h, m = sec // 3600, round((sec % 3600) / 60)
    if m == 60:
        h, m = h + 1, 0
    return f"{h}時間{m}分" if h else f"{m}分"


SVG = {
    "play": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72L19 12 8 5.14z"/></svg>',
    "pause": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.6v14H7V5zm6.4 0H17v14h-3.6V5z"/></svg>',
    "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    "zoom": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>',
    "close": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    "arrow_l": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>',
    "x": '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.4Z"/></svg>',
    "spotify": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.83-1.73-6.39-2.12-10.59-1.16a.75.75 0 1 1-.33-1.46c4.56-1.04 8.49-.59 11.64 1.34.36.22.47.68.31 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.24-1.99-8.18-2.57-12-1.4a.94.94 0 1 1-.55-1.79c4.38-1.34 9.8-.69 13.53 1.6.44.27.58.85.31 1.28Zm.13-3.4C15.24 8.32 8.85 8.11 5.15 9.24a1.12 1.12 0 1 1-.65-2.16c4.25-1.29 11.32-1.04 15.78 1.6a1.12 1.12 0 0 1-1.18 1.95Z"/></svg>',
    "podcast": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="11" r="2.5"/><path d="M8.5 20.5 9.7 15a3.9 3.9 0 0 1 4.6 0l1.2 5.5M6.2 14.4a7 7 0 1 1 11.6 0M3.4 16.6a11 11 0 1 1 17.2 0"/></svg>',
    "youtube": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.12-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 0 0 2.12-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"/></svg>',
    "instagram": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.36 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.8.72 1.47 1.38 2.13.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.3 1.47-.72 2.13-1.38.66-.66 1.08-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.8-.72-1.47-1.38-2.12-.66-.66-1.33-1.08-2.13-1.38-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4Zm6.41-10.4a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44Z"/></svg>',
}
SERVICE_ICON = {"spotify": "spotify", "apple": "podcast", "amazon": "podcast", "listen": "podcast", "youtube": "youtube"}

WAVE = (
    '<svg class="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">'
    '<path d="M0 45 C 240 90 480 0 720 40 C 960 80 1200 10 1440 50 L 1440 90 L 0 90 Z" fill="#EAF6FE"/></svg>'
)


def head(title, desc, root, path="", og_image=None, jsonld=None, og_type="website", published=None):
    # ブラウザのタブ/OGPタイトル。トップは「番組名 | 接尾辞」、下層は「ページ名 | 番組名」。
    # 番組名(SITE["title"])はフッターのコピーライトやロゴのalt等にそのまま使うので短いままにする。
    suffix = SITE.get("title_suffix", "")
    if title:
        full = f'{esc(title)} | {esc(SITE["title"])}'
    else:
        full = f'{esc(SITE["title"])} | {esc(suffix)}' if suffix else esc(SITE["title"])
    url = SITE["base_url"].rstrip("/") + "/" + path
    og_img = SITE["base_url"].rstrip("/") + "/" + (og_image or "assets/img/ogp.png")
    ld = f'\n<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>' if jsonld else ""
    pub = f'\n<meta property="article:published_time" content="{published}">' if published else ""
    # Googleアナリティクス(site.jsonのga_idを入れると全ページに読み込まれる。空なら何も出さない)
    gid = SITE.get("ga_id", "").strip()
    ga = (f'\n<script async src="https://www.googletagmanager.com/gtag/js?id={gid}"></script>'
          f'\n<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}'
          f'gtag("js",new Date());gtag("config","{gid}");</script>') if gid else ""
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{full}</title>
<meta name="description" content="{esc(desc)}">
<meta property="og:title" content="{full}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="{og_type}">
<meta property="og:url" content="{esc(url)}">
<meta property="og:image" content="{og_img}">{pub}
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="{esc(SITE['title'])} ポッドキャストRSS" href="{esc(SITE['rss'])}">
<link rel="icon" type="image/png" sizes="32x32" href="{root}assets/img/favicon_32.png">
<link rel="apple-touch-icon" href="{root}assets/img/favicon_192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&family=Noto+Sans+JP:wght@400;500;700&family=Outfit:wght@500;700&display=swap">
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&family=Noto+Sans+JP:wght@400;500;700&family=Outfit:wght@500;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&family=Noto+Sans+JP:wght@400;500;700&family=Outfit:wght@500;700&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="{root}assets/css/style.css?v={av('assets/css/style.css')}">{ld}{ga}
</head>
<body>"""


def header(root, current=""):
    items = [
        ("index.html", "ホーム", "home"),
        ("episodes/", "エピソード", "episodes"),
        ("series/", "名物企画", "series"),
        ("shindan.html", "ゲーム診断", "shindan"),
        ("games/", "滝壺DB", "games"),
        ("news/", "お知らせ", "news"),
        ("guide.html", "聴き方", "guide"),
        ("otayori.html", "おたより", "otayori"),
    ]
    # ハンバーガーメニュー内でのみ差し替えるラベル(PCヘッダーは短い表記のまま)
    mobile_label = {"shindan": "ふさわしいゲーム診断", "games": "滝壺データベース"}
    links = ""
    for href, label, key in items:
        current_attr = ' aria-current="page"' if key == current else ""
        if key in mobile_label:
            inner = f'<span class="lbl-pc">{label}</span><span class="lbl-mb">{mobile_label[key]}</span>'
        else:
            inner = label
        links += f'<a href="{root}{href}"{current_attr}>{inner}</a>'
    # 外部リンク: 公式X・Instagram(PCはアイコンのみ / ハンバーガーではアイコン+テキスト)・ブログ
    blog = SITE["members"][0].get("blog", {})
    blog_url = blog.get("url", "#")
    if blog_url.startswith("TODO"): blog_url = "#"
    links += f'<a class="nav-ext nav-icon" href="{SITE["x_url"]}" target="_blank" rel="noopener" aria-label="公式X" title="公式X">{SVG["x"]}<span class="lbl-mb">公式X</span></a>'
    links += f'<a class="nav-ext nav-icon" href="{esc(SITE["instagram_url"])}" target="_blank" rel="noopener" aria-label="公式Instagram" title="公式Instagram">{SVG["instagram"]}<span class="lbl-mb">公式Instagram</span></a>'
    links += f'<a class="nav-ext" href="{esc(blog_url)}" target="_blank" rel="noopener">ブログ</a>'
    return f"""<header class="site-header"><div class="header-inner">
<a class="brand" href="{root}index.html"><img class="brand-logo" src="{root}assets/img/logo_wide.png" alt="{SITE['title']}"></a>
<button class="nav-toggle" aria-label="メニューを開く" aria-expanded="false" aria-controls="siteNav">
<span></span><span></span><span></span></button>
<nav class="nav" id="siteNav" aria-label="メインメニュー">{links}</nav>
</div></header>"""


def footer(root):
    blog = SITE["members"][0].get("blog", {})
    blog_url = blog.get("url", "#")
    if blog_url.startswith("TODO"): blog_url = "#"
    nav = (
        f'<a href="{root}index.html">ホーム</a><a href="{root}episodes/">エピソード</a>'
        f'<a href="{root}series/">名物企画</a><a href="{root}shindan.html">ふさわしいゲーム診断</a>'
        f'<a href="{root}games/">滝壺データベース</a>'
        f'<a href="{root}news/">お知らせ</a>'
        f'<a href="{root}guide.html">ポッドキャストの聴き方</a><a href="{root}otayori.html">おたより</a>'
        f'<a href="{SITE["x_url"]}" target="_blank" rel="noopener">公式X</a>'
        f'<a href="{esc(SITE["instagram_url"])}" target="_blank" rel="noopener">公式Instagram</a>'
        f'<a href="{esc(blog_url)}" target="_blank" rel="noopener">ブログ「{esc(blog.get("label", "ブログ"))}」</a>'
    )
    return f"""<footer class="site-footer"><div class="footer-inner">
<div class="footer-brand"><img class="footer-logo" src="{root}assets/img/logo_wide.png" alt="{SITE['title']}"></div>
<div class="footer-en">GAME NO TAKITSUBO — WEEKLY GAME TALK PODCAST</div>
<p class="footer-desc">{esc(SITE['tagline'])}。{esc(SITE['schedule'])}。<br>感想は {esc(SITE['hashtag'])} でどうぞ。</p>
<nav class="footer-nav" aria-label="フッターメニュー">{nav}</nav>
<p class="footer-note">お問い合わせ: <a href="mailto:{SITE['email']}">{SITE['email']}</a><br>
おたよりフォームでいただいた内容は番組内で紹介させていただくことがあります。個人情報は番組運営の目的以外には使用しません。<br>
<a href="{root}privacy.html">プライバシーポリシー</a><br>
&copy; {datetime.date.today().year} {SITE['title']}</p>
</div></footer>
<div class="ambient-bubbles" aria-hidden="true"></div>
<button class="datyou-top" aria-label="ページの先頭へ戻る" title="てっぺんへ戻る">
<img src="{root}assets/img/datyou.png" alt=""></button>
<script src="{root}assets/js/site.js?v={av('assets/js/site.js')}"></script>
</body></html>"""


def service_buttons(root, links=None):
    """links(dict)があればエピソード個別URL、なければ番組トップURLへ"""
    out = []
    for key, s in SITE["services"].items():
        url = (links or {}).get(key) or s["url"]
        if url.startswith("TODO"):
            url = "#"  # 未設定は無効リンク(README参照)
        icon = SVG[SERVICE_ICON[key]]
        out.append(f'<a class="service-btn svc-{key}" href="{esc(url)}" target="_blank" rel="noopener">{icon}{s["label"]}</a>')
    return "".join(out)


def ep_image(e):
    """エピソード画像の相対パス(サイトルート基準)。無ければNone。"""
    img = e.get("image")
    return img if img else None


def related_eps(e, limit=3):
    """関連する回: 同じ名物企画を最優先し、共通の登場ゲーム数でスコアリング"""
    egames = {g for _, g in episode_game_entries(e)}
    scored = []
    for o in EPS:
        if o["number"] == e["number"]:
            continue
        score = 0
        if e["series"] and o["series"] == e["series"]:
            score += 3
        score += min(len(egames & {g for _, g in episode_game_entries(o)}), 3)
        if score:
            scored.append((score, o["number"], o))
    scored.sort(key=lambda t: (-t[0], -t[1]))
    return [t[2] for t in scored[:limit]]


def sec_title(jp, en="", more_html=""):
    """セクション見出し。enに英字ラベルを渡すと公式サイト風の2段見出しになる。"""
    en_html = f'<span class="en">{esc(en)}</span>' if en else ""
    return f'<h2 class="section-title"><span class="st-text">{en_html}<span>{esc(jp)}</span></span>{more_html}</h2>'


def series_card(s, root, desc_len=None):
    """名物企画カード。最新回のアートワークを「ぼかし背景+全体表示」で見せ、
    企画名は画像上に白文字で重ねる(下部に暗グラデを敷いて可読性を確保)。"""
    eps = [e for e in EPS if e["series"] == s["slug"]]
    latest_img = next((ep_image(e) for e in reversed(eps) if ep_image(e)), None)
    art = ""
    if latest_img:
        art = f"""<span class="series-card-art">
<img class="sc-bg" src="{root}{latest_img}" alt="" aria-hidden="true">
<img class="sc-main" src="{root}{latest_img}" alt="" loading="lazy">
<span class="sc-shade"></span>
<span class="sc-title">{esc(s['name'])}<span class="sc-count">全{len(eps)}回</span></span>
</span>"""
    desc = s["description"] if desc_len is None else s["description"][:desc_len] + "…"
    return f"""<a class="series-card" href="{root}series/{s['slug']}.html">
{art}
<span class="series-card-body">
<span class="s-desc">{esc(desc)}</span>
</span></a>"""


def ep_card(e, root, meta_prefix="", featured=False):
    """エピソードカード(アートワーク大表示)。ep-gridの中に置く。"""
    tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in e["tags"][:2])
    img = ep_image(e)
    if img:
        art = f'<img class="ep-card-img" src="{root}{img}" alt="" loading="lazy">'
    else:
        art = f'<span class="ep-card-img ep-card-num">#{e["number"]}</span>'
    cls = "ep-card featured" if featured else "ep-card"
    label = '<span class="ep-feat-label">🎧 最新回</span>' if featured else ""
    desc = ""
    if featured and e["description"]:
        desc = f'<span class="ep-card-desc">{esc(e["description"][:90])}…</span>'
    return f"""<a class="{cls}" href="{root}episodes/{e['number']}.html">
{art}
<span class="ep-card-body">{label}<span class="ep-title">{esc(e['title'])}</span>
<span class="ep-meta">{meta_prefix}<span class="ep-hash">#{e['number']}</span>{jd(e['date'])}{tags}</span>{desc}</span>
</a>"""


# ============================================================ index.html
def build_index():
    root = ""
    latest = EPS[-1]
    recent = list(reversed(EPS[-7:-1]))  # 最新を除く直近6件(3列×2段)
    ep_count = EP_COUNT
    shindan_count = len(shindan_pool()[0])
    rock = {"tawashi": "rock_tawashi.png", "hyuuma": "rock_hyuuma.png", "ichigoo": "rock_ichigo.png"}
    members = "".join(
        f"""<div class="card member-card">
{f'<img class="member-rock" src="assets/img/{rock[m["id"]]}" alt="" aria-hidden="true">' if m['id'] in rock else ''}
<img src="assets/img/{m['id']}.webp" alt="{esc(m['name'])}のアイコン">
<div class="name">{esc(m['name'])}</div>
<p class="bio">{esc(m['bio'])}</p>
<a class="x-link" href="{m['x']}" target="_blank" rel="noopener">{SVG['x']}{m['x_handle']}</a>
</div>""" for m in SITE["members"])

    # トップに出す名物企画: site.json の featured_series(slugの配列)で選択。未設定なら先頭4件
    feat_slugs = SITE.get("featured_series") or [s["slug"] for s in SERIES[:4]]
    featured = [s for slug in feat_slugs for s in SERIES if s["slug"] == slug][:4]
    series_cards = "".join(series_card(s, root, desc_len=52) for s in featured)

    news_items = "".join(
        f'<a class="news-item" href="news/{n["slug"]}.html"><span class="news-date">{jd(n["date"])}</span><span class="news-title">{esc(n["title"])}</span></a>'
        for n in list(reversed(NEWS))[:3])

    # ヒーロー直下のNEWSティッカー(最新1件)
    news_bar = ""
    if NEWS:
        n = list(reversed(NEWS))[0]
        news_bar = (f'<div class="news-bar"><span class="nb-label">NEWS</span>'
                    f'<a class="nb-item" href="news/{n["slug"]}.html"><span class="nb-date">{jd(n["date"])}</span>{esc(n["title"])}</a>'
                    f'<a class="nb-more" href="news/">一覧 →</a></div>')

    tawashi = SITE["members"][0]
    blog_url = tawashi.get("blog", {}).get("url", "#")
    if blog_url.startswith("TODO"): blog_url = "#"

    base = SITE["base_url"].rstrip("/")
    series_ld = {
        "@context": "https://schema.org",
        "@type": "PodcastSeries",
        "name": SITE["title"],
        "description": SITE["tagline"],
        "url": base + "/",
        "image": base + "/assets/img/ogp.png",
        "inLanguage": "ja",
        "webFeed": SITE["rss"],
    }
    page = head("", f"{SITE['tagline']}。{SITE['schedule']}。すべて無料で聴けます。", root, "", jsonld=series_ld)
    page += header(root, "home")
    page += f"""
<div class="hero">
<img class="float-img float-maguro" src="assets/img/maguro.webp" alt="" aria-hidden="true">
<img class="float-img float-kani" src="assets/img/kani.webp" alt="" aria-hidden="true">
<div class="hero-inner">
<div class="hero-stage" id="heroStage" aria-hidden="true">
<div class="stage-layer layer-logo" data-depth="0.35"><img class="stage-logo" src="assets/img/mainlogo.webp" alt=""></div>
<div class="stage-layer layer-tawashi" data-depth="1.1"><span class="stage-char char-a"><img class="flip-x" src="assets/img/tawashi.webp" alt=""></span></div>
<div class="stage-layer layer-ichigoo" data-depth="1.4"><span class="stage-char char-b"><img src="assets/img/ichigoo.webp" alt=""></span></div>
<div class="stage-layer layer-hyuuma" data-depth="0.8"><span class="stage-char char-c"><img class="flip-x" src="assets/img/hyuuma.webp" alt=""></span></div>
<div class="stage-splash">
<i class="foam f1"></i><i class="foam f2"></i><i class="foam f3"></i><i class="foam f4"></i>
<i class="drop d1"></i><i class="drop d2"></i><i class="drop d3"></i><i class="drop d4"></i><i class="drop d5"></i>
</div>
</div>
<div class="hero-text">
<h1 class="visually-hidden">{SITE['title']}</h1>
<p class="catch">
    {esc(SITE['tagline'])
        .replace('最新作まで、ゲーム', '最新作まで<br>ゲーム')
        .replace('ありのゲーム', 'ありの<br>ゲーム')}
</p>
<div class="hero-chips">
<span class="chip">{esc(SITE['schedule'])}</span>
<span class="chip">全{ep_count}回配信中</span>
</div>
<a class="cta-primary" href="episodes/{latest['number']}.html">{SVG['play']}最新回 #{latest['number']} を聴く</a>
<span class="cta-note">アプリやブラウザから、すべて無料で聴けます！</span>
<span class="services-label">ON AIR — 各サービスで配信中</span>
<div class="services">{service_buttons(root)}</div>
</div>
</div>
</div>
{WAVE}
<main class="container">

{news_bar}

<section class="section">
<div class="info-box"><strong>ポッドキャストってなに？</strong><br>
無料で聴けるネットラジオのようなものです。アプリを入れなくても、上のボタンからブラウザですぐ再生できます。通勤・家事・寝る前のおともにどうぞ。
<a href="guide.html">くわしい聴き方はこちら →</a></div>
</section>

<section class="section">
<a class="shindan-banner" href="shindan.html">
<img class="sb-chara" src="assets/img/rock_ichigo.png" alt="" aria-hidden="true">
<span class="sb-body">
<span class="sb-en">FUSAWASHII GAME SHINDAN</span>
<span class="sb-title">あなたに"ふさわしいゲーム"を診断！</span>
<span class="sb-desc">全{ep_count}回のトークデータ・{shindan_count}タイトルの中から、運命の一本が見つかる。結果はシェアして自慢しよう。</span>
</span>
<span class="sb-cta">診断する →</span>
</a>
<a class="shindan-banner db" href="games/" style="margin-top:14px;">
<img class="sb-chara" src="assets/img/rock_tawashi.png" alt="" aria-hidden="true">
<span class="sb-body">
<span class="sb-en">TAKITSUBO DATABASE</span>
<span class="sb-title">語られた全{shindan_count}タイトル、ぜんぶ引ける。</span>
<span class="sb-desc">メインで語った回・3分ゲーム紹介・ちょい出しまで、あなたの好きなあのゲームをどの回で話したかがわかる索引です。</span>
</span>
<span class="sb-cta">索引を見る →</span>
</a>
</section>

<section class="section band band-soft">
{sec_title("最新エピソード", "LATEST")}
{ep_card(latest, root, featured=True)}
</section>

<section class="section band band-blue">
{sec_title("最近の配信", "RECENT", '<a class="section-more" href="episodes/">すべて見る →</a>')}
<div class="ep-grid">{''.join(ep_card(e, root) for e in recent)}</div>
</section>

<section class="section band band-soft">
{sec_title("名物企画", "SPECIAL SERIES", '<a class="section-more" href="series/">一覧へ →</a>')}
<div class="grid-2">{series_cards}</div>
</section>

<section class="section band band-blue">
{sec_title("パーソナリティ", "MEMBERS")}
<div class="grid-3">{members}</div>
<p style="font-size:12px;color:var(--sub);margin-top:12px;">
夜中たわしのブログ「<a href="{esc(blog_url)}" target="_blank" rel="noopener">夜中に前へ</a>」では、ポッドキャストの更新情報も記事になっています。
YouTubeでは<a href="{SITE['services']['youtube']['url']}" target="_blank" rel="noopener">ゲーム実況</a>も配信中！</p>
</section>

<section class="section band band-soft">
{sec_title("お知らせ", "NEWS", '<a class="section-more" href="news/">一覧へ →</a>')}
<div class="news-list">{news_items}</div>
</section>

<section class="section band band-blue">
{sec_title("SNS", "FOLLOW US")}
<div class="card" style="text-align:center;padding:26px 20px;">
<p style="font-size:14px;color:var(--sub);margin-bottom:18px;">最新情報・配信告知・こぼれ話はSNSで。<br>
感想は <strong style="color:var(--ink);">{esc(SITE['hashtag'])}</strong> を付けてポストしていただければ、すべて読んでいます！</p>
<div class="x-actions">
<a class="service-btn x-post" href="{esc(x_post_url(SITE['hashtag'] + ' '))}" target="_blank" rel="noopener">{SVG['x']}{esc(SITE['hashtag'])} でポストする</a>
<a class="service-btn" href="{SITE['x_url']}" target="_blank" rel="noopener">{SVG['x']}{esc(SITE['x_handle'])} をフォロー</a>
<a class="service-btn svc-instagram" href="{esc(SITE['instagram_url'])}" target="_blank" rel="noopener">{SVG['instagram']}{esc(SITE['instagram_handle'])} をフォロー</a>
</div>
</div>
</section>

<section class="section band band-soft">
{sec_title("おたより募集中", "LETTERS")}
<div class="grid-2">
<a class="card" href="otayori.html"><strong>📮 おたよりフォーム</strong><br><span style="font-size:12px;color:var(--sub);">番組の感想・リクエストなどはこちらから</span></a>
<a class="card" href="mailto:{SITE['email']}"><strong>✉️ メールでも受付</strong><br><span style="font-size:12px;color:var(--sub);font-family:var(--font-num);">{SITE['email']}</span></a>
</div>
</section>

</main>"""
    page += footer(root)
    (ROOT / "index.html").write_text(page, encoding="utf-8")


# ============================================================ episodes/index.html
def build_episode_list():
    root = "../"
    # フィルタ用タグ: シリーズ + 主要トピック(出現順)
    tag_order, seen = [], set()
    for s in SERIES:
        tag_order.append(next(iter([t for e in EPS if e["series"] == s["slug"] for t in e["tags"] if t not in seen] or [s["name"]])))
        seen.add(tag_order[-1])
    for e in EPS:
        for t in e["tags"]:
            if t not in seen:
                seen.add(t); tag_order.append(t)
    filter_btns = '<button class="filter-btn on" data-tag="all">すべて</button>' + "".join(
        f'<button class="filter-btn" data-tag="{esc(t)}">{esc(t)}</button>' for t in tag_order)

    page = head("エピソード一覧", "ゲームの滝壺の全エピソード。キーワード検索とタグで絞り込めます。", root, "episodes/")
    page += header(root, "episodes")
    page += f"""
<main class="container">
<div class="page-head"><h1 class="page-title"><span class="en">EPISODES</span>エピソード一覧</h1></div>

<div class="searchbox">{SVG['search']}
<input type="search" id="q" placeholder="ゲーム名・キーワードで検索（例:ドラクエ、わるい村、#50）" aria-label="エピソードを検索" autocomplete="off">
<button type="button" class="search-clear" id="qClear" aria-label="検索キーワードを消す" hidden>{SVG['close']}</button>
</div>
<p class="search-note">💡 タイトルだけでなく、<strong>番組内で話題に出たゲームタイトル</strong>も検索対象です。</p>
<div class="filter-row" role="group" aria-label="タグで絞り込み"><span class="filter-label">絞り込み</span>{filter_btns}</div>

<div class="list-toolbar">
<p class="result-count" id="count"></p>
<label class="sort-field">並び順
<select id="sort" aria-label="並び順">
<option value="relevance">関連度順</option>
<option value="new">新しい順</option>
<option value="old">古い順</option>
</select></label>
</div>

<div class="ep-grid" id="list" aria-live="polite"></div>
<div id="empty" style="display:none;" class="empty-box">
<p class="empty-title">🔍 該当するエピソードが見つかりませんでした</p>
<ul class="empty-hint">
<li>別の表記で試してみてください（例: FF ↔ ファイナルファンタジー、ドラクエ ↔ ドラゴンクエスト）</li>
<li>ひらがな・カタカナは自動で変換されます（「どらくえ」でもOK）</li>
<li>上の「絞り込み」タグから企画・テーマで探すこともできます</li>
</ul>
</div>
</main>
<script>window.__searchVer="{av('data/search.json')}";</script>
<script src="{root}assets/js/search.js?v={av('assets/js/search.js')}"></script>"""
    page += footer(root)
    (ROOT / "episodes/index.html").write_text(page, encoding="utf-8")


# ============================================================ episodes/NNN.html
def build_episode_pages():
    root = "../"
    slug_map = game_slug_map()  # ゲーム名→DBページのスラッグ(全回で共通)
    for i, e in enumerate(EPS):
        n = e["number"]
        prev_e = EPS[i - 1] if i > 0 else None
        next_e = EPS[i + 1] if i < len(EPS) - 1 else None

        tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in e["tags"])
        date_note = ' <span class="date-note">（推定）</span>' if e.get("date_estimated") else ""
        audio = e.get("audio")
        img = ep_image(e)

        games_html = ""
        if e["games"]:
            # タグはデータベースの個別ページへ(索引に無いものは従来どおり検索へ)。
            # メイン(★)と3分ゲーム紹介のタイトルはDB索引と同じ色分けで目立たせる
            feat_keys = {_shindan_norm(x) for x in e.get("featured_games", [])}
            sanbun_keys = {_shindan_norm(x) for x in sanbun_titles(e)}
            gtags = ""
            for _, g in episode_game_entries(e):  # 見出し行・注記行はDB側と同じ規則で除外
                k = _shindan_norm(g)
                slug = slug_map.get(k)
                href = f"../games/{slug}.html" if slug else f"index.html?q={esc(g)}"
                if k in feat_keys:
                    cls, mark = "tag t3", LEVEL_MARK[3]
                elif k in sanbun_keys:
                    cls, mark = "tag t2", LEVEL_MARK[2]
                else:
                    cls, mark = "tag", ""
                gtags += f'<a class="{cls}" href="{href}">{mark}{esc(g)}</a>'
            games_html = f'<section class="section eps-games">{sec_title("登場ゲームタイトル・キーワード", "GAMES & KEYWORDS")}<div class="game-tags">{gtags}</div></section>'

        # チャプター: 音声がある回はボタン化し、タップでその話題から再生できる
        chapters_html = ""
        if e["chapters"]:
            if audio:
                rows = ""
                for c in e["chapters"]:
                    sec = time_to_sec(c["time"])
                    if sec is None:
                        rows += (f'<li><span class="chap-row"><span class="chapter-time">{esc(c["time"])}</span>'
                                 f'<span class="chap-label">{esc(c["label"])}</span></span></li>')
                    else:
                        rows += (f'<li><button type="button" class="chap-row" data-t="{sec}">'
                                 f'<span class="chapter-time">{esc(c["time"])}</span>'
                                 f'<span class="chap-label">{esc(c["label"])}</span>'
                                 f'<span class="chap-go">{SVG["play"]}<span class="eq"><i></i><i></i><i></i></span></span>'
                                 f'</button></li>')
                chapters_html = (f'<aside class="section eps-side"><div class="side-sticky">{sec_title("チャプター", "CHAPTERS")}'
                                 f'<p class="chap-hint">🎧 チャプターを押すと、その話題の頭から再生されます。</p>'
                                 f'<ol class="chapter-list tk-chapters">{rows}</ol></div></aside>')
            else:
                items = "".join(f'<li><span class="chapter-time">{esc(c["time"])}</span><span>{esc(c["label"])}</span></li>' for c in e["chapters"])
                chapters_html = (f'<aside class="section eps-side"><div class="side-sticky">{sec_title("チャプター", "CHAPTERS")}'
                                 f'<ul class="chapter-list">{items}</ul></div></aside>')

        # 「この回について」: 概要文 + 名物企画への案内
        series_note = ""
        if e["series"]:
            s = next(s for s in SERIES if s["slug"] == e["series"])
            series_note = f'<p style="margin-top:14px;font-size:13px;">この回は名物企画「<a href="../series/{s["slug"]}.html">{esc(s["name"])}</a>」のひとつです。</p>'
        about_html = ""
        if e["description"] or series_note:
            body = f'<div class="card ep-desc">{esc(e["description"])}</div>' if e["description"] else ""
            about_html = f'<section class="section eps-about">{sec_title("この回について", "ABOUT")}{body}{series_note}</section>'

        pn = '<div class="prevnext">'
        pn += (f'<a class="card" href="{prev_e["number"]}.html"><span class="pn-label">← 前の回 #{prev_e["number"]}</span><div class="pn-title">{esc(prev_e["title"])}</div></a>' if prev_e else "<span></span>")
        pn += (f'<a class="card next" href="{next_e["number"]}.html"><span class="pn-label">次の回 #{next_e["number"]} →</span><div class="pn-title">{esc(next_e["title"])}</div></a>' if next_e else "<span></span>")
        pn += "</div>"

        base = SITE["base_url"].rstrip("/")
        ep_ld = {
            "@context": "https://schema.org",
            "@type": "PodcastEpisode",
            "name": f"第{n}回 {e['title']}",
            "episodeNumber": n,
            "datePublished": e["date"],
            "url": f"{base}/episodes/{n}.html",
            "description": (e["description"][:200] if e["description"] else f"ゲームの滝壺 第{n}回"),
            "image": base + "/" + (ep_image(e) or "assets/img/ogp.png"),
            "partOfSeries": {"@type": "PodcastSeries", "name": SITE["title"], "url": base + "/"},
            "inLanguage": "ja",
        }
        if audio:
            ep_ld["associatedMedia"] = {"@type": "MediaObject", "contentUrl": audio}
            if e.get("duration"):
                ep_ld["timeRequired"] = f"PT{e['duration']}S"
        crumbs_ld = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ホーム", "item": base + "/"},
                {"@type": "ListItem", "position": 2, "name": "エピソード", "item": base + "/episodes/"},
                {"@type": "ListItem", "position": 3, "name": f"第{n}回 {e['title']}"},
            ],
        }
        page = head(f"第{n}回 {e['title']}", f"ゲームの滝壺 第{n}回。{e['title']}", root, f"episodes/{n}.html",
                    og_image=ep_image(e), jsonld=[ep_ld, crumbs_ld], og_type="article", published=e["date"])
        page += header(root, "episodes")

        # 関連する回(同じ企画・同じゲームの話をした回)
        rel = related_eps(e)
        related_html = ""
        if rel:
            related_html = f'<section class="section">{sec_title("関連する回", "RELATED")}<div class="ep-grid">{"".join(ep_card(r, root) for r in rel)}</div></section>'

        # サイト内プレイヤー: RSSの音声(MP3)をこのページで直接再生する。
        # チャプター頭出し・倍速・続きから再生・?t=リンクは assets/js/player.js が担当
        if audio:
            image_attr = f' data-image="{root}{img}"' if img else ""
            player_html = f"""<div class="tkp" id="tkPlayer" data-audio="{esc(audio)}" data-ep="{n}" data-duration="{e.get('duration') or ''}" data-title="第{n}回 {esc(e['title'])}" data-show="{esc(SITE['title'])}"{image_attr}>
<div class="tkp-top">
<button class="tkp-play" type="button" aria-label="再生 / 一時停止"><span class="i-play">{SVG['play']}</span><span class="i-pause">{SVG['pause']}</span></button>
<div class="tkp-main">
<input class="tkp-seek" type="range" min="0" max="{e.get('duration') or 1}" step="1" value="0" aria-label="再生位置">
<div class="tkp-times"><span class="tkp-cur">0:00</span><span class="tkp-dur">--:--</span></div>
</div>
</div>
<div class="tkp-sub">
<button class="tkp-btn tkp-back" type="button" title="10秒戻る">⏪ 10秒</button>
<button class="tkp-btn tkp-fwd" type="button" title="30秒進む">30秒 ⏩</button>
<button class="tkp-btn tkp-rate" type="button" title="再生速度を変える">1.0x</button>
<button class="tkp-btn tkp-copy" type="button" title="いま聴いている位置から始まるURLをコピー">🔗 この位置のリンク</button>
</div>
<p class="tkp-note" aria-live="polite"></p>
</div>"""
        else:
            player_html = ('<div class="tkp"><p class="tkp-note">この回の音声はまだ取り込めていないため、'
                           '下の各サービスからお聴きください。</p></div>')

        # アートワーク: 画像がある回は下に「拡大」リンクを添える(PCのみ表示。
        # スマホはピンチで拡大できるのでCSSで隠す)。押すとライトボックスで大きく表示
        if img:
            art_html = (f'<div class="ep-hero-media">'
                        f'<img class="ep-hero-art" src="{root}{img}" alt="第{n}回のアートワーク">'
                        f'<button type="button" class="art-zoom" data-full="{root}{img}" '
                        f'data-caption="第{n}回 {esc(e["title"])}">{SVG["zoom"]}アートワークを大きく見る</button>'
                        f'</div>')
        else:
            art_html = f'<div class="ep-hero-media"><span class="ep-hero-art">#{n}</span></div>'
        dur_note = f" ・ {fmt_dur_min(e.get('duration'))}" if e.get("duration") else ""

        # ⭐この回のメインゲーム: タイトル直下にDBリンク付きチップで最大5つ
        feat_chips = ""
        for name in e.get("featured_games", [])[:5]:
            slug = slug_map.get(_shindan_norm(name))
            href = f"../games/{slug}.html" if slug else f"index.html?q={esc(name)}"
            feat_chips += f'<a class="tag t3" href="{href}">{LEVEL_MARK[3]}{esc(name)}</a>'
        feat_html = f'<div class="ep-hero-games">{feat_chips}</div>' if feat_chips else ""

        hero_html = f"""<div class="ep-hero card">
{art_html}
<div class="ep-hero-body">
<p class="detail-meta">#{n} ・ {jd(e['date'])} 配信{date_note}{dur_note}</p>
<h1 class="page-title ep-hero-title">{esc(e['title'])}</h1>
<div class="ep-hero-tags">{tags}</div>
{feat_html}
{player_html}
</div>
</div>"""
        listen_html = f"""<div class="listen-block"><span class="listen-label">アプリ・他のサービスでも聴けます</span>
<div class="listen-row">{service_buttons(root, {**e['links'], 'spotify': e['links'].get('spotify_open') or e['links'].get('spotify')})}</div></div>"""

        # おたより/Xポストのボタン(上下2箇所に置く)
        share_text = f'第{n}回 {e["title"]}\n{SITE["hashtag"]}\n{SITE["base_url"].rstrip("/")}/episodes/{n}.html'
        actions_html = f"""<div class="ep-actions">
<a class="service-btn otayori" href="../otayori.html">📮 この回の感想をおたよりで送る</a>
<a class="service-btn x-post" href="{esc(x_post_url(share_text))}" target="_blank" rel="noopener">{SVG['x']}Xで感想をポスト</a>
</div>"""

        # 本文: DOM順(=スマホの表示順)は 概要→チャプター→ゲーム→その他。
        # PC(900px以上)ではCSSグリッドがチャプターだけを右の追従カラムに配置する
        rest_html = f'<div class="eps-rest">{actions_html}{related_html}{pn}</div>'
        if chapters_html:
            body_html = f'<div class="ep-cols">\n{about_html}\n{chapters_html}\n{games_html}\n{rest_html}\n</div>'
        else:
            body_html = f'{about_html}\n{games_html}\n{rest_html}'

        page += f"""
<main class="container">
<div class="page-head">
<a class="back-link" href="index.html">{SVG['arrow_l']}エピソード一覧へ</a>
{hero_html}
{listen_html}
</div>
{body_html}
</main>
<script src="{root}assets/js/player.js?v={av('assets/js/player.js')}"></script>"""
        page += footer(root)
        (ROOT / f"episodes/{n}.html").write_text(page, encoding="utf-8")


# ============================================================ series/
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
    (ROOT / "series/index.html").write_text(page, encoding="utf-8")

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
<div class="s-name" style="font-size:22px;">{esc(s['name'])}</div>
<p class="s-desc" style="font-size:13px;">{esc(s['description'])}</p>
<div class="s-count">全{len(eps)}回</div>
</div></div>
<div class="ep-grid">{rows}</div>
</main>"""
        page += footer(root)
        (ROOT / f"series/{s['slug']}.html").write_text(page, encoding="utf-8")


# ============================================================ news/
def build_news():
    root = "../"
    items = "".join(
        f'<a class="news-item" href="{n["slug"]}.html"><span class="news-date">{jd(n["date"])}</span><span class="news-title">{esc(n["title"])}</span></a>'
        for n in reversed(NEWS))
    page = head("お知らせ", "ゲームの滝壺からのお知らせ一覧。", root, "news/")
    page += header(root, "news")
    page += f"""<main class="container">
<div class="page-head"><h1 class="page-title"><span class="en">NEWS</span>お知らせ</h1></div>
<div class="news-list" style="margin-top:10px;">{items}</div>
</main>"""
    page += footer(root)
    (ROOT / "news/index.html").write_text(page, encoding="utf-8")

    for n in NEWS:
        body = "".join(f"<p style='margin-bottom:1em;'>{esc(p)}</p>" for p in n["body"])
        page = head(n["title"], n["body"][0][:80], root, f"news/{n['slug']}.html")
        page += header(root, "news")
        page += f"""<main class="container">
<div class="page-head">
<a class="back-link" href="index.html">{SVG['arrow_l']}お知らせ一覧へ</a>
<p class="news-date">{jd(n['date'])}</p>
<h1 class="page-title" style="font-size:22px;">{esc(n['title'])}</h1></div>
<div class="card" style="margin-top:14px;font-size:14px;color:var(--sub);">{body}</div>
</main>"""
        page += footer(root)
        (ROOT / f"news/{n['slug']}.html").write_text(page, encoding="utf-8")


# ============================================================ guide.html
def build_guide():
    root = ""
    page = head("ポッドキャストの聴き方", "ポッドキャストとは？無料？アプリは必要？ゲームの滝壺の聴き方をやさしく解説。", root, "guide.html")
    page += header(root, "guide")
    page += f"""<main class="container">
<div class="page-head"><h1 class="page-title"><span class="en">HOW TO LISTEN</span>ポッドキャストの聴き方</h1></div>

<section class="section">
{sec_title("ポッドキャストってなに？", "ABOUT PODCAST")}
<div class="card" style="font-size:14px;color:var(--sub);">
<p style="margin-bottom:1em;">ポッドキャストは、<strong style="color:var(--ink);">無料で聴けるインターネットラジオ</strong>のようなものです。好きなときに、好きな回から、何度でも聴けます。</p>
<p style="margin-bottom:1em;">「ゲームの滝壺」もすべての回を無料で配信しています。会員登録や課金は一切不要です。</p>
<p>通勤・通学、家事の間、寝る前のおともに。ラジオと違って「聴き逃し」がないのもポッドキャストのいいところです。</p>
</div>
</section>

<section class="section">
{sec_title("いちばんかんたんな聴き方", "3 STEPS")}
<div class="card" style="font-size:14px;color:var(--sub);">
<p style="margin-bottom:1em;"><strong style="color:var(--ink);">1. 下のボタンから好きなサービスを選ぶ</strong><br>
ふだん使っているものがあればそれでOK。迷ったらSpotifyかYouTubeが手軽です。</p>
<p style="margin-bottom:1em;"><strong style="color:var(--ink);">2. 再生ボタンを押す</strong><br>
それだけです！ アプリを入れると、新しい回の通知を受け取れて便利です。</p>
<p><strong style="color:var(--ink);">3. 気に入ったら「フォロー」</strong><br>
毎週水曜23時ごろの新エピソードを見逃さずに聴けます。</p>
<div class="services" style="margin-top:18px;">{service_buttons(root)}</div>
</div>
</section>

<section class="section">
{sec_title("YouTubeではゲーム実況も！", "YOUTUBE")}
<div class="card" style="font-size:14px;color:var(--sub);">
<p>YouTubeチャンネルではポッドキャストに加えて<strong style="color:var(--ink);">ゲーム実況</strong>も配信しています。トークで気になったゲームの実際のプレイもぜひ。</p>
<p style="margin-top:12px;"><a class="service-btn svc-youtube" style="display:inline-flex;" href="{SITE['services']['youtube']['url']}" target="_blank" rel="noopener">{SVG['youtube']}YouTubeチャンネルへ</a></p>
</div>
</section>
</main>"""
    page += footer(root)
    (ROOT / "guide.html").write_text(page, encoding="utf-8")


# ============================================================ otayori.html
def build_otayori():
    root = ""
    page = head("おたより", "ゲームの滝壺へのおたより・感想・リクエストはこちらから。", root, "otayori.html")
    page += header(root, "otayori")
    page += f"""<main class="container">
<div class="page-head"><h1 class="page-title"><span class="en">LETTER FORM</span>おたよりフォーム</h1>
<p style="font-size:13px;color:var(--sub);margin-top:6px;">番組の感想、話してほしいテーマなど、なんでもお寄せください。<br>いただいたおたよりは番組内で紹介させていただくことがあります。</p></div>

<div class="form-embed" style="margin-top:16px;">
<iframe src="{SITE['otayori_form']}" title="おたよりフォーム" loading="lazy">読み込んでいます…</iframe>
</div>

<div class="info-box" style="margin-top:18px;">
フォームがうまく表示されない場合は <a href="{SITE['otayori_form']}" target="_blank" rel="noopener">こちらから直接開く</a> か、
メール（<a href="mailto:{SITE['email']}">{SITE['email']}</a>）でも受け付けています。
Xのハッシュタグ {esc(SITE['hashtag'])} での感想もすべて読んでいます！
<div class="x-actions" style="margin-top:14px;">
<a class="service-btn x-post" href="{esc(x_post_url(SITE['hashtag'] + ' '))}" target="_blank" rel="noopener">{SVG['x']}{esc(SITE['hashtag'])} でポストする</a>
</div>
</div>
</main>"""
    page += footer(root)
    (ROOT / "otayori.html").write_text(page, encoding="utf-8")


# ============================================================ privacy.html
def build_privacy():
    root = ""
    # 制定日はビルド日ではなく固定(site.jsonのprivacy_date)。内容を改定したときだけ手で更新する
    established = SITE.get("privacy_date", "2026年7月8日")
    ga_used = bool(SITE.get("ga_id", "").strip())
    ga_section = ("""
<h2 class="pp-h">1. アクセス解析ツールについて</h2>
<p>当サイトでは、サイトの利用状況を把握し改善するために、Googleが提供するアクセス解析ツール「Googleアナリティクス」を使用しています。Googleアナリティクスは、Cookie（クッキー）を利用して、個人を特定しない形で当サイトの利用データ（閲覧ページ、滞在時間、使用しているブラウザや地域などの統計情報）を収集します。</p>
<p>これらのデータは匿名で収集されており、個人を特定するものではありません。収集の仕組みやGoogleにおけるデータの取り扱いについては、<a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">「ユーザーがGoogleパートナーのサイトやアプリを使用する際のGoogleによるデータ使用」</a> をご覧ください。</p>
<p>Cookieによるデータ収集は、お使いのブラウザの設定でCookieを無効にすることで拒否できます。また、<a href="https://tools.google.com/dlpage/gaoptout/" target="_blank" rel="noopener">Googleアナリティクス オプトアウト アドオン</a> を導入することでも無効化できます。</p>
""" if ga_used else """
<h2 class="pp-h">1. アクセス解析ツールについて</h2>
<p>当サイトでは現在、個人を特定するアクセス解析ツールは使用していません。今後導入する場合は、本ポリシーを更新のうえお知らせします。</p>
""")

    body = f"""
<h2 class="pp-h">はじめに</h2>
<p>「{esc(SITE['title'])}」（以下「当サイト」）は、来訪者のプライバシーを尊重し、個人情報および個人に関連する情報の保護に努めます。本プライバシーポリシーは、当サイトにおける情報の取り扱いについて定めたものです。</p>
{ga_section}
<h2 class="pp-h">2. おたより・お問い合わせでいただく情報について</h2>
<p>当サイトの「おたよりフォーム」は外部サービス（Googleフォーム）を利用しています。フォームやメールでお寄せいただいた内容（お名前・ラジオネーム・メールアドレス・本文など）は、番組制作・番組内での紹介・返信などの目的にのみ使用し、ご本人の同意なく第三者へ提供することはありません。</p>
<p>いただいたおたよりは、番組やSNS・当サイト上で内容の一部または全部を紹介させていただくことがあります。掲載を希望されない場合は、その旨を明記してお送りください。</p>

<h2 class="pp-h">3. 外部サービス・リンクについて</h2>
<p>当サイトには、Spotify・Apple Podcasts・Amazon Music・LISTEN・YouTube・X（旧Twitter）などの外部サービスへのリンクや埋め込みが含まれます。これら外部サービスにおける情報の取り扱いは、各サービスのプライバシーポリシーが適用されます。当サイトはリンク先の内容について責任を負いません。</p>

<h2 class="pp-h">4. 免責事項</h2>
<p>当サイトに掲載する情報には正確を期していますが、その内容の正確性・安全性を保証するものではありません。当サイトの利用によって生じたいかなる損害についても、責任を負いかねます。</p>

<h2 class="pp-h">5. 本ポリシーの変更</h2>
<p>本プライバシーポリシーは、法令の変更やサービス内容の変更に応じて、予告なく改定することがあります。改定後の内容は当ページに掲載した時点で効力を生じます。</p>

<h2 class="pp-h">6. お問い合わせ窓口</h2>
<p>本ポリシーおよび個人情報の取り扱いに関するお問い合わせは、<a href="mailto:{SITE['email']}">{SITE['email']}</a> までご連絡ください。</p>

<p class="pp-date">制定日: {established}</p>
"""
    page = head("プライバシーポリシー", f"{SITE['title']}のプライバシーポリシー。アクセス解析・おたより等における情報の取り扱いについて。",
                root, "privacy.html")
    page += header(root, "")
    page += f"""<main class="container">
<div class="page-head"><h1 class="page-title"><span class="en">PRIVACY POLICY</span>プライバシーポリシー</h1></div>
<div class="card pp-card">{body}</div>
</main>"""
    page += footer(root)
    (ROOT / "privacy.html").write_text(page, encoding="utf-8")


# ============================================================ ふさわしいゲーム診断
def _shindan_norm(t):
    """表記ゆれの名寄せ用キー: 全半角統一・末尾の括弧注記除去・スペース/末尾記号除去"""
    s = unicodedata.normalize("NFKC", t)
    s = re.sub(r"^.*?GOTY\d{4}[:：]", "", s, flags=re.I)  # 「○○のYourGOTY2025:」等の企画プレフィックス
    s = s.strip("『』「」")
    s = s.replace("─", "-").replace("―", "-").replace("‐", "-")  # ダッシュ類を統一
    s = re.sub(r"[(（][^)）]*[)）]\s*$", "", s)  # 「タイトル(Steam版)」等の末尾注記
    s = re.sub(r"[\s　]", "", s).lower()
    return s.rstrip("-ー–—・:：")


def episode_game_entries(e):
    """概要欄のゲームリストから索引・診断の対象行だけを返す(共通の除外規則)。
    見出し行(【…】)・注記付き行(※)・まとめ行(／)は対象外"""
    for i, g in enumerate(e["games"]):
        if g.startswith("【") or "※" in g or "／" in g:
            continue
        yield i, g


def shindan_pool():
    """診断プール: 全エピソードの登場ゲームを集計。番組が更新されると自動で増える。
    表記ゆれ(括弧注記・全半角など)は名寄せして1タイトルに統合。
    各ゲームに「最も関連していそうな回」(featured_games指定の回>3分ゲーム紹介の回>
    エピソードタイトルにゲーム名を含む回>概要欄の先頭近くで挙がった回>新しい回)を紐づける。"""
    stats = {}
    counted = set()  # (キー, 回番号) — 同じ回での二重カウント防止

    def bump(key_norm, name, num, score):
        s = stats.setdefault(key_norm, {"count": 0, "best": None, "names": {}})
        if (key_norm, num) not in counted:
            counted.add((key_norm, num))
            s["count"] += 1
        s["names"][name] = s["names"].get(name, 0) + 1
        key = (score, num)
        if s["best"] is None or key > s["best"]:
            s["best"] = key

    for e in EPS:
        # メイン指定(featured_games)の回は、そのタイトルのジャケットとして最優先
        for name in e.get("featured_games", []):
            key_norm = _shindan_norm(name)
            if key_norm:
                bump(key_norm, name, e["number"], 300)
        # 3分ゲーム紹介で扱った回は次点(索引と母集団を揃えるため、リスト外のタイトルも拾う)
        for name in sanbun_titles(e):
            key_norm = _shindan_norm(name)
            if key_norm:
                bump(key_norm, name, e["number"], 200)
        for i, g in episode_game_entries(e):
            key_norm = _shindan_norm(g)
            if not key_norm:
                continue
            pos_score = max(0, 10 - i)  # 概要欄の先頭に近いほどメインの話題
            # エピソードタイトルにゲーム名が入っていれば、関連の深い回
            title_hit = len(g) >= 4 and (g in e["title"] or g[:6] in e["title"])
            bump(key_norm, g, e["number"], (100 if title_hit else 0) + pos_score)
    games, used_eps = [], {}
    for s in sorted(stats.values(), key=lambda v: (-v["count"], min(v["names"]))):
        # 代表表記: いちばん多く使われた表記(同数なら短いほう)
        title = sorted(s["names"].items(), key=lambda kv: (-kv[1], len(kv[0])))[0][0]
        pos_score, num = s["best"]
        main_flag = 1 if pos_score >= 8 else 0  # タイトル一致 or 先頭3件以内=「話していそう」
        games.append([title, s["count"], num, main_flag])
        e = EPS_BY_NUM[num]
        used_eps[str(num)] = [e["title"], e.get("image") or ""]
    return games, used_eps


def build_shindan_json():
    games, used_eps = shindan_pool()
    data = {"maxEp": EPS[-1]["number"], "games": games, "eps": used_eps}
    (ROOT / "data/shindan.json").write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(games)


def build_shindan():
    root = ""
    games, _ = shindan_pool()
    n_games = len(games)
    base = SITE["base_url"].rstrip("/")
    page = head("ふさわしいゲーム診断", f"8つの質問で、あなたに\"ふさわしいゲーム\"を診断。ゲームの滝壺が全{EP_COUNT}回で語ってきた{n_games}タイトルの中から、運命の一本を選びます。",
                root, "shindan.html")
    page += header(root, "shindan")
    page += f"""
<main class="container">
<div class="page-head" style="text-align:center;">
<h1 class="page-title"><span class="en">FUSAWASHII GAME SHINDAN</span>ふさわしいゲーム診断</h1>
<p style="font-size:13px;color:var(--sub);margin-top:8px;">滝壺の3人がこれまでに語ってきた <br><strong style="color:var(--primary-deep);">全{n_games}タイトル</strong> の中から<br>いまのあなたに"ふさわしい一本"を診断します。</p>
</div>
<div class="shindan-stage" id="shindanPanel" data-site="{esc(base)}" data-hashtag="{esc(SITE['hashtag'])}">
<p style="text-align:center;color:var(--faint);padding:40px 0;">読み込み中…</p>
</div>
<p class="search-note" style="text-align:center;margin-top:14px;">診断プールは番組の全エピソードから自動生成。<br>新しい回が配信されるたびに、結果の種類も増えていきます。<br>※ごく稀にゲームでないものが出てしまう場合があります。</p>
</main>
<script>window.__shindanVer="{av('data/shindan.json')}";</script>
<script src="{root}assets/js/shindan.js?v={av('assets/js/shindan.js')}"></script>"""
    page += footer(root)
    (ROOT / "shindan.html").write_text(page, encoding="utf-8")


# ============================================================ 滝壺データベース(ゲームタイトル索引)
def _n_light(s):
    """照合用の軽い正規化: NFKC・小文字化・スペース除去(語られ度の判定に使う)"""
    return re.sub(r"[\s　]", "", unicodedata.normalize("NFKC", str(s)).lower())


def _to_kata(s):
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)


GYO_ROWS = [
    ("あ", "アイウエオヴァィゥェォ"),
    ("か", "カキクケコガギグゲゴヵヶ"),
    ("さ", "サシスセソザジズゼゾ"),
    ("た", "タチツテトダヂヅデドッ"),
    ("な", "ナニヌネノ"),
    ("は", "ハヒフヘホバビブベボパピプペポ"),
    ("ま", "マミムメモ"),
    ("や", "ヤユヨャュョ"),
    ("ら", "ラリルレロ"),
    ("わ", "ワヲン"),
]
GAME_SECTIONS = [g[0] for g in GYO_ROWS] + ["英数", "記号", "その他"]

try:
    READINGS = json.loads((ROOT / "data/game_readings.json").read_text(encoding="utf-8"))["readings"]
except FileNotFoundError:
    READINGS = {}


def game_reading(title):
    """並び順に使うカタカナ読み。辞書優先、なければタイトル自身(かな→カタカナ化)"""
    if title in READINGS:
        return _to_kata(unicodedata.normalize("NFKC", READINGS[title]))
    t = unicodedata.normalize("NFKC", title)
    t = re.sub(r"^[「『【（()\[\]'\".,・~〜―─\-\s　]+", "", t)  # 先頭の記号・括弧は読み飛ばす
    return _to_kata(t)


def game_section(title):
    r = game_reading(title)
    if not r:
        return "記号"
    c = r[0]
    for key, chars_ in GYO_ROWS:
        if c in chars_:
            return key
    if c.isascii() and (c.isalpha() or c.isdigit()):
        return "英数"
    if "一" <= c <= "鿿":
        print(f"  読みがな未登録(「その他」の欄に並びます): {title} → data/game_readings.json に追加を推奨")
        return "その他"
    return "英数" if c.isalnum() else "記号"


def game_slug(key):
    """タイトルの名寄せキーから安定したURL用スラッグを作る(FNV-1aハッシュ)"""
    h = 2166136261
    for ch in key:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return "g" + format(h, "08x")


_GAMES_DB = None


def sanbun_titles(e):
    """「滝壺3分ゲーム紹介」で紹介したタイトルを返す。
    チャプター名に「滝壺3分ゲーム紹介」と（）の両方がある行から（）内を抽出
    (「その2（○○）」形式も拾い、無関係な（）付きチャプターは拾わない)。
    手動指定 "sanbun_games": ["タイトル"] があれば合わせて返す(RSS更新でも消えない)"""
    out = []
    for c in e.get("chapters", []):
        label = c.get("label", "")
        if "滝壺3分ゲーム紹介" not in label:
            continue
        for m in re.finditer(r"[（(]([^（）()]+)[）)]", label):
            t = m.group(1).strip()
            if t and t != "仮":
                out.append(t)
    out += e.get("sanbun_games", [])
    return out


def games_db():
    """全エピソードからタイトル索引データを作る(結果はキャッシュ)。
    各タイトル×各回に「語られ度」を付ける:
      3=メインで語られた回(featured_games = 概要欄の★ or 手動指定)
      2=滝壺3分ゲーム紹介で紹介
      1=チャプターに登場(コーナー等でまとまった話)
      0=トーク内で話題に出ただけ"""
    global _GAMES_DB
    if _GAMES_DB is not None:
        return _GAMES_DB
    stats = {}

    def note(k, name, num):
        s = stats.setdefault(k, {"names": {}, "eps": {}})
        s["names"][name] = s["names"].get(name, 0) + 1
        s["eps"].setdefault(num, set()).add(name)

    featured, sanbun = {}, {}
    for e in EPS:
        # 全回★フォーマット化済みの前提。ゲームが載っているのにfeatured_gamesが
        # 無い回は、概要欄の★凡例の書き忘れの可能性が高いので警告する(推定はしない)
        if e["games"] and "featured_games" not in e:
            print(f"  ⚠ #{e['number']}: featured_games(★)が未設定。概要欄の見出しに「★=メインで語ったタイトル」があるか確認を")
        for name in e.get("featured_games", []):
            k = _shindan_norm(name)
            if k:
                featured.setdefault(e["number"], set()).add(k)
                note(k, name, e["number"])
        for name in sanbun_titles(e):
            k = _shindan_norm(name)
            if k:
                sanbun.setdefault(e["number"], set()).add(k)
                note(k, name, e["number"])
        for _, g in episode_game_entries(e):
            k = _shindan_norm(g)
            if k:
                note(k, g, e["number"])
    items, used_slugs = [], {}
    for k, s in sorted(stats.items()):
        title = sorted(s["names"].items(), key=lambda kv: (-kv[1], len(kv[0])))[0][0]
        eps_info = []
        for num in sorted(s["eps"]):
            e = EPS_BY_NUM[num]
            # チャプター照合(語られ度📑と、個別ページのタイムスタンプ表示に使う)
            raws = {_n_light(x) for x in (s["eps"][num] | {title})}
            raws = {x for x in raws if len(x) >= 4}  # 短すぎる語は誤ヒットするので照合しない
            chaps = []
            for c in e.get("chapters", []):
                cl = _n_light(c["label"])
                if any(r in cl for r in raws):
                    chaps.append(c)
            if k in featured.get(num, set()):
                level = 3
            elif k in sanbun.get(num, set()):
                level = 2
            elif chaps:
                level = 1
            else:
                level = 0
            eps_info.append({"num": num, "level": level, "chapters": chaps})
        slug = game_slug(k)
        while slug in used_slugs:  # 万一のハッシュ衝突
            slug += "x"
        used_slugs[slug] = k
        max_level = max(x["level"] for x in eps_info)
        items.append({
            "key": k, "title": title, "slug": slug, "eps": eps_info,
            "count": len(eps_info),
            "max_level": max_level,
            # 品質ゲート: 1回ちょい出しのみのタイトルは個別ページを作らない
            # (索引には載せ、該当エピソードへ直接リンクする)
            "paged": len(eps_info) >= 2 or max_level >= 1,
            "reading": game_reading(title),
            "section": game_section(title),
        })
    _GAMES_DB = items
    return items


def games_series_map():
    """シリーズ自動グループ化: 「○○シリーズ」というタイトルが存在するとき、
    名寄せキーが「○○」で始まるタイトルをその子とみなす(人間の統合判断は不要)。
    data/game_series.json で例外を補正できる(stem=短い語幹の明示 / add / remove)。
    返り値: (child_of, children_of, page_child_of, page_children_of)
      前者2つ=前方一致のみ(索引の字下げ用・五十音順を壊さない)
      後者2つ=add補正込み(シリーズページ・個別ページの関連表示用)"""
    items = games_db()
    by_key = {i["key"]: i for i in items}

    try:
        overrides = json.loads((ROOT / "data/game_series.json").read_text(encoding="utf-8")).get("series", {})
    except FileNotFoundError:
        overrides = {}
    ov = {}
    for parent_title, o in overrides.items():
        pk = _shindan_norm(parent_title)
        if pk in by_key:
            ov[pk] = o
        else:
            print(f"  ⚠ game_series.json: 「{parent_title}」というタイトルが索引に見つかりません")

    parents = {}
    for i in items:
        if not i["key"].endswith("シリーズ"):
            continue
        o = ov.get(i["key"], {})
        if o.get("stem"):
            stem = _shindan_norm(o["stem"])
            min_len = 1  # 明示された語幹は長さ制限なし
        else:
            # 名寄せキーは末尾の長音等を落とすので、語幹にも同じ正規化を適用して比較する
            stem = i["key"][: -len("シリーズ")].rstrip("-ー–—・:：")
            min_len = 3  # 自動語幹は誤爆防止のため3文字以上
        if len(stem) >= min_len:
            parents[stem] = i

    removed = {}  # 親キー → 外す子キーの集合
    for pk, o in ov.items():
        for t in o.get("remove", []):
            removed.setdefault(pk, set()).add(_shindan_norm(t))

    child_of, children_of = {}, {}
    for i in items:
        if i["key"].endswith("シリーズ"):
            continue
        best = None
        for stem, p in parents.items():
            if i["key"].startswith(stem) and (best is None or len(stem) > len(best[0])):
                best = (stem, p)
        if best and i["key"] not in removed.get(best[1]["key"], set()):
            child_of[i["key"]] = best[1]
            children_of.setdefault(best[1]["key"], []).append(i["key"])

    # ページ表示用: add(前方一致しないシリーズ作品)を合成
    page_child_of = dict(child_of)
    page_children_of = {k: list(v) for k, v in children_of.items()}
    for pk, o in ov.items():
        for t in o.get("add", []):
            ck = _shindan_norm(t)
            if ck not in by_key:
                print(f"  ⚠ game_series.json: add指定「{t}」が索引に見つかりません")
                continue
            if ck in page_child_of:
                continue
            page_child_of[ck] = by_key[pk]
            page_children_of.setdefault(pk, []).append(ck)

    for m in (children_of, page_children_of):
        for k in m:
            m[k].sort(key=lambda ck: by_key[ck]["reading"])
    return child_of, children_of, page_child_of, page_children_of


def game_item_href(item, root_to_games=""):
    """索引・チップからのリンク先: ページがあれば個別ページ、なければ唯一の登場回へ"""
    if item["paged"]:
        return f"{root_to_games}{item['slug']}.html"
    return f"{root_to_games}../episodes/{item['eps'][0]['num']}.html"


def game_slug_map():
    """エピソードページのタグリンク用: 名寄せキー → データベースページのスラッグ
    (個別ページを持つタイトルのみ)"""
    m = {}
    for item in games_db():
        if item["paged"]:
            m[item["key"]] = item["slug"]
    return m


# 語られ度の絵文字とバッジ文言(変えたいときはここ。索引の凡例・絞り込みボタンにも反映される)
LEVEL_BADGE = {
    3: ("l3", "⭐ メインで語られた回"),
    2: ("l2", "🍜 滝壺3分ゲーム紹介"),
    1: ("l1", "📑 チャプターで登場"),
    0: ("l0", "💬 トーク内で登場"),
}
LEVEL_MARK = {3: "⭐", 2: "🍜", 1: "📑", 0: ""}


def _game_aliases_for(item, alias_pairs):
    """タイトルに対応する略称(検索用)を返す"""
    out = []
    for alias, canonical in alias_pairs:
        if _shindan_norm(canonical) and _shindan_norm(canonical) in item["key"]:
            out.append(alias)
    return out


def build_games():
    (ROOT / "games").mkdir(exist_ok=True)
    items = games_db()
    try:
        alias_data = json.loads((ROOT / "data/aliases.json").read_text(encoding="utf-8"))
        alias_pairs = [(a, t["canonical"]) for t in alias_data.get("titles", []) for a in t.get("aliases", [])]
    except FileNotFoundError:
        alias_pairs = []

    total = len(items)
    nobe = sum(i["count"] for i in items)
    main_count = sum(1 for i in items if i["max_level"] == 3)
    sanbun_count = sum(1 for i in items if any(x["level"] == 2 for x in i["eps"]))
    base = SITE["base_url"].rstrip("/")

    # ---------- 索引ページ ----------
    root = "../"
    sections = {sec: [] for sec in GAME_SECTIONS}
    for i in items:
        sections[i["section"]].append(i)
    for sec in sections:
        sections[sec].sort(key=lambda i: (i["reading"], i["title"]))

    top_items = sorted(items, key=lambda i: (-i["count"], i["reading"]))[:20]
    top_html = "".join(
        f'<a class="gm-top-chip" href="{game_item_href(i)}"><span class="gm-top-rank">{n + 1}</span>'
        f'<span class="gm-top-title">{esc(i["title"])}</span><span class="gm-top-count">{i["count"]}回</span></a>'
        for n, i in enumerate(top_items))

    letter_nav = "".join(
        f'<a href="#sec-{esc(sec)}">{esc(sec)}</a>' for sec in GAME_SECTIONS if sections[sec])

    # 索引の字下げは前方一致(child_of)のみ、ページの関連表示はadd補正込み(page_*)を使う
    child_of, children_of, page_child_of, page_children_of = games_series_map()
    by_key = {i["key"]: i for i in items}

    def item_card(i, child=False):
        search_key = _to_kata(_n_light(i["title"])) + _to_kata(_n_light(i["reading"]))
        for a in _game_aliases_for(i, alias_pairs):
            search_key += _to_kata(_n_light(a))
        mark = LEVEL_MARK[i["max_level"]]
        has_sanbun = any(x["level"] == 2 for x in i["eps"])
        # メイン(lv3)>3分(s3)の順で目立つ背景色を付ける(色は style.css の .gm-item.lv3 / .s3)
        cls = ("gm-item child" if child else "gm-item")
        cls += " lv3" if i["max_level"] == 3 else (" s3" if has_sanbun else "")
        attrs = f' data-s="{esc(search_key)}"'
        if i["max_level"] == 3:
            attrs += ' data-lv3="1"'
        if has_sanbun:
            attrs += ' data-s3="1"'
        # 個別ページのないタイトルは該当回へ直接飛ぶので、行き先の回番号を予告する
        meta = f"{mark}{i['count']}回" if i["paged"] else f"1回 → #{i['eps'][0]['num']}"
        return (f'<a class="{cls}" href="{game_item_href(i)}"{attrs}>'
                f'<span class="gm-item-title">{esc(i["title"])}</span>'
                f'<span class="gm-item-meta">{meta}</span></a>')

    body_sections = ""
    for sec in GAME_SECTIONS:
        rows = sections[sec]
        if not rows:
            continue
        cards = ""
        for i in rows:
            if i["key"] in child_of and child_of[i["key"]]["section"] == sec:
                continue  # 親(○○シリーズ)の直後にぶら下げて表示する
            cards += item_card(i)
            for ck in children_of.get(i["key"], []):
                if by_key[ck]["section"] == sec:
                    cards += item_card(by_key[ck], child=True)
        body_sections += (f'<section class="gm-section" id="sec-{esc(sec)}">'
                          f'<h2 class="gm-letter">{esc(sec)}<span class="gm-letter-count">{len(rows)}</span></h2>'
                          f'<div class="gm-grid">{cards}</div></section>')

    page = head("滝壺データベース｜語られた全ゲームタイトル索引",
                f"ゲーム系ポッドキャスト「ゲームの滝壺」全{EP_COUNT}回で話題に出たゲーム全{total}タイトルの索引。どの回のどのあたりで語られたかまで引けます。あなたの好きなあのゲームも、もう語られているかも。",
                root, "games/")
    page += header(root, "games")
    page += f"""<main class="container">
<div class="page-head" style="text-align:center;">
<h1 class="page-title"><span class="en">TAKITSUBO DATABASE</span>滝壺データベース</h1>
<p style="font-size:13px;color:var(--sub);margin-top:8px;">これまでの全{EP_COUNT}回で話題に出たゲームタイトルの索引です。<br>がっつり特集した一本も、雑談にちらっと出ただけの一本も、ぜんぶ載っています。</p>
</div>

<div class="gm-stats">
<span class="gm-stat"><strong>{total}</strong>タイトル</span>
<span class="gm-stat"><strong>{nobe}</strong>延べ登場</span>
<span class="gm-stat"><strong>{main_count}</strong>メインで語られた</span>
<span class="gm-stat"><strong>{sanbun_count}</strong>3分ゲーム紹介</span>
</div>

<div class="searchbox" style="margin-top:18px;">{SVG['search']}
<input type="search" id="gmQ" placeholder="ゲーム名で探す（例:シレン、どらくえ、FF）" aria-label="タイトルを検索" autocomplete="off">
<button type="button" class="search-clear" id="gmClear" aria-label="検索キーワードを消す" hidden>{SVG['close']}</button>
</div>
<div class="filter-row" role="group" aria-label="語られ度で絞り込み" style="justify-content:center;margin-bottom:0;">
<span class="filter-label">絞り込み</span>
<button class="filter-btn on" data-flv="all">すべて</button>
<button class="filter-btn" data-flv="lv3">{LEVEL_MARK[3]} メインで語られた</button>
<button class="filter-btn" data-flv="s3">{LEVEL_MARK[2]} 3分ゲーム紹介</button>
</div>
<p class="gm-count" id="gmCount"></p>
<div id="gmEmpty" class="empty-box" hidden>
<p class="empty-title">🔍 該当するタイトルが見つかりませんでした</p>
<ul class="empty-hint">
<li>別の表記で試してみてください（例: FF ↔ ファイナルファンタジー、ドラクエ ↔ ドラゴンクエスト）</li>
<li>ひらがな・カタカナは自動で変換されます（「しれん」でもOK）</li>
<li>絞り込みボタンを「すべて」に戻すと対象が広がります</li>
</ul>
</div>

<section class="section" style="padding-top:20px;">
{sec_title("よく語られているタイトル", "MOST TALKED")}
<div class="gm-top">{top_html}</div>
</section>

<nav class="gm-letter-nav" aria-label="五十音で移動">{letter_nav}</nav>
{body_sections}

<div class="gm-note">{LEVEL_MARK[3]}=メインで語られた回あり ／ {LEVEL_MARK[2]}=滝壺3分ゲーム紹介で紹介 ／ {LEVEL_MARK[1]}=チャプターに登場 ／ 無印=トークの中で話題に出たタイトル<br>一度だけ話題に出たタイトルは、その回のページへ直接リンクします。<br>索引は毎週の配信にあわせて自動で増えていきます。</div>
</main>
<script src="{root}assets/js/games.js?v={av('assets/js/games.js')}"></script>"""
    page += footer(root)
    (ROOT / "games/index.html").write_text(page, encoding="utf-8")

    # ---------- タイトル個別ページ ----------
    # 品質ゲートの変動で残る古いページを掃除してから生成する
    for old in (ROOT / "games").glob("g*.html"):
        old.unlink()
    co_all = {i["key"]: i for i in items}
    eps_to_titles = {}
    for i in items:
        for ep in i["eps"]:
            eps_to_titles.setdefault(ep["num"], []).append(i["key"])

    for i in items:
        if not i["paged"]:
            continue  # 1回ちょい出しのみのタイトルは個別ページを作らない(索引→該当回へ直接)
        title = i["title"]
        eps_sorted = sorted(i["eps"], key=lambda x: (-x["level"], -x["num"]))
        best_img = next((ep_image(EPS_BY_NUM[x["num"]]) for x in eps_sorted if ep_image(EPS_BY_NUM[x["num"]])), None)

        # 期待値を正直に伝えるサマリー
        if i["max_level"] == 3:
            summary = "メインテーマとして語られた回があります。"
        elif i["max_level"] == 2:
            summary = "コーナー「滝壺3分ゲーム紹介」で紹介したタイトルです。"
        elif i["max_level"] == 1:
            summary = "コーナーやチャプターの話題として語られています。"
        elif i["count"] >= 2:
            summary = "トークの中でたびたび話題に出ているタイトルです。"
        else:
            summary = "トークの中で、ちらっと話題に出たタイトルです。"

        rows = ""
        for x in eps_sorted:
            e = EPS_BY_NUM[x["num"]]
            img = ep_image(e)
            art = (f'<img class="gm-ep-img" src="../{img}" alt="" loading="lazy">' if img
                   else f'<span class="gm-ep-img gm-ep-num">#{e["number"]}</span>')
            cls, label = LEVEL_BADGE[x["level"]]
            # 該当チャプター: 音声のある回は「▶ その話題の頭から再生」リンクにする
            # (行全体のリンクは a.gm-ep-main の透明レイヤーが担い、チップはその上に載る)
            chap_html = ""
            if x["chapters"]:
                chips = ""
                for c in x["chapters"][:3]:
                    sec = time_to_sec(c["time"])
                    if e.get("audio") and sec is not None:
                        chips += (f'<a class="gm-chap play" href="../episodes/{e["number"]}.html?t={sec}" '
                                  f'title="第{e["number"]}回をこの話題の頭から再生">▶ {esc(c["time"])}〜 {esc(c["label"])}</a>')
                    else:
                        chips += f'<span class="gm-chap">⏱ {esc(c["time"])}〜 {esc(c["label"])}</span>'
                chap_html = f'<span class="gm-chaps">{chips}</span>'
            desc = (e["description"] or "").replace("\n", " ")
            desc = f'<span class="gm-ep-desc">{esc(desc[:110])}{"…" if len(desc) > 110 else ""}</span>' if desc else ""
            rows += f"""<div class="gm-ep">{art}
<span class="gm-ep-body">
<span class="gm-ep-head"><span class="gm-ep-hash">#{e['number']}</span><span class="gm-ep-date">{jd(e['date'])}</span><span class="gm-badge {cls}">{label}</span></span>
<a class="gm-ep-main" href="../episodes/{e['number']}.html"><span class="gm-ep-title">{esc(e['title'])}</span></a>
{chap_html}{desc}
</span></div>"""

        # シリーズ親ページ: 子作品の登場回を自動合算して表示
        # (概要欄に「シリーズ」を併記しなくても、作品の回がここに集まる)
        agg_html = ""
        if i["key"] in page_children_of:
            own_level = {x["num"]: x["level"] for x in i["eps"]}
            agg = {}
            for ck in page_children_of[i["key"]]:
                for x in by_key[ck]["eps"]:
                    # 自分(シリーズ)の一覧に既にあっても、作品側の語られ度が上回る回は載せる
                    # (例: 第1回はシリーズとしては💬だが「風来のシレン」の🎙回)
                    if x["level"] > own_level.get(x["num"], -1):
                        agg.setdefault(x["num"], []).append((by_key[ck], x["level"]))
            if agg:
                agg_rows = ""
                for num in sorted(agg, key=lambda n: (-max(lv for _, lv in agg[n]), -n)):
                    e = EPS_BY_NUM[num]
                    best = max(lv for _, lv in agg[num])
                    img = ep_image(e)
                    art = (f'<img class="gm-ep-img" src="../{img}" alt="" loading="lazy">' if img
                           else f'<span class="gm-ep-img gm-ep-num">#{e["number"]}</span>')
                    cls, label = LEVEL_BADGE[best]
                    works_list = sorted(agg[num], key=lambda t: -t[1])
                    works = "、".join(f'{esc(m["title"])}{LEVEL_MARK[lv]}' for m, lv in works_list[:4])
                    if len(works_list) > 4:
                        works += f" ほか{len(works_list) - 4}作品"
                    agg_rows += f"""<a class="gm-ep" href="../episodes/{e['number']}.html">{art}
<span class="gm-ep-body">
<span class="gm-ep-head"><span class="gm-ep-hash">#{e['number']}</span><span class="gm-ep-date">{jd(e['date'])}</span><span class="gm-badge {cls}">{label}</span></span>
<span class="gm-ep-title">{esc(e['title'])}</span>
<span class="gm-ep-desc">この回の作品: {works}</span>
</span></a>"""
                agg_html = (f'<section class="section">{sec_title("シリーズ作品が登場した回", "TITLES IN SERIES")}'
                            f'<div class="gm-eps">{agg_rows}</div></section>')

        # 同シリーズのタイトル(「○○シリーズ」による自動グループ+game_series.jsonの補正)
        series_html = ""
        group_parent = i if i["key"] in page_children_of else page_child_of.get(i["key"])
        if group_parent is not None:
            members = [group_parent] + [by_key[ck] for ck in page_children_of.get(group_parent["key"], [])]
            others = [m for m in members if m["key"] != i["key"]]
            if others:
                chips = "".join(f'<a class="tag" href="{game_item_href(m)}">{esc(m["title"])}</a>' for m in others)
                series_html = f'<section class="section">{sec_title("同シリーズのタイトル", "SAME SERIES")}<div class="game-tags">{chips}</div></section>'

        # 同じ回で話題に出た他タイトル(内部リンク)
        co = {}
        for x in i["eps"]:
            for k2 in eps_to_titles.get(x["num"], []):
                if k2 != i["key"]:
                    co[k2] = co.get(k2, 0) + 1
        related = sorted(co.items(), key=lambda kv: (-kv[1], co_all[kv[0]]["reading"]))[:8]
        rel_html = ""
        if related:
            chips = "".join(f'<a class="tag" href="{game_item_href(co_all[k2])}">{esc(co_all[k2]["title"])}</a>'
                            for k2, _ in related)
            rel_html = f'<section class="section">{sec_title("同じ回で話題に出たタイトル", "TALKED TOGETHER")}<div class="game-tags">{chips}</div></section>'

        crumbs_ld = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ホーム", "item": base + "/"},
                {"@type": "ListItem", "position": 2, "name": "滝壺データベース", "item": base + "/games/"},
                {"@type": "ListItem", "position": 3, "name": title},
            ],
        }
        page = head(f"{title} が語られた回",
                    f"ゲーム系ポッドキャスト「ゲームの滝壺」で「{title}」が話題に出たエピソード一覧。登場{i['count']}回。{summary}",
                    root, f"games/{i['slug']}.html", og_image=best_img, jsonld=crumbs_ld)
        page += header(root, "games")
        page += f"""<main class="container">
<p class="gm-back"><a href="./">← 滝壺データベース</a></p>
<div class="page-head">
<h1 class="page-title gm-title">{esc(title)}</h1>
<p class="gm-lede">ポッドキャスト「ゲームの滝壺」で「{esc(title)}」が話題に出た回の一覧です。</p>
<p class="gm-summary"><span class="gm-summary-count">滝壺での登場 <strong>{i['count']}回</strong></span>{esc(summary)}</p>
</div>
<div class="gm-eps">{rows}</div>
{agg_html}
{series_html}
{rel_html}
<div class="info-box" style="margin-top:22px;">🎧 ▶付きの時刻を押すと、その話題の頭からその場で再生できます。
「{esc(title)}」の話がもっと聴きたくなったら、<a href="../otayori.html">おたより</a>でリクエストしてもらえると番組が喜びます。</div>
<p style="text-align:center;margin-top:18px;"><a class="service-btn" style="display:inline-flex;" href="../shindan.html">👑 あなたに"ふさわしい一本"を診断する</a></p>
</main>"""
        page += footer(root)
        (ROOT / f"games/{i['slug']}.html").write_text(page, encoding="utf-8")

    return sum(1 for i in items if i["paged"])


# ============================================================ 検索用スリムJSON
def build_search_json():
    """一覧ページの検索が読む軽量JSON。表示に使う項目だけ残す
    (episodes.json の image_src 等の内部情報は公開物に含めない)"""
    slim = [
        {"number": e["number"], "title": e["title"], "date": e["date"],
         "tags": e["tags"], "games": [g for _, g in episode_game_entries(e)],
         "image": e.get("image")}
        for e in EPS
    ]
    (ROOT / "data/search.json").write_text(
        json.dumps({"episodes": slim}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")


# ============================================================ sitemap
def build_sitemap():
    base = SITE["base_url"].rstrip("/")
    today = datetime.date.today().isoformat()
    latest = EPS[-1]["date"] if EPS else today
    # (URL, 最終更新日): エピソード=配信日 / お知らせ=掲載日 / 一覧系=最新回の配信日
    urls = [("", latest), ("episodes/", latest), ("series/", latest),
            ("news/", NEWS[-1]["date"] if NEWS else today),
            ("shindan.html", latest), ("games/", latest),
            ("guide.html", today), ("otayori.html", today), ("privacy.html", today)]
    urls += [(f"episodes/{e['number']}.html", e["date"]) for e in EPS]
    urls += [(f"games/{i['slug']}.html", EPS_BY_NUM[max(x["num"] for x in i["eps"])]["date"])
             for i in games_db() if i["paged"]]
    urls += [(f"series/{s['slug']}.html", latest) for s in SERIES]
    urls += [(f"news/{n['slug']}.html", n["date"]) for n in NEWS]
    body = "".join(f"<url><loc>{base}/{u}</loc><lastmod>{d}</lastmod></url>" for u, d in urls)
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>',
        encoding="utf-8")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")


if __name__ == "__main__":
    build_search_json()    # 先に生成(episode一覧ページが ?v= のハッシュを参照するため)
    build_shindan_json()   # 同上(診断ページが ?v= のハッシュを参照)
    build_shindan()
    n_games = build_games()
    build_index()
    build_episode_list()
    build_episode_pages()
    build_series()
    build_news()
    build_guide()
    build_otayori()
    build_privacy()
    build_sitemap()
    print(f"ビルド完了: エピソード{len(EPS)}ページ + シリーズ{len(SERIES)}ページ + データベース{n_games}ページ + その他")
