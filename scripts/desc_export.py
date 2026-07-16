# -*- coding: utf-8 -*-
"""概要欄の整形補助ツール。

過去エピソードの概要欄をSpotify上で新フォーマット(★=メイン)に貼り替えるための
「貼るだけテキスト」を、ローカルの確定データ(episodes.json)から機械生成する。
手で推敲せず、生成物をそのまま貼る運用にすることで貼り替えミスを防ぐ。

使い方:
  python scripts/desc_export.py            全エピソードを desc_export/ に書き出し
  python scripts/desc_export.py --ep 112   指定回だけ書き出し
  python scripts/desc_export.py --check    RSSと突合し、貼り替え結果を検証
                                           (一致した回は locked を外してRSS追従に戻せる)

本文(リード文)はRSSの最新値を優先して使う(episodes.json側は300字で切れているため)。
RSSが取れないオフライン時はローカル値で代用し、切れている可能性を警告する。
"""
import argparse
import json
import pathlib
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from update_from_rss import strip_html, parse_section, parse_chapters  # noqa: E402

SITE = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
EPS = json.loads((ROOT / "data/episodes.json").read_text(encoding="utf-8"))["episodes"]
OUT_DIR = ROOT / "desc_export"

GAMES_HEADER = "■主な登場ゲームタイトル（★=メインで語ったタイトル）"


def _n(s):
    import unicodedata
    return re.sub(r"[\s　]", "", unicodedata.normalize("NFKC", str(s)).lower())


def episode_mains(e):
    """その回のメインタイトル: featured_games指定があればそれ、なければ自動推定"""
    if "featured_games" in e:
        return list(e["featured_games"])
    et = _n(e["title"])
    return [g for g in e["games"] if len(_n(g)) >= 4 and _n(g) in et]


def fetch_rss_leads():
    """RSSから 回番号→(本文リード全文, 概要欄全文) を取得。失敗時はNone"""
    try:
        req = urllib.request.Request(SITE["rss"], headers={"User-Agent": "takitsubo-desc-export"})
        with urllib.request.urlopen(req, timeout=30) as r:
            tree = ET.fromstring(r.read())
    except Exception as ex:
        print(f"※RSS取得に失敗({ex})。本文はローカル値で代用します(300字で切れている可能性あり)")
        return None
    out = {}
    for item in tree.iter("item"):
        title = (item.findtext("title") or "").strip()
        m = re.match(r"第(\d+)回", title)
        if not m:
            continue
        desc = strip_html(item.findtext("description") or "")
        out[int(m.group(1))] = (desc.split("■")[0].strip(), desc)
    return out


def render_description(e, lead):
    """新フォーマットの概要欄テキストを組み立てる"""
    mains = episode_mains(e)
    main_set = set(mains)
    lines = [lead.rstrip(), "", GAMES_HEADER]
    for g in mains:
        lines.append(f"★{g}")
    for g in e["games"]:
        if g not in main_set:
            lines.append(g)
    if e.get("chapters"):
        lines += ["", "■チャプター"]
        for c in e["chapters"]:
            lines.append(f"({c['time']}) {c['label']}")
    return "\n".join(lines) + "\n"


def cmd_export(only_ep=None):
    OUT_DIR.mkdir(exist_ok=True)
    leads = fetch_rss_leads()
    n = 0
    for e in EPS:
        if only_ep is not None and e["number"] != only_ep:
            continue
        if leads is not None and e["number"] in leads:
            lead = leads[e["number"]][0]
        else:
            lead = e.get("description", "")
            if len(lead) >= 300:
                print(f"  ⚠ #{e['number']}: 本文がローカル値(300字)で切れている可能性。RSS取得できる環境で再実行を推奨")
        text = render_description(e, lead)
        (OUT_DIR / f"{e['number']:03d}.txt").write_text(text, encoding="utf-8")
        n += 1
    print(f"書き出し完了: {n}件 → {OUT_DIR}/")
    print("Spotify for Creators の各エピソード編集画面に、対応する .txt の中身をまるごと貼り付けてください。")


def parse_rss_games(desc):
    """RSS概要欄から (★フォーマットか, games, mains, chapters) を読む(update_from_rssと同じ規則)"""
    star_format = bool(re.search(r"■[^\n]*(登場ゲームタイトル)[^\n]*★", desc))
    games, mains = [], []
    for g in parse_section(desc, ["登場ゲームタイトル"]):
        s = g.strip()
        if re.search(r"https?://|www\.|%[0-9A-Fa-f]{2}", s) or re.fullmatch(r"【[^】]*】", s):
            continue
        is_main = s.startswith("★")
        for piece in re.split(r"[、,]", s):
            piece = piece.strip("　 ").lstrip("★・-").strip("　 ")
            if not piece:
                continue
            games.append(piece)
            if is_main:
                mains.append(piece)
    chapters = parse_chapters(parse_section(desc, ["チャプター"]))
    return star_format, games, mains, chapters


def cmd_check():
    leads = fetch_rss_leads()
    if leads is None:
        print("RSSが取得できないため突合できません。")
        return
    formatted_ok, formatted_diff, unformatted = [], [], []
    for e in EPS:
        num = e["number"]
        if num not in leads:
            continue
        star, games, mains, chapters = parse_rss_games(leads[num][1])
        if not star:
            unformatted.append(num)
            continue
        diffs = []
        # ゲームリストは表記ゆれ名寄せ前後の差があるため、正規化して比較する
        if [_n(g) for g in games] != [_n(g) for g in e["games"]]:
            diffs.append("games")
        local_mains = e.get("featured_games", episode_mains(e))
        if sorted(_n(g) for g in mains) != sorted(_n(g) for g in local_mains):
            diffs.append("featured(★)")
        if chapters != e.get("chapters", []):
            diffs.append("chapters")
        if diffs:
            formatted_diff.append((num, diffs))
        else:
            formatted_ok.append(num)
    print(f"★フォーマット済みで一致: {len(formatted_ok)}件")
    lockable = [n for n in formatted_ok if next(e for e in EPS if e["number"] == n).get("locked")]
    if lockable:
        print(f"  うちロック解除できる回: {lockable}")
    if formatted_diff:
        print(f"★フォーマット済みだが差分あり: {len(formatted_diff)}件")
        for num, diffs in formatted_diff:
            print(f"  #{num}: {', '.join(diffs)} が不一致")
    print(f"未整形(★見出しなし): {len(unformatted)}件")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="概要欄の整形補助ツール")
    ap.add_argument("--ep", type=int, help="この回だけ書き出す")
    ap.add_argument("--check", action="store_true", help="RSSと突合して貼り替え結果を検証")
    args = ap.parse_args()
    if args.check:
        cmd_check()
    else:
        cmd_export(args.ep)
