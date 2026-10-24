"""Lab, news, guide, contact and privacy pages."""
from .common import SVG, av, footer, head, header, jd, lab_version, sec_title, service_buttons, x_post_url
from .context import NEWS, ROOT, SITE, esc
from .output import write_output


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
    write_output(ROOT / "news/index.html", page, encoding="utf-8")

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
        write_output(ROOT / f"news/{n['slug']}.html", page, encoding="utf-8")


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
    write_output(ROOT / "guide.html", page, encoding="utf-8")


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
    write_output(ROOT / "otayori.html", page, encoding="utf-8")


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
    write_output(ROOT / "privacy.html", page, encoding="utf-8")


def build_lab():
    page = head("エピソード研究所", "ランダムな3択から、次に聴きたいエピソードを見つけよう。気になる回を図鑑に登録したり、手持ちの6本を選んでシェアしたり、遊び方は自由。", "", "lab.html")
    page += header("", "lab")
    page += f'''<main class="container">
<div class="page-head" style="text-align:center;">
<h1 class="page-title"><span class="en">EPISODE LAB</span>エピソード研究所</h1>
<p style="font-size:13px;color:var(--sub);margin-top:8px;">次に聴く一回に迷ったら、ランダムに並ぶ3本から気になるエピソードを探してみよう。<br>手持ちを選んだり、図鑑を埋めたり。遊び方はご自由に！</p>
</div>
<section id="episodeLab" data-share-page="{esc(SITE['base_url'].rstrip('/') + '/lab.html')}" data-share-module="assets/js/share-tools.js?v={av('assets/js/share-tools.js')}" data-module="assets/js/lab/game.js?v={lab_version()}" data-css="assets/css/lab.css?v={av('assets/css/lab.css')}" data-source="data/search.json?v={av('data/search.json')}">
<p style="text-align:center;padding:60px">研究所を準備しています…</p>
<noscript><p>3択にはJavaScriptが必要です。<a href="episodes/">エピソード一覧はこちら</a></p></noscript>
</section>
</main>'''
    page += footer("")
    write_output(ROOT / "lab.html", page, encoding="utf-8")
