# -*- coding: utf-8 -*-
"""エピソード別の配信サービスリンクを自動取得し、episodes.json に格納する。

各サービスの取得方法:
  Spotify(open)  : creators.spotify.com の番組ページに全エピソードの
                   open.spotify.com URLが埋まっているので、episodeIdで対応付け
  Apple Podcasts : iTunes Lookup API(認証不要)。guidで確実に全回マッピング
  LISTEN         : LISTENが再配信しているRSS。guidで確実に全回マッピング
  YouTube        : Podcastプレイリスト(site.jsonのyoutube_playlist)を読み、
                   タイトルの「第N回」でマッピング。チャンネルフィード(最新15件)も併用
  Amazon Music   : 自動取得の手段がないため links.amazon を手動設定(任意)

自動取得したリンク(spotify_open/apple/listen/youtube)は毎回最新値で上書きされる。
手動フィールド(amazon等)は上書きされない。

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
INNERTUBE_BROWSE = "https://www.youtube.com/youtubei/v1/browse?key={key}"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) takitsubo-site-links"


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ja"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def _post_json(url, payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "User-Agent": UA, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


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


def _spotify_open_links(episodes):
    """anchorのepisodeId → open.spotify.com のエピソードページ。
    creators.spotify.com の番組ページ1枚に全エピソード分のspotifyUrlが埋まっている"""
    slug = None
    for e in episodes:
        m = re.search(r"/pod/(?:show|profile)/([^/]+)/", e.get("links", {}).get("spotify", ""))
        if m:
            slug = m.group(1)
            break
    if not slug:
        return {}
    html = _get(f"https://creators.spotify.com/pod/profile/{slug}").decode("utf-8", errors="replace")
    out = {}
    # 1エピソード分のオブジェクト内に "episodeId":"..." → "spotifyUrl":"..." の順で並ぶ
    pat = re.compile(r'"episodeId":"([A-Za-z0-9]+)"(?:(?!"episodeId").)*?"spotifyUrl":"(https:[^"]+)"', re.S)
    for ep_id, raw in pat.findall(html):
        url = raw.replace("\\u002F", "/")
        if "open.spotify.com/episode/" in url:
            out[ep_id] = url
    return out


def _walk_lockups(obj, out):
    """YouTubeのJSONから (videoId, タイトル) を集める(lockupViewModel形式)"""
    if isinstance(obj, dict):
        lv = obj.get("lockupViewModel")
        if isinstance(lv, dict) and lv.get("contentId"):
            title = (lv.get("metadata", {}).get("lockupMetadataViewModel", {})
                     .get("title", {}).get("content"))
            if title:
                out[lv["contentId"]] = title
        for v in obj.values():
            _walk_lockups(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _walk_lockups(v, out)


def _find_tokens(obj, out):
    """JSON内の継続トークンをすべて集める(格納場所のUI変更に依存しないよう総当たり)"""
    if isinstance(obj, dict):
        c = obj.get("continuationCommand")
        if isinstance(c, dict) and c.get("token"):
            out.add(c["token"])
        for v in obj.values():
            _find_tokens(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _find_tokens(v, out)


def _youtube_playlist_links(site):
    """回番号 → YouTube動画URL。Podcastプレイリストから全件取得(継続読み込み対応)"""
    url = site.get("youtube_playlist")
    if not url:
        return {}
    html = _get(url).decode("utf-8", errors="replace")
    m = re.search(r"ytInitialData\s*=\s*(\{.*?\})\s*;\s*</script>", html, re.S)
    if not m:
        return {}
    data = json.loads(m.group(1))
    videos = {}
    _walk_lockups(data, videos)

    # 100件を超えるプレイリストは innertube の継続APIで残りを取得。
    # トークンの格納場所はUI変更で動くため、見つかったものを総当たりで試す
    key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
    ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', html)
    pending, seen = set(), set()
    _find_tokens(data, pending)
    # ytInitialDataの外側にトークンが置かれる場合があるのでHTML全体からも拾う
    pending.update(re.findall(r'"continuationCommand":\{"token":"([^"]+)"', html))
    for _ in range(15):  # 念のため上限
        if not (pending and key and ver):
            break
        token = pending.pop()
        seen.add(token)
        try:
            # hl/glを指定しないとタイトルが英語自動翻訳で返り「第N回」が拾えないことがある
            resp = _post_json(INNERTUBE_BROWSE.format(key=key.group(1)), {
                "context": {"client": {"clientName": "WEB", "clientVersion": ver.group(1),
                                       "hl": "ja", "gl": "JP"}},
                "continuation": token,
            })
        except Exception:
            continue
        _walk_lockups(resp, videos)
        new_tokens = set()
        _find_tokens(resp, new_tokens)
        pending |= (new_tokens - seen)

    out = {}
    for vid, title in videos.items():
        # 「第N回」のほか、自動翻訳された英語タイトル(Episode N / Ep. N)にも保険で対応
        m2 = re.search(r"第(\d+)回", title) or re.search(r"\bEp(?:isode|\.)?\s*(\d+)", title, re.I)
        if m2:
            out[int(m2.group(1))] = f"https://www.youtube.com/watch?v={vid}"
    return out


def _youtube_feed_links():
    """回番号 → YouTube動画URL(チャンネルフィード=最新15件。プレイリスト未登録の新着用)"""
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
        yt = _youtube_playlist_links(site)
        try:
            yt = {**yt, **_youtube_feed_links()}  # プレイリスト未登録の新着はフィードで補完
        except Exception:
            pass
        sources.append(("youtube", "number", yt))
    except Exception as ex:
        print(f"  YouTubeリンク取得失敗(スキップ): {ex}")
    try:
        spotify_open = _spotify_open_links(episodes)
        sources.append(("spotify_open", "anchor_id", spotify_open))
    except Exception as ex:
        print(f"  Spotify(open)リンク取得失敗(スキップ): {ex}")

    for e in episodes:
        links = e.setdefault("links", {})
        for key, by, table in sources:
            if by == "guid":
                ref = e.get("guid")
            elif by == "number":
                ref = e["number"]
            else:  # anchor_id: anchorリンク末尾の「-eXXXX」を照合
                m = re.search(r"-(\w+)$", links.get("spotify", ""))
                ref = m.group(1) if m else None
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
    for key in ("spotify", "spotify_open", "apple", "listen", "youtube", "amazon"):
        cover[key] = sum(1 for e in data["episodes"] if e.get("links", {}).get(key))
    print("カバレッジ:", " / ".join(f"{k} {v}回" for k, v in cover.items()))


if __name__ == "__main__":
    main()
