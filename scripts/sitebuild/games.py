"""Game database index and generated title detail pages."""
import json
from .catalog import GAME_SECTIONS, LEVEL_BADGE, LEVEL_MARK, _game_aliases_for, _n_light, _to_kata, game_item_href, games_db, games_series_map
from .common import SVG, ep_image, footer, head, header, jd, sec_title, time_to_sec
from .context import EPS_BY_NUM, EP_COUNT, ROOT, SITE, esc
from .output import write_output


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
<p style="font-size:13px;color:var(--sub);margin-top:8px;">これまでの全{EP_COUNT}回で話題に上がったゲームタイトルの索引です。<br>がっつり特集した一本から雑談にちらっと出ただけの一本まで、すべて載っています。</p>
</div>

<div class="gm-stats">
<span class="gm-stat"><strong>{total}</strong>タイトル</span>
<span class="gm-stat"><strong>{nobe}</strong>延べ登場</span>
<span class="gm-stat"><strong>{main_count}</strong>メインで語られた</span>
<span class="gm-stat"><strong>{sanbun_count}</strong>3分ゲーム紹介</span>
</div>

<div class="searchbox" style="margin-top:18px;">{SVG['search']}
<input type="search" id="gmQ" placeholder="例：シレン、どらくえ、FF" aria-label="タイトルを検索" autocomplete="off">
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
</main>"""
    page += footer(root)
    write_output(ROOT / "games/index.html", page, encoding="utf-8")

    # ---------- タイトル個別ページ ----------
    # 品質ゲートから外れたページだけ削除し、変更のないページは保持する。
    expected = {i["slug"] + ".html" for i in items if i["paged"]}
    for old in (ROOT / "games").glob("g*.html"):
        if old.name not in expected:
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
        write_output(ROOT / f"games/{i['slug']}.html", page, encoding="utf-8")

    return sum(1 for i in items if i["paged"])
