"""Shared HTML components, formatting and content-based asset versions."""
import datetime
import hashlib
import json
import re
import urllib.parse
from .catalog import episode_game_entries
from .context import EPS, ROOT, SITE, esc


def x_post_url(text):
    """押すとXの投稿画面が開き、textが本文に入っているリンクを返す"""
    return "https://x.com/intent/post?text=" + urllib.parse.quote(text)


def _version_bytes(path):
    """Text assets have the same version in LF and CRLF checkouts."""
    content = path.read_bytes()
    if path.suffix.lower() in {".js", ".css", ".json"}:
        content = content.replace(b"\r\n", b"\n")
    return content


def av(rel):
    """アセットのキャッシュバスター。内容が変わるとURLの ?v= も変わり、
    ブラウザ(特にスマホ)が古いCSS/JSを掴み続けるのを防ぐ。"""
    try:
        return hashlib.md5(_version_bytes(ROOT / rel)).hexdigest()[:8]
    except FileNotFoundError:
        return "0"


URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\u3000\"']+")


URL_TRAILING = ".,!?;:)]}。、，！？；：）〕］」』〉》】…"


def linkify_text(text):
    """概要欄のURLだけを安全な外部リンクにし、他の文字はHTMLエスケープする。"""
    text = text or ""
    out, end = [], 0
    for match in URL_RE.finditer(text):
        out.append(esc(text[end:match.start()]))
        url = match.group(0)
        trailing = ""
        while url and url[-1] in URL_TRAILING:
            trailing = url[-1] + trailing
            url = url[:-1]
        if not url:
            out.append(esc(match.group(0)))
        else:
            href = url if url.startswith(("http://", "https://")) else "https://" + url
            out.append(f'<a href="{esc(href)}" target="_blank" rel="noopener">{esc(url)}</a>{esc(trailing)}')
        end = match.end()
    out.append(esc(text[end:]))
    return "".join(out)


def episode_description_html(text):
    """最初の■までを常時表示し、残りをdetailsで全文表示する。"""
    full = (text or "").strip()
    if not full:
        return ""
    marker = full.find("■")
    if marker < 0:
        return f'<div class="card ep-desc">{linkify_text(full)}</div>'
    lead = full[:marker].strip()
    if not lead:
        return f'<div class="card ep-desc">{linkify_text(full)}</div>'
    rest = full[marker:].lstrip()
    return f'''<div class="card ep-desc">{linkify_text(lead)}</div>
<details class="ep-desc-more">
<summary>概要欄をすべて表示</summary>
<div class="card ep-desc ep-desc-full">{linkify_text(rest)}</div>
</details>'''


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


ASSETS = ["navigation", "site", "search", "games", "shindan", "player", "lab-loader"]


def navigation_version():
    return av("assets/css/style.css") + "".join(av(f"assets/js/{name}.js") for name in ASSETS)


def lab_version():
    """Version the entry point and its dependencies together, without invalidating other pages."""
    digest = hashlib.md5()
    for source in sorted((ROOT / "assets/js/lab").glob("*.js")):
        digest.update(source.name.encode("utf-8"))
        digest.update(_version_bytes(source))
    return digest.hexdigest()[:8]


def head(title, desc, root, path="", og_image=None, jsonld=None, og_type="website", published=None, indexable=True):
    # ブラウザのタブ/OGPタイトル。トップは「番組名 | 接尾辞」、下層は「ページ名 | 番組名」。
    # 番組名(SITE["title"])はフッターのコピーライトやロゴのalt等にそのまま使うので短いままにする。
    suffix = SITE.get("title_suffix", "")
    if title:
        full = f'{esc(title)} | {esc(SITE["title"])}'
    else:
        full = f'{esc(SITE["title"])} | {esc(suffix)}' if suffix else esc(SITE["title"])
    url = SITE["base_url"].rstrip("/") + "/" + path
    og_img = SITE["base_url"].rstrip("/") + "/" + (og_image or "assets/img/ogp.jpg")
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
{f'<link rel="canonical" href="{esc(url)}">' if indexable else '<meta name="robots" content="noindex">'}
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
<body>
<div id="sitePage" data-version="{navigation_version()}">"""


def header(root, current=""):
    items = [
        ("index.html", "ホーム", "home"),
        ("episodes/", "エピソード", "episodes"),
        ("series/", "名物企画", "series"),
        ("awq/", "AWQ", "awq"),
        ("shindan.html", "ゲーム診断", "shindan"),
        ("lab.html", "研究所", "lab"),
        ("games/", "滝壺DB", "games"),
        ("news/", "お知らせ", "news"),
        ("guide.html", "聴き方", "guide"),
        ("otayori.html", "おたより", "otayori"),
    ]
    # ハンバーガーメニュー内でのみ差し替えるラベル(PCヘッダーは短い表記のまま)
    mobile_label = {
        "awq": "AWQランキング",
        "shindan": "ふさわしいゲーム診断",
        "lab": "エピソード研究所",
        "games": "滝壺データベース",
    }
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


def episode_search(root):
    """Compact search entry shared by the homepage and the recovery page."""
    return f'''<form class="episode-search" action="{root}episodes/" method="get" role="search" aria-label="エピソードを検索">
<label for="episodeSearchInput">エピソードを検索</label>
<div class="episode-search-row"><input id="episodeSearchInput" name="q" type="search" placeholder="例：シレン、#100" required enterkeyhint="search"><button type="submit">検索</button></div>
<a class="episode-search-db" href="{root}games/">ゲームの索引はこちら →</a>
</form>'''


def footer(root):
    blog = SITE["members"][0].get("blog", {})
    blog_url = blog.get("url", "#")
    if blog_url.startswith("TODO"): blog_url = "#"
    nav = (
        f'<a href="{root}index.html">ホーム</a><a href="{root}episodes/">エピソード</a>'
        f'<a href="{root}series/">名物企画</a><a href="{root}awq/">AWQランキング</a>'
        f'<a href="{root}shindan.html">ふさわしいゲーム診断</a>'
        f'<a href="{root}lab.html">エピソード研究所</a>'
        f'<a href="{root}games/">滝壺データベース</a>'
        f'<a href="{root}news/">お知らせ</a>'
        f'<a href="{root}guide.html">ポッドキャストの聴き方</a><a href="{root}otayori.html">おたより</a>'
        f'<a href="{SITE["x_url"]}" target="_blank" rel="noopener">公式X</a>'
        f'<a href="{esc(SITE["instagram_url"])}" target="_blank" rel="noopener">公式Instagram</a>'
        f'<a href="{esc(blog_url)}" target="_blank" rel="noopener">ブログ「{esc(blog.get("label", "ブログ"))}」</a>'
    )
    scripts = "\n".join(f'<script src="{root}assets/js/{name}.js?v={av(f"assets/js/{name}.js")}"></script>' for name in ASSETS)
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
</div>
{scripts}
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


def fmt_points(value):
    """AWQポイントを桁区切りし、小数点以下の不要な0は表示しない。"""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number.is_integer():
        return f"{int(number):,}"
    return f"{number:,.10f}".rstrip("0").rstrip(".")


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
    tags = "".join(
        f'<a class="tag" href="{root}episodes/?tag={urllib.parse.quote(t, safe="")}">{esc(t)}</a>'
        for t in e["tags"][:2])
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
    return f"""<div class="{cls}">
{art}
<div class="ep-card-body">{label}<a class="ep-title ep-card-link" href="{root}episodes/{e['number']}.html">{esc(e['title'])}</a>
<span class="ep-meta">{meta_prefix}<span class="ep-hash">#{e['number']}</span>{jd(e['date'])}{tags}</span>{desc}</div>
</div>"""
