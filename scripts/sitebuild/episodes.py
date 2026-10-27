"""Episode list/detail HTML and lightweight search data."""
import json
import urllib.parse
from .catalog import LEVEL_MARK, _shindan_norm, episode_game_entries, game_slug_map, sanbun_titles
from .common import SVG, av, ep_card, ep_image, episode_description_html, fmt_dur_min, footer, head, header, jd, related_eps, sec_title, service_buttons, time_to_sec, x_post_url
from .context import EPS, ROOT, SERIES, SITE, esc
from .output import write_output


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
    if "開発者ゲスト" in tag_order and "ゲスト回" in tag_order:
        tag_order.remove("開発者ゲスト")
        tag_order.insert(tag_order.index("ゲスト回"), "開発者ゲスト")
    filter_btns = '<button class="filter-btn on" data-tag="all">すべて</button>' + "".join(
        f'<button class="filter-btn" data-tag="{esc(t)}">{esc(t)}</button>' for t in tag_order)

    page = head("エピソード一覧", "ゲームの滝壺の全エピソード。キーワード検索とタグで絞り込めます。", root, "episodes/")
    page += header(root, "episodes")
    page += f"""
<main class="container">
<div class="page-head"><h1 class="page-title"><span class="en">EPISODES</span>エピソード一覧</h1></div>

<div class="searchbox">{SVG['search']}
<input type="search" id="q" placeholder="例：ドラクエ、わるい村、#100" aria-label="エピソードを検索" autocomplete="off">
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

<div class="ep-grid" id="list" data-version="{av('data/search.json')}" aria-live="polite"></div>
<div id="empty" style="display:none;" class="empty-box">
<p class="empty-title">🔍 該当するエピソードが見つかりませんでした</p>
<ul class="empty-hint">
<li>別の表記で試してみてください（例: FF ↔ ファイナルファンタジー、ドラクエ ↔ ドラゴンクエスト）</li>
<li>ひらがな・カタカナは自動で変換されます（「どらくえ」でもOK）</li>
<li>上の「絞り込み」タグから企画・テーマで探すこともできます</li>
</ul>
</div>
</main>"""
    page += footer(root)
    write_output(ROOT / "episodes/index.html", page, encoding="utf-8")


def build_episode_pages():
    root = "../"
    slug_map = game_slug_map()  # ゲーム名→DBページのスラッグ(全回で共通)
    for i, e in enumerate(EPS):
        n = e["number"]
        prev_e = EPS[i - 1] if i > 0 else None
        next_e = EPS[i + 1] if i < len(EPS) - 1 else None

        tags = "".join(
            f'<a class="tag" href="{root}episodes/?tag={urllib.parse.quote(t, safe="")}">{esc(t)}</a>'
            for t in e["tags"])
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
                href = f"../games/{slug}.html" if slug else f"index.html?q={urllib.parse.quote(g, safe='')}"
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
            body = episode_description_html(e["description"])
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
            "image": base + "/" + (ep_image(e) or "assets/img/ogp.jpg"),
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
            href = f"../games/{slug}.html" if slug else f"index.html?q={urllib.parse.quote(name, safe='')}"
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
</main>"""
        page += footer(root)
        write_output(ROOT / f"episodes/{n}.html", page, encoding="utf-8")


def build_search_json():
    """一覧ページの検索が読む軽量JSON。表示に使う項目だけ残す
    (episodes.json の image_src 等の内部情報は公開物に含めない)"""
    slim = [
        {"number": e["number"], "title": e["title"], "date": e["date"],
         "tags": e["tags"], "games": [g for _, g in episode_game_entries(e)],
         "image": e.get("image")}
        for e in EPS
    ]
    write_output(ROOT / "data/search.json", json.dumps({"episodes": slim}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
