# -*- coding: utf-8 -*-
"""RSSフィードから新着エピソードを取り込み、episodes.json を更新するスクリプト。
GitHub Actions から定期実行される想定(手動実行も可)。

処理内容:
  1. RSSを取得し、各エピソードのタイトル・配信日・概要欄を読む
  2. タイトルの「第N回」からエピソード番号を特定
  3. 概要欄の「■主な登場ゲームタイトル」「■チャプター」を自動抽出
  4. aliases.json の表記ゆれ辞書でゲーム名を正式名に名寄せ
  5. タイトルにシリーズのキーワードが含まれていたらタグ候補を自動付与
  6. episodes.json を更新し、build.py を呼んでページを再生成

使い方:  python3 scripts/update_from_rss.py
"""
import json, re, pathlib, subprocess, sys, html
import urllib.request
import xml.etree.ElementTree as ET
from datetime import timedelta, timezone
from email.utils import parsedate_to_datetime

JST = timezone(timedelta(hours=9))

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
DATA_PATH = ROOT / "data/episodes.json"
ALIAS_PATH = ROOT / "data/aliases.json"

# 画像取得+縮小保存は fetch_images.py の共通処理を使う
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from fetch_images import download_image, IMG_DIR

# タイトルにこの語が含まれていたらシリーズタグ候補を付ける
SERIES_KEYWORDS = {
    "waruimura": ("わるい村", ["わるい村"]),
    "fusawashii": ("ふさわしいゲーム", ["ふさわしいゲーム"]),
    "sfc-ranking": ("SFC売上ランキング", ["SFCの売上ランキング", "SFC売上ランキング"]),
    "ps-ranking": ("初代プレステ売上ランキング", ["プレステの売上ランキング", "初代プレステの売上ランキング"]),
    "ii-shouhin": ("とてもいい商品", ["とてもいい商品"]),
    "furikaeri": ("一年の振り返り", ["決算説明会"]),
}


def load_aliases():
    data = json.loads(ALIAS_PATH.read_text(encoding="utf-8"))
    table = {}
    for t in data["titles"]:
        for a in t["aliases"]:
            table[a] = t["canonical"]
        table[t["canonical"]] = t["canonical"]
    return table


def strip_html(s):
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s)


def parse_section(text, header_names):
    """概要欄から「■見出し」の次行~次の■までを行リストで返す"""
    lines = text.split("\n")
    out, capture = [], False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("■"):
            capture = any(h in stripped for h in header_names)
            continue
        if capture and stripped:
            out.append(stripped)
    return out


def parse_chapters(lines):
    """『(00:00) オープニング』『00:00 オープニング』などの形式に対応"""
    chapters = []
    for line in lines:
        m = re.match(r"[\(\(]?(\d{1,2}:\d{2}(?::\d{2})?)[\)\)]?\s*(.+)", line)
        if m:
            chapters.append({"time": m.group(1), "label": m.group(2).strip()})
    return chapters


def main():
    aliases = load_aliases()
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    by_num = {e["number"]: e for e in data["episodes"]}

    req = urllib.request.Request(SITE["rss"], headers={"User-Agent": "takitsubo-site-updater"})
    with urllib.request.urlopen(req, timeout=30) as r:
        xml_text = r.read()

    tree = ET.fromstring(xml_text)
    ns = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd"}

    updated, created, images, locked, unknown_games = 0, 0, 0, 0, set()

    for item in tree.iter("item"):
        title = (item.findtext("title") or "").strip()
        m = re.match(r"第(\d+)回\s*(.*)", title)
        if not m:
            continue
        num = int(m.group(1))
        clean_title = m.group(2).strip() or title

        desc = strip_html(item.findtext("description") or "")
        pub = item.findtext("pubDate")
        guid = item.findtext("guid")
        link = item.findtext("link")
        img_el = item.find("itunes:image", ns)
        img_url = img_el.get("href") if img_el is not None else None

        # 見出しは時期により「主な登場ゲームタイトル」「主な登場作品」「主な登場タイトル」等
        games_raw = parse_section(desc, ["主な登場", "登場ゲームタイトル"])
        games = []
        for g in games_raw:
            s = g.strip()
            # URL行・サブ見出し(【本編】等)はゲーム名ではないので除外
            if re.search(r"https?://|www\.|%[0-9A-Fa-f]{2}", s):
                continue
            if re.fullmatch(r"【[^】]*】", s):
                continue
            # 基本1行1タイトル。「、」区切りのみ分割(「/」「・」はゲーム名に含まれるため分割しない)
            for piece in re.split(r"[、,]", s):
                piece = piece.strip("　 ・-")
                if not piece:
                    continue
                canonical = aliases.get(piece)
                if canonical:
                    games.append(canonical)
                else:
                    games.append(piece)
                    unknown_games.add(piece)
        chapters = parse_chapters(parse_section(desc, ["チャプター"]))

        # 概要文: ■より前の本文をリード文として使う
        lead = desc.split("■")[0].strip()[:300]

        ep = by_num.get(num)
        if ep is None:
            ep = {"number": num, "title": clean_title, "tags": [], "series": None,
                  "description": "", "games": [], "chapters": [], "links": {}, "guid": None}
            data["episodes"].append(ep)
            by_num[num] = ep
            created += 1
            # 新規回: タイトルからシリーズタグ候補を自動付与
            for slug, (label, kws) in SERIES_KEYWORDS.items():
                if any(k in clean_title for k in kws):
                    ep["series"] = slug
                    if label not in ep["tags"]:
                        ep["tags"].append(label)
        else:
            # "locked": true の回は手動修正を優先し、RSSでの上書きを一切行わない
            if ep.get("locked"):
                locked += 1
                continue
            updated += 1

        ep["title"] = clean_title
        if pub:
            # pubDateはUTC表記なのでJSTに直してから日付にする(深夜配信のズレ防止)
            ep["date"] = parsedate_to_datetime(pub).astimezone(JST).date().isoformat()
            ep["date_estimated"] = False
        if lead:
            ep["description"] = lead
        if games:
            ep["games"] = sorted(set(games), key=games.index)
        if chapters:
            ep["chapters"] = chapters
        ep["guid"] = guid
        if link:
            ep["links"]["spotify"] = link  # anchor/Spotifyのエピソードリンク

        # エピソード個別画像: URLが変わった or ローカルに未保存のときだけ取得
        if img_url and (ep.get("image_src") != img_url or not (IMG_DIR / f"{num}.jpg").exists()):
            try:
                ep["image"] = download_image(img_url, num)
                ep["image_src"] = img_url
                images += 1
            except Exception as ex:
                print(f"  画像取得失敗 #{num}: {ex}")

    data["episodes"].sort(key=lambda e: e["number"])
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"更新: {updated}件 / 新規: {created}件 / 画像取得: {images}件 / ロック保護: {locked}件")
    if unknown_games:
        print("--- 表記ゆれ辞書に未登録のゲーム名(必要ならaliases.jsonへ追加) ---")
        for g in sorted(unknown_games):
            print("  ", g)

    subprocess.run([sys.executable, str(ROOT / "scripts/build.py")], check=True)


if __name__ == "__main__":
    main()
