# -*- coding: utf-8 -*-
"""エピソード別の配信サービスリンクを自動取得し、episodes.json に格納する。

各サービスの取得方法:
  Apple Podcasts : iTunes Lookup API(認証不要)。guidで確実に全回マッピング
  LISTEN         : LISTENが再配信しているRSS。guidで確実に全回マッピング
  YouTube        : チャンネルの動画フィード(最新15件のみ)。
                   タイトルの「第N回」でマッピング。過去回は links.youtube を手動設定
  Spotify        : 元RSSのlink(update_from_rss.pyが取得済み)
  Amazon Music   : 自動取得の手段がないため links.amazon を手動設定(任意)

自動取得したリンク(apple/listen/youtube)は毎回最新値で上書きされる。
手動フィールド(amazon、過去回のyoutube)は上書きされない。

使い方:  python scripts/fetch_links.py   (取得→episodes.json更新。ビルドは別途)
※ update_from_rss.py からも毎週自動で呼ばれるので、通常は手動実行不要。
"""
import json
import pathlib
import re
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data/episodes.json"

APPLE_LOOKUP = "https://itunes.apple.com/lookup?id={id}&country=jp&entity=podcastEpisode&limit=200"
LISTEN_RSS = "https://rss.listen.style/p/gamenotktb/rss"
YOUTUBE_FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCrq-apGKPlVLSHznlD_BqIQ"


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "takitsubo-site-links"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def _apple_links(site):
    """guid → Apple Podcastsのエピソードページ"""
    m = re.search(r"/id(\d+)", site["services"]["apple"]["url"])
    if not m:
        return {}
    data = json.loads(_get(APPLE_LOOKUP.format(id=m.group(1))))
    out = {}
    for x in data.get("results", []):
        if x.get("wrapperType") == "podcastEpisode" and x.get("episodeGuid") and x.get("trackViewUrl"):
            out[x["episodeGuid"]] = x["trackViewUrl"]
    return out


def _listen_links():
    """guid → LISTENのエピソードページ"""
    tree = ET.fromstring(_get(LISTEN_RSS))
    out = {}
    for item in tree.iter("item"):
        guid = (item.findtext("guid") or "").strip()
        link = (item.findtext("link") or "").strip()
        if guid and link:
            out[guid] = link
    return out


def _youtube_links():
    """回番号 → YouTube動画URL(フィードは最新15件のみ)"""
    ns = {"a": "http://www.w3.org/2005/Atom"}
    tree = ET.fromstring(_get(YOUTUBE_FEED))
    out = {}
    for entry in tree.findall("a:entry", ns):
        title = entry.findtext("a:title", "", ns)
        m = re.search(r"第(\d+)回", title)
        link_el = entry.find("a:link[@rel='alternate']", ns)
        if m and link_el is not None:
            out[int(m.group(1))] = link_el.get("href")
    return out


def update_links(episodes, site):
    """エピソードリストのlinksを更新して更新件数を返す(失敗したサービスはスキップ)"""
    updated = 0
    sources = []
    try:
        sources.append(("apple", "guid", _apple_links(site)))
    except Exception as ex:
        print(f"  Appleリンク取得失敗(スキップ): {ex}")
    try:
        sources.append(("listen", "guid", _listen_links()))
    except Exception as ex:
        print(f"  LISTENリンク取得失敗(スキップ): {ex}")
    try:
        sources.append(("youtube", "number", _youtube_links()))
    except Exception as ex:
        print(f"  YouTubeリンク取得失敗(スキップ): {ex}")

    for e in episodes:
        links = e.setdefault("links", {})
        for key, by, table in sources:
            ref = e.get("guid") if by == "guid" else e["number"]
            url = table.get(ref)
            if url and links.get(key) != url:
                links[key] = url
                updated += 1
    for key, _, table in sources:
        print(f"  {key}: ソース{len(table)}件")
    return updated


def main():
    site = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    n = update_links(data["episodes"], site)
    if n:
        DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"エピソード別リンク更新: {n}件")
    cover = {}
    for key in ("spotify", "apple", "listen", "youtube", "amazon"):
        cover[key] = sum(1 for e in data["episodes"] if e.get("links", {}).get(key))
    print("カバレッジ:", " / ".join(f"{k} {v}回" for k, v in cover.items()))


if __name__ == "__main__":
    main()
