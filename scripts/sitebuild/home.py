"""Homepage HTML and editorial episode recommendations."""
from .catalog import shindan_pool
from .common import SVG, WAVE, ep_card, fmt_points, footer, head, header, jd, sec_title, series_card, service_buttons, x_post_url
from .context import EPS, EPS_BY_NUM, EP_COUNT, NEWS, RANKING, ROOT, SERIES, SITE, esc
from .output import write_output


def recommended_episodes():
    """設定順に3件を選ぶ。入力ミスはページ生成前に検出する。"""
    numbers = SITE.get("recommended_episodes", [])
    if not isinstance(numbers, list) or len(numbers) != 3:
        raise ValueError("site.json: recommended_episodes はエピソード番号を3件指定してください")
    if any(type(n) is not int or n not in EPS_BY_NUM for n in numbers):
        raise ValueError("site.json: recommended_episodes には存在するエピソードの整数番号を指定してください")
    if len(set(numbers)) != len(numbers):
        raise ValueError("site.json: recommended_episodes に同じ番号を重複して指定できません")
    return [EPS_BY_NUM[n] for n in numbers]


def build_index():
    root = ""
    latest = EPS[-1]
    recent = list(reversed(EPS[-7:-1]))  # 最新を除く直近6件(3列×2段)
    recommended = recommended_episodes()
    ep_count = EP_COUNT
    shindan_count = len(shindan_pool()[0])
    awq_current = next((s for s in RANKING.get("seasons", []) if s.get("active")), None)
    awq_leader = (awq_current.get("ranking") or [None])[0] if awq_current else None
    awq_quiz = next((q for q in reversed(RANKING.get("quizzes", [])) if q.get("image")), None)
    awq_thumb = awq_quiz["image"] if awq_quiz else "assets/img/rock_hyuuma.png"
    awq_lead = (
        f'現在のトップは{esc(awq_leader["listener"])}、{fmt_points(awq_leader["points"])}pt。'
        if awq_leader else ""
    )
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
        "image": base + "/assets/img/ogp.jpg",
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

<section class="section recommended-section">
{sec_title("おすすめエピソード", "RECOMMENDED", '<a class="section-more" href="episodes/">すべて見る →</a>')}
<div class="ep-grid recommended-grid">{''.join(ep_card(e, root) for e in recommended)}</div>
</section>

<section class="section route-section">
<div class="route-bubbles" aria-label="ゲームの滝壺をもっと楽しむ">
<a class="route-bubble route-bubble-db" href="games/">
<span class="route-bubble-inner">
<img class="route-bubble-image route-bubble-image-scissors" src="assets/img/scissors.png" alt="" aria-hidden="true">
<span class="route-bubble-en">TAKITSUBO DATABASE</span>
<span class="route-bubble-title"><span class="route-bubble-title-line">語られたゲームを探せる</span><span class="route-bubble-title-line">滝壺データベース</span></span>
<span class="route-bubble-desc">全{shindan_count}タイトルを収録。メイン特集から、ちょい出しまで探せる索引です。</span>
<span class="route-bubble-cta">索引を見る →</span>
</span>
</a>
<a class="route-bubble route-bubble-shindan" href="shindan.html">
<span class="route-bubble-inner">
<img class="route-bubble-image" src="assets/img/rock_ichigo.png" alt="" aria-hidden="true">
<span class="route-bubble-en">FUSAWASHII GAME SHINDAN</span>
<span class="route-bubble-title"><span class="route-bubble-title-line">あなたにふさわしい</span><span class="route-bubble-title-line">ゲームを診断！</span></span>
<span class="route-bubble-desc">名前を入力するだけ。全{ep_count}回・{shindan_count}タイトルから、運命の一本を選びます。</span>
<span class="route-bubble-cta">診断する →</span>
</span>
</a>
<a class="route-bubble route-bubble-awq" href="awq/">
<span class="route-bubble-inner">
<img class="route-bubble-image route-bubble-image-photo" src="{awq_thumb}" alt="" aria-hidden="true">
<span class="route-bubble-en">ARTWORK QUIZ RANKING</span>
<span class="route-bubble-title"><span class="route-bubble-title-line">この絵、いったい何の</span><span class="route-bubble-title-line">エピソード？</span></span>
<span class="route-bubble-desc">公式ランキングと、歴代の出題画像・答えをまとめて見られます。</span>
<span class="route-bubble-cta">順位を見る →</span>
</span>
</a>
<a class="route-bubble route-bubble-lab" href="lab.html"><span class="route-bubble-inner">
<img class="route-bubble-image route-bubble-image-hyuuma" src="assets/img/hyuuma.webp" alt="" aria-hidden="true">
<span class="route-bubble-en">EPISODE LAB</span>
<span class="route-bubble-title"><span class="route-bubble-title-line">次に聴くのはどの回？</span><span class="route-bubble-title-line">エピソード研究所</span></span>
<span class="route-bubble-desc">ランダムな3本から、気になる一回を。手持ちや図鑑も自由に楽しもう。</span>
<span class="route-bubble-cta">研究所へ →</span></span></a>
<i class="route-mini-bubble" aria-hidden="true"></i>
<i class="route-mini-bubble" aria-hidden="true"></i>
<i class="route-mini-bubble" aria-hidden="true"></i>
<i class="route-mini-bubble" aria-hidden="true"></i>
<i class="route-mini-bubble" aria-hidden="true"></i>
<i class="route-mini-bubble" aria-hidden="true"></i>
<i class="route-mini-bubble" aria-hidden="true"></i>
</div>
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
    write_output(ROOT / "index.html", page, encoding="utf-8")
