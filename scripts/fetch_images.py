# -*- coding: utf-8 -*-
"""RSSフィードから各エピソードの画像だけを取り込むスクリプト。

タイトル・概要などの他データには一切触れず、
  - 画像をダウンロード → 800pxに縮小して assets/img/ep/{番号}.jpg に保存
  - episodes.json の各回に "image" / "image_src" フィールドを追記
だけを行う。既存エピソードへの画像バックフィル用。

元画像は3000x3000(約1.5MB)と大きいため、Web表示用に800px・JPEG品質82へ
縮小して保存する(1枚あたり100KB前後になり、リポジトリ容量を守る)。

使い方:  python3 scripts/fetch_images.py
毎週の自動更新(update_from_rss.py)にも同じ画像取得処理が入っているので、
新規回は自動で画像が付く。このスクリプトは主に初回の一括取得用。
"""
import io, json, re, pathlib, subprocess, sys
import urllib.request
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
DATA_PATH = ROOT / "data/episodes.json"
IMG_DIR = ROOT / "assets/img/ep"
IMG_REL = "assets/img/ep"
IMG_SIZE = 800      # 保存する最大辺(px)。カード表示には十分な解像度
IMG_QUALITY = 82    # JPEG品質


def save_resized(raw_bytes, num):
    """画像バイト列を縮小して保存し、相対パスを返す"""
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    dest = IMG_DIR / f"{num}.jpg"
    im = Image.open(io.BytesIO(raw_bytes))
    im = im.convert("RGB")
    im.thumbnail((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
    im.save(dest, "JPEG", quality=IMG_QUALITY, optimize=True, progressive=True)
    return f"{IMG_REL}/{num}.jpg"


def download_image(url, num):
    """エピソード画像をダウンロード→縮小保存。相対パスを返す。"""
    req = urllib.request.Request(url, headers={"User-Agent": "takitsubo-site-updater"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
    return save_resized(raw, num)


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    by_num = {e["number"]: e for e in data["episodes"]}

    req = urllib.request.Request(SITE["rss"], headers={"User-Agent": "takitsubo-site-updater"})
    with urllib.request.urlopen(req, timeout=30) as r:
        xml_text = r.read()

    tree = ET.fromstring(xml_text)
    ns = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd"}

    got, skipped, missing = 0, 0, 0
    for item in tree.iter("item"):
        title = (item.findtext("title") or "").strip()
        m = re.match(r"第(\d+)回", title)
        if not m:
            continue
        num = int(m.group(1))
        ep = by_num.get(num)
        if ep is None:
            continue

        img_el = item.find("itunes:image", ns)
        img_url = img_el.get("href") if img_el is not None else None
        if not img_url:
            missing += 1
            continue

        # 既に同じURLを保存済みならスキップ
        if ep.get("image_src") == img_url and (IMG_DIR / f"{num}.jpg").exists():
            skipped += 1
            continue

        try:
            ep["image"] = download_image(img_url, num)
            ep["image_src"] = img_url
            got += 1
            print(f"  取得 #{num}")
        except Exception as ex:
            print(f"  画像取得失敗 #{num}: {ex}")

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"画像取得: {got}件 / スキップ(取得済み): {skipped}件 / RSS側に画像なし: {missing}件")

    subprocess.run([sys.executable, str(ROOT / "scripts/build.py")], check=True)


if __name__ == "__main__":
    main()
