"""Artwork quiz ranking, season and question pages."""
from .common import SVG, ep_image, fmt_points, footer, head, header
from .context import EPS_BY_NUM, RANKING, ROOT, SITE, esc
from .output import write_output


def awq_ranking_with_latest_changes(season):
    """最新シーズンの順位に、直近採点回の順位変動と獲得ptを付ける。"""
    ranking = [dict(person) for person in season.get("ranking", [])]
    latest_round = season.get("through_round")
    if not season.get("active") or latest_round is None:
        return ranking

    previous_totals = {}
    previous_counts = {}
    latest_points = {}
    latest_listeners = set()
    for entry in season.get("entries", []):
        name = entry.get("listener", "")
        if not name:
            continue
        points = float(entry.get("points", 0))
        if entry.get("round") == latest_round:
            latest_points[name] = latest_points.get(name, 0) + points
            latest_listeners.add(name)
        else:
            previous_totals[name] = previous_totals.get(name, 0) + points
            previous_counts[name] = previous_counts.get(name, 0) + 1

    previous = [
        {
            "listener": name,
            "points": points,
            "awards": previous_counts[name],
        }
        for name, points in previous_totals.items()
    ]
    previous.sort(key=lambda person: (-person["points"], -person["awards"], person["listener"]))

    previous_ranks = {}
    previous_points = None
    previous_rank = 0
    for position, person in enumerate(previous, 1):
        if person["points"] != previous_points:
            previous_rank = position
            previous_points = person["points"]
        previous_ranks[person["listener"]] = previous_rank

    for person in ranking:
        name = person.get("listener", "")
        if name in latest_listeners:
            person["latest_points"] = latest_points[name]
        if name not in previous_ranks:
            if name in latest_listeners:
                person["rank_change"] = "new"
            continue
        change = previous_ranks[name] - person.get("rank", previous_ranks[name])
        if change:
            person["rank_change"] = change
    return ranking


def awq_rank_change(person):
    """順位変動を、色だけに依存しない表示と読み上げ文で返す。"""
    change = person.get("rank_change")
    if change == "new":
        return (
            '<span class="awq-rank-change is-new" aria-label="最新回で初登場">'
            '<span aria-hidden="true">NEW</span></span>'
        )
    if not isinstance(change, int) or change == 0:
        return ""
    direction = "up" if change > 0 else "down"
    arrow = "↑" if change > 0 else "↓"
    amount = abs(change)
    label = f"前回から{amount}ランク{'上昇' if change > 0 else '下降'}"
    return (
        f'<span class="awq-rank-change is-{direction}" aria-label="{label}">'
        f'<span aria-hidden="true">{arrow}{amount}</span></span>'
    )


def awq_latest_points(person):
    """最新採点回で得たポイント。採点対象者だけに表示する。"""
    if "latest_points" not in person:
        return ""
    points = person["latest_points"]
    sign = "+" if float(points) >= 0 else ""
    return (
        '<span class="awq-latest-points">最新回 '
        f'<b>{sign}{fmt_points(points)}pt</b></span>'
    )


def awq_listener(person):
    """ランキングで使うリスナー名。X URLがある場合だけリンクにする。"""
    name = esc(person.get("listener", ""))
    x_url = person.get("x_url")
    if not x_url:
        return f'<span class="awq-listener">{name}</span>'
    return (
        f'<a class="awq-listener" href="{esc(x_url)}" target="_blank" rel="noopener">'
        f'<span>{name}</span>{SVG["x"]}<span class="visually-hidden">のXアカウント</span></a>'
    )


def awq_podium(ranking):
    cards = []
    medals = {1: "🏆", 2: "🥈", 3: "🥉"}
    for position, person in enumerate(ranking[:3], 1):
        rank = person.get("rank", position)
        medal = medals.get(rank, f"{rank}位")
        cards.append(f"""<div class="awq-podium-card awq-podium-pos-{position} awq-rank-{min(rank, 4)}">
<span class="awq-medal" aria-label="{rank}位">{medal}</span>
<span class="awq-podium-rank"><span>{rank}<small>位</small></span>{awq_rank_change(person)}</span>
{awq_listener(person)}
<strong class="awq-points">{fmt_points(person.get('points', 0))}<small>pt</small></strong>
<span class="awq-awards"><span>ポイント獲得 {person.get('awards', 0)}回</span>{awq_latest_points(person)}</span>
</div>""")
    return f'<div class="awq-podium">{"".join(cards)}</div>' if cards else ""


def awq_ranking_rows(ranking):
    remaining = ranking[3:]
    shown = []
    older = []
    for index, person in enumerate(remaining, 4):
        rank = person.get("rank", index)
        (shown if rank <= 10 else older).append(person)

    def render_rows(people):
        return "".join(f"""<div class="awq-ranking-row">
<span class="awq-row-rank"><span>{person.get('rank', '')}<small>位</small></span>{awq_rank_change(person)}</span>
<span class="awq-row-name">{awq_listener(person)}<span class="awq-row-meta"><span>獲得 {person.get('awards', 0)}回</span>{awq_latest_points(person)}</span></span>
<strong class="awq-row-points">{fmt_points(person.get('points', 0))}<small>pt</small></strong>
</div>""" for person in people)

    if not shown and not older:
        return ""

    html = (
        f'<div class="awq-ranking-list" aria-label="4位から10位までのランキング">'
        f'{render_rows(shown)}</div>'
        if shown else ""
    )
    if older:
        html += f"""<details class="awq-ranking-more">
<summary>11位以下を表示（{len(older)}名）</summary>
<div class="awq-ranking-list" aria-label="11位以下のランキング">{render_rows(older)}</div>
</details>"""
    return html


def awq_quiz_card(quiz, root="../"):
    number = quiz["round"]
    episode = EPS_BY_NUM.get(number)
    problem = quiz.get("image")
    if problem:
        problem_html = (
            f'<img src="{root}{esc(problem)}" '
            f'alt="第{number}回アートワーククイズの問題画像" loading="lazy">'
        )
    else:
        problem_html = f'<span class="awq-quiz-placeholder">#{number}</span>'

    answer_html = '<p class="awq-answer-missing">答えのエピソード情報は準備中です。</p>'
    if episode:
        answer_image = ep_image(episode)
        answer_art = (
            f'<img src="{root}{esc(answer_image)}" alt="" loading="lazy">'
            if answer_image else f'<span class="awq-answer-num">#{number}</span>'
        )
        answer_html = f"""<a class="awq-answer-link" href="{root}episodes/{number}.html">
{answer_art}
<span><small>ANSWER — EPISODE #{number}</small><strong>{esc(episode['title'])}</strong><em>エピソードを見る →</em></span>
</a>"""

    note = f'<p class="awq-quiz-note">{esc(quiz["note"])}</p>' if quiz.get("note") else ""
    return f"""<article class="awq-quiz-card" id="quiz-{number}">
<a class="awq-problem" href="{esc(quiz['x_url'])}" target="_blank" rel="noopener">
{problem_html}<span class="awq-quiz-no">QUIZ #{number}</span>
</a>
<div class="awq-quiz-body">
<a class="awq-post-link" href="{esc(quiz['x_url'])}" target="_blank" rel="noopener">{SVG['x']}出題ポストを見る</a>
{note}
<details class="awq-answer"><summary>答えを見る</summary>{answer_html}</details>
</div>
</article>"""


def awq_quiz_grid(quizzes, root="../"):
    return f'<div class="awq-quiz-grid">{"".join(awq_quiz_card(q, root) for q in quizzes)}</div>'


def awq_season_section(season, quizzes, root="../"):
    number = season["season"]
    ranking = awq_ranking_with_latest_changes(season)
    active = bool(season.get("active"))
    through_round = season.get("through_round")
    state = (
        f"第{through_round}回まで反映"
        if active and through_round is not None
        else "更新準備中"
        if active
        else "最終結果"
    )
    state_class = "live" if active else "final"
    quiz_rounds = [quiz["round"] for quiz in quizzes]
    start_round = season.get("start_round")
    if start_round is None and quiz_rounds:
        start_round = min(quiz_rounds)
    end_round = max(quiz_rounds) if quiz_rounds else season.get("through_round")
    if start_round is None:
        period = ""
    elif active:
        period = f"第{start_round}回～"
    elif end_round is not None:
        period = f"第{start_round}回～第{end_round}回"
    else:
        period = f"第{start_round}回～"
    season_meta = " ／ ".join(item for item in (period, f"参加者{len(ranking)}名") if item)

    champion = ""
    if not active and ranking:
        winner = ranking[0]
        champion = f"""<div class="awq-champion">
<span class="awq-crown" aria-hidden="true">♛</span>
<span><small>SEASON {number} CHAMPION</small><strong>{awq_listener(winner)}</strong></span>
<b>{fmt_points(winner.get('points', 0))}<small>pt</small></b>
</div>"""

    if active:
        newest = list(reversed(quizzes))
        shown, older = newest[:6], newest[6:]
        gallery = awq_quiz_grid(shown, root) if shown else '<p class="awq-empty">出題画像を同期中です。</p>'
        if older:
            gallery += f"""<details class="awq-gallery-more">
<summary>シーズン{number}の過去の出題をすべて見る（{len(older)}問）</summary>
{awq_quiz_grid(older, root)}
</details>"""
    else:
        gallery = f"""<details class="awq-gallery-more">
<summary>シーズン{number}の出題画像を見る（{len(quizzes)}問）</summary>
{awq_quiz_grid(list(reversed(quizzes)), root)}
</details>""" if quizzes else ""

    return f"""<section class="section awq-season {'is-current' if active else 'is-past'}" id="season-{number}">
<div class="awq-season-head">
<h2><span>SEASON {number}</span>{esc(season.get('label', f'シーズン{number}'))}</h2>
<span class="awq-state {state_class}">{state}</span>
</div>
<p class="awq-season-meta">{season_meta}</p>
{champion}
{awq_podium(ranking)}
{awq_ranking_rows(ranking)}
<div class="awq-gallery-head"><h3>出題アートワーク</h3><p>「答えを見る」を開くと、本来のエピソードへつながります。</p></div>
{gallery}
</section>"""


def build_awq():
    root = "../"
    seasons = RANKING.get("seasons", [])
    quizzes = sorted(RANKING.get("quizzes", []), key=lambda q: q.get("round", -1))
    latest_quiz = quizzes[-1] if quizzes else None
    latest_round = latest_quiz.get("round") if latest_quiz else None

    seasons_ascending = sorted(seasons, key=lambda season: season["season"])
    quiz_by_season = {}
    season_starts = []
    for index, season in enumerate(seasons_ascending):
        season_start = season.get("start_round")
        if season_start is None and index == 0 and quizzes:
            # 古いranking.jsonとの互換。シーズン1は保存済みの最古のクイズから扱う。
            season_start = quizzes[0]["round"]
        elif season_start is None and index > 0:
            previous_through = seasons_ascending[index - 1].get("through_round")
            if previous_through is not None:
                season_start = previous_through + 1
        season_starts.append(season_start)

    for index, season in enumerate(seasons_ascending):
        season_number = season["season"]
        season_start = season_starts[index]
        next_start = season_starts[index + 1] if index + 1 < len(season_starts) else None
        season_end = next_start - 1 if next_start is not None else latest_round
        if season_end is None and index + 1 < len(seasons_ascending):
            season_end = season.get("through_round")
        if season_start is None or season_end is None:
            quiz_by_season[season_number] = []
            continue
        quiz_by_season[season_number] = [
            quiz for quiz in quizzes if season_start <= quiz["round"] <= season_end
        ]

    anchor_links = "".join(
        f'<a href="#season-{s["season"]}">{esc(s.get("label", ""))}</a>' for s in seasons
    )

    season_html = "".join(
        awq_season_section(season, quiz_by_season.get(season["season"], []), root)
        for season in seasons
    )
    if not season_html:
        season_html = '<div class="info-box">ランキングデータを同期中です。</div>'

    base = SITE["base_url"].rstrip("/")
    crumbs_ld = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "ホーム", "item": base + "/"},
            {"@type": "ListItem", "position": 2, "name": "AWQランキング"},
        ],
    }
    og_image = latest_quiz.get("image") if latest_quiz else None
    page = head(
        "アートワーククイズランキング",
        "滝壺アートワーククイズ（AWQ）の公式ランキング。最新順位、歴代優勝者、出題画像と答えをまとめて掲載しています。",
        root,
        "awq/",
        og_image=og_image,
        jsonld=crumbs_ld,
    )
    page += header(root, "awq")
    page += f"""<main class="container awq-page">
<div class="page-head awq-page-head">
<h1 class="page-title"><span class="en">TAKITSUBO ARTWORK QUIZ RANKING</span>アートワーククイズランキング</h1>
<p>X・Instagramで次回エピソードのアートワークを一部隠して出題！ 番組で贈られたポイントを集計する公式順位表です。</p>
<a class="awq-hashtag" href="https://x.com/hashtag/%E6%BB%9D%E5%A3%BA%E3%82%A2%E3%83%BC%E3%83%88%E3%83%AF%E3%83%BC%E3%82%AF%E3%82%AF%E3%82%A4%E3%82%BA" target="_blank" rel="noopener">{SVG['x']}#滝壺アートワーククイズ</a>
</div>
<nav class="awq-season-nav" aria-label="シーズンへ移動">{anchor_links}</nav>
<p class="awq-name-note">※ランキング内のリスナー名は敬称略です。</p>
{season_html}
<p class="awq-data-note">順位は番組で発表されたポイントを集計しています。最新回の採点前など、出題済みの回と集計済みの回が異なる場合があります。</p>
</main>"""
    page += footer(root)
    out_dir = ROOT / "awq"
    out_dir.mkdir(exist_ok=True)
    write_output(out_dir / "index.html", page, encoding="utf-8")
