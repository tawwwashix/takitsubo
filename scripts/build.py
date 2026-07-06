# -*- coding: utf-8 -*-
"""ゲームの滝壺 公式サイト ビルドスクリプト
data/*.json を読み込み、全HTMLページを生成する。
使い方:  python3 scripts/build.py
"""
import json, html, pathlib, datetime, hashlib, re, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent


def x_post_url(text):
    """押すとXの投稿画面が開き、textが本文に入っているリンクを返す"""
    return "https://x.com/intent/post?text=" + urllib.parse.quote(text)


def spotify_embed_url(link):
    """SpotifyのエピソードリンクをiFrame埋め込み用URLに変換。変換不能ならNone"""
    m = re.match(
        r"https://(?:podcasters|creators)\.spotify\.com/pod/(?:show|profile)/([^/]+)/(?:embed/)?episodes/([^/?#]+)",
        link or "")
    if m:
        return f"https://creators.spotify.com/pod/profile/{m.group(1)}/embed/episodes/{m.group(2)}"
    return None


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
esc = html.escape


def jd(iso):  # 2026-07-01 -> 2026.07.01
    return iso.replace("-", ".")


SVG = {
    "play": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72L19 12 8 5.14z"/></svg>',
    "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    "close": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    "arrow_l": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>',
    "mail": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    "x": '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.4Z"/></svg>',
    "spotify": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.83-1.73-6.39-2.12-10.59-1.16a.75.75 0 1 1-.33-1.46c4.56-1.04 8.49-.59 11.64 1.34.36.22.47.68.31 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.24-1.99-8.18-2.57-12-1.4a.94.94 0 1 1-.55-1.79c4.38-1.34 9.8-.69 13.53 1.6.44.27.58.85.31 1.28Zm.13-3.4C15.24 8.32 8.85 8.11 5.15 9.24a1.12 1.12 0 1 1-.65-2.16c4.25-1.29 11.32-1.04 15.78 1.6a1.12 1.12 0 0 1-1.18 1.95Z"/></svg>',
    "podcast": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="11" r="2.5"/><path d="M8.5 20.5 9.7 15a3.9 3.9 0 0 1 4.6 0l1.2 5.5M6.2 14.4a7 7 0 1 1 11.6 0M3.4 16.6a11 11 0 1 1 17.2 0"/></svg>',
    "youtube": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.12-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 0 0 2.12-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"/></svg>',
}
SERVICE_ICON = {"spotify": "spotify", "apple": "podcast", "amazon": "podcast", "listen": "podcast", "youtube": "youtube"}

WAVE = (
    '<svg class="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">'
    '<path d="M0 45 C 240 90 480 0 720 40 C 960 80 1200 10 1440 50 L 1440 90 L 0 90 Z" fill="#EAF6FE"/></svg>'
)


def head(title, desc, root, path="", og_image=None, jsonld=None, og_type="website", published=None):
    full = f'{esc(title)} | {SITE["title"]}' if title else esc(SITE["title"])
    url = SITE["base_url"].rstrip("/") + "/" + path
    og_img = SITE["base_url"].rstrip("/") + "/" + (og_image or "assets/img/ogp.png")
    ld = f'\n<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>' if jsonld else ""
    pub = f'\n<meta property="article:published_time" content="{published}">' if published else ""
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
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&family=Noto+Sans+JP:wght@400;500;700&family=Outfit:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/css/style.css?v={av('assets/css/style.css')}">{ld}
</head>
<body>"""


def header(root, current=""):
    items = [
        ("index.html", "ホーム", "home"),
        ("episodes/", "エピソード", "episodes"),
        ("series/", "名物企画", "series"),
        ("shindan.html", "診断", "shindan"),
        ("news/", "お知らせ", "news"),
        ("guide.html", "聴き方", "guide"),
        ("otayori.html", "おたより", "otayori"),
    ]
    links = ""
    for href, label, key in items:
        current_attr = ' aria-current="page"' if key == current else ""
        links += f'<a href="{root}{href}"{current_attr}>{label}</a>'
    # 外部リンク: 公式X・ブログ
    blog = SITE["members"][0].get("blog", {})
    blog_url = blog.get("url", "#")
    if blog_url.startswith("TODO"): blog_url = "#"
    links += f'<a class="nav-ext" href="{SITE["x_url"]}" target="_blank" rel="noopener">{SVG["x"]}公式X</a>'
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
        f'<a href="{root}series/">名物企画</a><a href="{root}news/">お知らせ</a>'
        f'<a href="{root}shindan.html">ふさわしいゲーム診断</a>'
        f'<a href="{root}guide.html">ポッドキャストの聴き方</a><a href="{root}otayori.html">おたより</a>'
        f'<a href="{SITE["x_url"]}" target="_blank" rel="noopener">公式X</a>'
        f'<a href="{esc(blog_url)}" target="_blank" rel="noopener">ブログ「{esc(blog.get("label", "ブログ"))}」</a>'
    )
    return f"""<footer class="site-footer"><div class="footer-inner">
<div class="footer-brand"><img class="footer-logo" src="{root}assets/img/logo_wide.png" alt="{SITE['title']}"></div>
<div class="footer-en">GAME NO TAKITSUBO — WEEKLY GAME TALK PODCAST</div>
<p class="footer-desc">{esc(SITE['tagline'])}。{esc(SITE['schedule'])}。感想は {esc(SITE['hashtag'])} でどうぞ。</p>
<nav class="footer-nav" aria-label="フッターメニュー">{nav}</nav>
<p class="footer-note">お問い合わせ: <a href="mailto:{SITE['email']}">{SITE['email']}</a><br>
おたよりフォームでいただいた内容は番組内で紹介させていただくことがあります。個人情報は番組運営の目的以外には使用しません。<br>
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
    egames = set(e["games"])
    scored = []
    for o in EPS:
        if o["number"] == e["number"]:
            continue
        score = 0
        if e["series"] and o["series"] == e["series"]:
            score += 3
        score += min(len(egames & set(o["games"])), 3)
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
    ep_count = sum(1 for e in EPS if e["number"] > 0)  # 第0回(番組紹介)は配信回数に含めない
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
<p class="catch">{esc(SITE['tagline']).replace('ならなんでも', 'なら<br>なんでも')}</p>
<div class="hero-chips">
<span class="chip">{esc(SITE['schedule'])}</span>
<span class="chip">全{ep_count}回配信中</span>
</div>
<a class="cta-primary" href="episodes/{latest['number']}.html">{SVG['play']}最新回 #{latest['number']} を聴く</a>
<span class="cta-note">アプリ不要・会員登録不要・すべて無料</span>
<span class="services-label">ON AIR — 各サービスで配信中</span>
<div class="services">{service_buttons(root)}</div>
</div>
</div>
</div>
{WAVE}
<main class="container">

{news_bar}

<section class="section">
<div class="info-box"><strong>ポッドキャストってなに?</strong><br>
無料で聴けるネットラジオのようなものです。アプリを入れなくても、上のボタンからブラウザですぐ再生できます。通勤・家事・寝る前のおともにどうぞ。
<a href="guide.html">くわしい聴き方はこちら →</a></div>
</section>

<section class="section">
<a class="shindan-banner" href="shindan.html">
<img class="sb-chara" src="assets/img/rock_ichigo.png" alt="" aria-hidden="true">
<span class="sb-body">
<span class="sb-en">FUSAWASHII GAME SHINDAN</span>
<span class="sb-title">あなたに"ふさわしいゲーム"を診断!</span>
<span class="sb-desc">全{ep_count}回のトークデータ・{shindan_count}タイトルの中から、運命の一本が見つかる。結果はシェアして自慢しよう。</span>
</span>
<span class="sb-cta">診断する →</span>
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
YouTubeでは<a href="{SITE['services']['youtube']['url']}" target="_blank" rel="noopener">ゲーム実況</a>も配信中!</p>
</section>

<section class="section band band-soft">
{sec_title("お知らせ", "NEWS", '<a class="section-more" href="news/">一覧へ →</a>')}
<div class="news-list">{news_items}</div>
</section>

<section class="section band band-blue">
{sec_title("公式X", "OFFICIAL X")}
<div class="card" style="text-align:center;padding:26px 20px;">
<p style="font-size:14px;color:var(--sub);margin-bottom:18px;">最新情報・配信告知・こぼれ話は公式Xで。<br>
感想は <strong style="color:var(--ink);">{esc(SITE['hashtag'])}</strong> でポストしていただければ、すべて読んでいます!</p>
<div class="x-actions">
<a class="service-btn x-post" href="{esc(x_post_url(SITE['hashtag'] + ' '))}" target="_blank" rel="noopener">{SVG['x']}{esc(SITE['hashtag'])} でポストする</a>
<a class="service-btn" href="{SITE['x_url']}" target="_blank" rel="noopener">{SVG['x']}{esc(SITE['x_handle'])} をフォロー</a>
</div>
</div>
</section>

<section class="section band band-soft">
{sec_title("おたより募集中", "LETTERS")}
<div class="grid-2">
<a class="card" href="otayori.html"><strong>📮 おたよりフォーム</strong><br><span style="font-size:12px;color:var(--sub);">番組の感想・リクエスト・クイズの回答はこちらから</span></a>
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
<input type="search" id="q" placeholder="ゲーム名・キーワードで検索(例:ドラクエ、わるい村、#50)" aria-label="エピソードを検索" autocomplete="off">
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
<li>別の表記で試してみてください(例: FF ↔ ファイナルファンタジー、ドラクエ ↔ ドラゴンクエスト)</li>
<li>ひらがな・カタカナは自動で変換されます(「どらくえ」でもOK)</li>
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
    for i, e in enumerate(EPS):
        n = e["number"]
        prev_e = EPS[i - 1] if i > 0 else None
        next_e = EPS[i + 1] if i < len(EPS) - 1 else None

        tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in e["tags"])
        date_note = ' <span class="date-note">(推定)</span>' if e.get("date_estimated") else ""

        desc_html = f'<div class="card ep-desc">{esc(e["description"])}</div>' if e["description"] else ""

        games_html = ""
        if e["games"]:
            gtags = "".join(f'<a class="tag" href="index.html?q={esc(g)}">{esc(g)}</a>' for g in e["games"])
            games_html = f'<section class="section">{sec_title("登場ゲームタイトル・キーワード", "GAMES & KEYWORDS")}<div class="game-tags">{gtags}</div></section>'

        chapters_html = ""
        if e["chapters"]:
            items = "".join(f'<li><span class="chapter-time">{esc(c["time"])}</span><span>{esc(c["label"])}</span></li>' for c in e["chapters"])
            chapters_html = f'<section class="section">{sec_title("チャプター", "CHAPTERS")}<ul class="chapter-list">{items}</ul></section>'

        series_html = ""
        if e["series"]:
            s = next(s for s in SERIES if s["slug"] == e["series"])
            series_html = f'<p style="margin-top:14px;font-size:13px;">この回は名物企画「<a href="../series/{s["slug"]}.html">{esc(s["name"])}</a>」のひとつです。</p>'

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

        # Spotify埋め込みプレイヤー(クリックしたときだけiframeを読み込む軽量方式)
        embed = spotify_embed_url(e["links"].get("spotify"))
        player_html = ""
        if embed:
            player_html = f"""<div class="player-box" data-embed="{esc(embed)}">
<button class="player-load" type="button">{SVG['play']}この回をこのページで再生<span class="player-note">(Spotifyプレイヤーを読み込みます)</span></button>
</div>"""

        # おたより/Xポストのボタン(上下2箇所に置く)
        share_text = f'第{n}回 {e["title"]}\n{SITE["hashtag"]}\n{SITE["base_url"].rstrip("/")}/episodes/{n}.html'
        actions_html = f"""<div class="ep-actions">
<a class="service-btn otayori" href="../otayori.html">📮 この回の感想をおたよりで送る</a>
<a class="service-btn x-post" href="{esc(x_post_url(share_text))}" target="_blank" rel="noopener">{SVG['x']}Xで感想をポスト</a>
</div>"""

        page += f"""
<main class="container">
<div class="page-head">
<a class="back-link" href="index.html">{SVG['arrow_l']}エピソード一覧へ</a>
<div class="detail-hero">
{f'<img class="detail-art" src="{root}{ep_image(e)}" alt="第{n}回のアートワーク">' if ep_image(e) else f'<span class="detail-num">#{n}</span>'}
<div><h1 class="page-title" style="font-size:20px;">{esc(e['title'])}</h1>
<p class="detail-meta">{f'#{n} ・ ' if ep_image(e) else ''}{jd(e['date'])} 配信{date_note}</p>
<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">{tags}</div></div>
</div>
{player_html}
<div class="listen-row">{service_buttons(root, e['links'])}</div>
{desc_html}{series_html}
{actions_html}
</div>
{games_html}
{chapters_html}
{related_html}
{pn}
{actions_html}
</main>"""
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
    page = head("ポッドキャストの聴き方", "ポッドキャストとは?無料?アプリは必要?ゲームの滝壺の聴き方をやさしく解説。", root, "guide.html")
    page += header(root, "guide")
    page += f"""<main class="container">
<div class="page-head"><h1 class="page-title"><span class="en">HOW TO LISTEN</span>ポッドキャストの聴き方</h1></div>

<section class="section">
{sec_title("ポッドキャストってなに?", "ABOUT PODCAST")}
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
それだけです! アプリを入れると、新しい回の通知を受け取れて便利です。</p>
<p><strong style="color:var(--ink);">3. 気に入ったら「フォロー」</strong><br>
毎週水曜23時ごろの新エピソードを見逃さずに聴けます。</p>
<div class="services" style="margin-top:18px;">{service_buttons(root)}</div>
</div>
</section>

<section class="section">
{sec_title("YouTubeではゲーム実況も!", "YOUTUBE")}
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
<p style="font-size:13px;color:var(--sub);margin-top:6px;">番組の感想、話してほしいテーマ、アートワーククイズの回答など、なんでもお寄せください。いただいたおたよりは番組内で紹介させていただくことがあります。</p></div>

<div class="form-embed" style="margin-top:16px;">
<iframe src="{SITE['otayori_form']}" title="おたよりフォーム" loading="lazy">読み込んでいます…</iframe>
</div>

<div class="info-box" style="margin-top:18px;">
フォームがうまく表示されない場合は <a href="{SITE['otayori_form']}" target="_blank" rel="noopener">こちらから直接開く</a> か、
メール(<a href="mailto:{SITE['email']}">{SITE['email']}</a>)でも受け付けています。
Xのハッシュタグ {esc(SITE['hashtag'])} での感想もすべて読んでいます!
<div class="x-actions" style="margin-top:14px;">
<a class="service-btn x-post" href="{esc(x_post_url(SITE['hashtag'] + ' '))}" target="_blank" rel="noopener">{SVG['x']}{esc(SITE['hashtag'])} でポストする</a>
</div>
</div>
</main>"""
    page += footer(root)
    (ROOT / "otayori.html").write_text(page, encoding="utf-8")


# ============================================================ ふさわしいゲーム診断
def shindan_pool():
    """診断プール: 全エピソードの登場ゲームを集計。番組が更新されると自動で増える。
    各ゲームに「最も関連していそうな回」(games配列の先頭近く=メインで語られた
    可能性が高い回を優先、同点なら新しい回)を紐づける。"""
    stats = {}
    for e in EPS:
        for i, g in enumerate(e["games"]):
            # まとめ行(○○／○○)・見出しの取りこぼし(【…】や※付き)・
            # 投稿者名付き(「○○さん：タイトル」)は診断プールから除外
            if "／" in g or g.startswith("【") or "※" in g or "さん：" in g:
                continue
            s = stats.setdefault(g, {"count": 0, "best": None})
            s["count"] += 1
            pos_score = max(0, 10 - i)  # 概要欄の先頭に近いほどメインの話題
            # エピソードタイトルにゲーム名が入っていれば、確実にメインで語った回
            title_hit = len(g) >= 4 and (g in e["title"] or g[:6] in e["title"])
            key = ((100 if title_hit else 0) + pos_score, e["number"])
            if s["best"] is None or key > s["best"]:
                s["best"] = key
    games, used_eps = [], {}
    for title, s in sorted(stats.items(), key=lambda kv: (-kv[1]["count"], kv[0])):
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
    page = head("ふさわしいゲーム診断", f"8つの質問で、あなたに\"ふさわしいゲーム\"を診断。ゲームの滝壺が全{len(EPS)}回で語ってきた{n_games}タイトルの中から、運命の一本を選びます。",
                root, "shindan.html")
    page += header(root, "shindan")
    page += f"""
<main class="container">
<div class="page-head" style="text-align:center;">
<h1 class="page-title"><span class="en">FUSAWASHII GAME SHINDAN</span>ふさわしいゲーム診断</h1>
<p style="font-size:13px;color:var(--sub);margin-top:8px;">滝壺の3人がこれまでに語ってきた <strong style="color:var(--primary-deep);">全{n_games}タイトル</strong> の中から、<br>いまのあなたに"ふさわしい一本"を診断します。</p>
</div>
<div class="shindan-stage" id="shindanPanel" data-site="{esc(base)}" data-hashtag="{esc(SITE['hashtag'])}">
<p style="text-align:center;color:var(--faint);padding:40px 0;">読み込み中…</p>
</div>
<p class="search-note" style="text-align:center;margin-top:14px;">診断プールは番組の全エピソードから自動生成。<br>新しい回が配信されるたびに、結果の種類も増えていきます。</p>
</main>
<script>window.__shindanVer="{av('data/shindan.json')}";</script>
<script src="{root}assets/js/shindan.js?v={av('assets/js/shindan.js')}"></script>"""
    page += footer(root)
    (ROOT / "shindan.html").write_text(page, encoding="utf-8")


# ============================================================ 検索用スリムJSON
def build_search_json():
    """一覧ページの検索が読む軽量JSON。表示に使う項目だけ残す
    (episodes.json の image_src 等の内部情報は公開物に含めない)"""
    slim = [
        {"number": e["number"], "title": e["title"], "date": e["date"],
         "tags": e["tags"], "games": e["games"], "image": e.get("image")}
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
            ("shindan.html", latest),
            ("guide.html", today), ("otayori.html", today)]
    urls += [(f"episodes/{e['number']}.html", e["date"]) for e in EPS]
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
    build_index()
    build_episode_list()
    build_episode_pages()
    build_series()
    build_news()
    build_guide()
    build_otayori()
    build_sitemap()
    print(f"ビルド完了: エピソード{len(EPS)}ページ + シリーズ{len(SERIES)}ページ + その他")
