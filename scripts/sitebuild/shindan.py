"""Diagnosis page and generated game pool."""
import json
from .catalog import shindan_pool
from .common import av, footer, head, header
from .context import EPS, EP_COUNT, ROOT, SITE, esc
from .output import write_output


def build_shindan_json():
    games, used_eps = shindan_pool()
    latest_episode = max((e["number"] for e in EPS), default=0)
    data = {"latest_episode": latest_episode, "games": games, "eps": used_eps}
    write_output(ROOT / "data/shindan.json", json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(games)


def build_shindan():
    root = ""
    games, _ = shindan_pool()
    n_games = len(games)
    base = SITE["base_url"].rstrip("/")
    page = head("ふさわしいゲーム診断", f"なまえを入力するだけで、あなたに\"ふさわしいゲーム\"を診断。ゲームの滝壺が全{EP_COUNT}回で語ってきた{n_games}タイトルの中から、運命の一本を選びます。",
                root, "shindan.html")
    page += header(root, "shindan")
    page += f"""
<main class="container">
<div class="page-head" style="text-align:center;">
<h1 class="page-title"><span class="en">FUSAWASHII GAME SHINDAN</span>ふさわしいゲーム診断</h1>
<p style="font-size:13px;color:var(--sub);margin-top:8px;">なまえを入力するだけ。<br>滝壺の3人がこれまでに語ってきた <strong style="color:var(--primary-deep);">全{n_games}タイトル</strong> から<br>あなたに"ふさわしい一本"を診断します。</p>
</div>
<div class="shindan-stage" id="shindanPanel" data-module="assets/js/shindan/main.js?v={av('assets/js/shindan/main.js')}" data-share-module="assets/js/share-tools.js?v={av('assets/js/share-tools.js')}" data-version="{av('data/shindan.json')}" data-site="{esc(base)}" data-hashtag="{esc(SITE['hashtag'])}">
<p style="text-align:center;color:var(--faint);padding:40px 0;">読み込み中…</p>
</div>
<p class="search-note" style="text-align:center;margin-top:14px;">診断プールは番組の全エピソードから自動生成。<br>新しい回が配信されるたびに、結果の種類も増えていきます。<br>※ごく稀にゲームでないものが出てしまう場合があります。</p>
</main>"""
    page += footer(root)
    write_output(ROOT / "shindan.html", page, encoding="utf-8")
