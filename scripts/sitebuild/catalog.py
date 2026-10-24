"""Game catalog normalization, readings, grouping and diagnosis pool."""
import json
import re
import unicodedata
from .context import EPS, EPS_BY_NUM, ROOT


def _shindan_norm(t):
    """表記ゆれの名寄せ用キー: 全半角統一・末尾の括弧注記除去・スペース/末尾記号除去"""
    s = unicodedata.normalize("NFKC", t)
    s = re.sub(r"^.*?GOTY\d{4}[:：]", "", s, flags=re.I)  # 「○○のYourGOTY2025:」等の企画プレフィックス
    s = s.strip("『』「」")
    s = s.replace("─", "-").replace("―", "-").replace("‐", "-")  # ダッシュ類を統一
    s = re.sub(r"[(（][^)）]*[)）]\s*$", "", s)  # 「タイトル(Steam版)」等の末尾注記
    s = re.sub(r"[\s　]", "", s).lower()
    return s.rstrip("-ー–—・:：")


def episode_game_entries(e):
    """概要欄のゲームリストから索引・診断の対象行だけを返す(共通の除外規則)。
    見出し行(【…】)・注記付き行(※)・まとめ行(／)は対象外"""
    for i, g in enumerate(e["games"]):
        if g.startswith("【") or "※" in g or "／" in g:
            continue
        yield i, g


def shindan_pool():
    """診断プール: 全エピソードの登場ゲームを集計。番組が更新されると自動で増える。
    表記ゆれ(括弧注記・全半角など)は名寄せして1タイトルに統合。
    各ゲームに「最も関連していそうな回」(featured_games指定の回>3分ゲーム紹介の回>
    エピソードタイトルにゲーム名を含む回>概要欄の先頭近くで挙がった回>新しい回)を紐づける。"""
    stats = {}
    counted = set()  # (キー, 回番号) — 同じ回での二重カウント防止

    def bump(key_norm, name, num, score):
        s = stats.setdefault(key_norm, {"count": 0, "best": None, "names": {}})
        if (key_norm, num) not in counted:
            counted.add((key_norm, num))
            s["count"] += 1
        s["names"][name] = s["names"].get(name, 0) + 1
        key = (score, num)
        if s["best"] is None or key > s["best"]:
            s["best"] = key

    for e in EPS:
        # メイン指定(featured_games)の回は、そのタイトルのジャケットとして最優先
        for name in e.get("featured_games", []):
            key_norm = _shindan_norm(name)
            if key_norm:
                bump(key_norm, name, e["number"], 300)
        # 3分ゲーム紹介で扱った回は次点(索引と母集団を揃えるため、リスト外のタイトルも拾う)
        for name in sanbun_titles(e):
            key_norm = _shindan_norm(name)
            if key_norm:
                bump(key_norm, name, e["number"], 200)
        for i, g in episode_game_entries(e):
            key_norm = _shindan_norm(g)
            if not key_norm:
                continue
            pos_score = max(0, 10 - i)  # 概要欄の先頭に近いほどメインの話題
            # エピソードタイトルにゲーム名が入っていれば、関連の深い回
            title_hit = len(g) >= 4 and (g in e["title"] or g[:6] in e["title"])
            bump(key_norm, g, e["number"], (100 if title_hit else 0) + pos_score)
    games, used_eps = [], {}
    for s in sorted(stats.values(), key=lambda v: (-v["count"], min(v["names"]))):
        # 代表表記: いちばん多く使われた表記(同数なら短いほう)
        title = sorted(s["names"].items(), key=lambda kv: (-kv[1], len(kv[0])))[0][0]
        pos_score, num = s["best"]
        main_flag = 1 if pos_score >= 8 else 0  # タイトル一致 or 先頭3件以内=「話していそう」
        games.append([title, s["count"], num, main_flag])
        e = EPS_BY_NUM[num]
        used_eps[str(num)] = [e["title"], e.get("image") or ""]
    return games, used_eps


def _n_light(s):
    """照合用の軽い正規化: NFKC・小文字化・スペース除去(語られ度の判定に使う)"""
    return re.sub(r"[\s　]", "", unicodedata.normalize("NFKC", str(s)).lower())


def _to_kata(s):
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)


GYO_ROWS = [
    ("あ", "アイウエオヴァィゥェォ"),
    ("か", "カキクケコガギグゲゴヵヶ"),
    ("さ", "サシスセソザジズゼゾ"),
    ("た", "タチツテトダヂヅデドッ"),
    ("な", "ナニヌネノ"),
    ("は", "ハヒフヘホバビブベボパピプペポ"),
    ("ま", "マミムメモ"),
    ("や", "ヤユヨャュョ"),
    ("ら", "ラリルレロ"),
    ("わ", "ワヲン"),
]


GAME_SECTIONS = [g[0] for g in GYO_ROWS] + ["英数", "記号", "その他"]


try:
    READINGS = json.loads((ROOT / "data/game_readings.json").read_text(encoding="utf-8"))["readings"]
except FileNotFoundError:
    READINGS = {}


def game_reading(title):
    """並び順に使うカタカナ読み。辞書優先、なければタイトル自身(かな→カタカナ化)"""
    if title in READINGS:
        return _to_kata(unicodedata.normalize("NFKC", READINGS[title]))
    t = unicodedata.normalize("NFKC", title)
    t = re.sub(r"^[「『【（()\[\]'\".,・~〜―─\-\s　]+", "", t)  # 先頭の記号・括弧は読み飛ばす
    return _to_kata(t)


def game_section(title):
    r = game_reading(title)
    if not r:
        return "記号"
    c = r[0]
    for key, chars_ in GYO_ROWS:
        if c in chars_:
            return key
    if c.isascii() and (c.isalpha() or c.isdigit()):
        return "英数"
    if "一" <= c <= "鿿":
        print(f"  読みがな未登録(「その他」の欄に並びます): {title} → data/game_readings.json に追加を推奨")
        return "その他"
    return "英数" if c.isalnum() else "記号"


def game_slug(key):
    """タイトルの名寄せキーから安定したURL用スラッグを作る(FNV-1aハッシュ)"""
    h = 2166136261
    for ch in key:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return "g" + format(h, "08x")


_GAMES_DB = None


def sanbun_titles(e):
    """「滝壺3分ゲーム紹介」で紹介したタイトルを返す。
    チャプター名に「滝壺3分ゲーム紹介」と（）の両方がある行から（）内を抽出
    (「その2（○○）」形式も拾い、無関係な（）付きチャプターは拾わない)。
    手動指定 "sanbun_games": ["タイトル"] があれば合わせて返す(RSS更新でも消えない)"""
    out = []
    for c in e.get("chapters", []):
        label = c.get("label", "")
        if "滝壺3分ゲーム紹介" not in label:
            continue
        for m in re.finditer(r"[（(]([^（）()]+)[）)]", label):
            t = m.group(1).strip()
            if t and t != "仮":
                out.append(t)
    out += e.get("sanbun_games", [])
    return out


def games_db():
    """全エピソードからタイトル索引データを作る(結果はキャッシュ)。
    各タイトル×各回に「語られ度」を付ける:
      3=メインで語られた回(featured_games = 概要欄の★ or 手動指定)
      2=滝壺3分ゲーム紹介で紹介
      1=チャプターに登場(コーナー等でまとまった話)
      0=トーク内で話題に出ただけ"""
    global _GAMES_DB
    if _GAMES_DB is not None:
        return _GAMES_DB
    stats = {}

    def note(k, name, num):
        s = stats.setdefault(k, {"names": {}, "eps": {}})
        s["names"][name] = s["names"].get(name, 0) + 1
        s["eps"].setdefault(num, set()).add(name)

    featured, sanbun = {}, {}
    for e in EPS:
        # 全回★フォーマット化済みの前提。ゲームが載っているのにfeatured_gamesが
        # 無い回は、概要欄の★凡例の書き忘れの可能性が高いので警告する(推定はしない)
        if e["games"] and "featured_games" not in e:
            print(f"  ⚠ #{e['number']}: featured_games(★)が未設定。概要欄の見出しに「★=メインで語ったタイトル」があるか確認を")
        for name in e.get("featured_games", []):
            k = _shindan_norm(name)
            if k:
                featured.setdefault(e["number"], set()).add(k)
                note(k, name, e["number"])
        for name in sanbun_titles(e):
            k = _shindan_norm(name)
            if k:
                sanbun.setdefault(e["number"], set()).add(k)
                note(k, name, e["number"])
        for _, g in episode_game_entries(e):
            k = _shindan_norm(g)
            if k:
                note(k, g, e["number"])
    items, used_slugs = [], {}
    for k, s in sorted(stats.items()):
        title = sorted(s["names"].items(), key=lambda kv: (-kv[1], len(kv[0])))[0][0]
        eps_info = []
        for num in sorted(s["eps"]):
            e = EPS_BY_NUM[num]
            # チャプター照合(語られ度📑と、個別ページのタイムスタンプ表示に使う)
            raws = {_n_light(x) for x in (s["eps"][num] | {title})}
            raws = {x for x in raws if len(x) >= 4}  # 短すぎる語は誤ヒットするので照合しない
            chaps = []
            for c in e.get("chapters", []):
                cl = _n_light(c["label"])
                if any(r in cl for r in raws):
                    chaps.append(c)
            if k in featured.get(num, set()):
                level = 3
            elif k in sanbun.get(num, set()):
                level = 2
            elif chaps:
                level = 1
            else:
                level = 0
            eps_info.append({"num": num, "level": level, "chapters": chaps})
        slug = game_slug(k)
        while slug in used_slugs:  # 万一のハッシュ衝突
            slug += "x"
        used_slugs[slug] = k
        max_level = max(x["level"] for x in eps_info)
        items.append({
            "key": k, "title": title, "slug": slug, "eps": eps_info,
            "count": len(eps_info),
            "max_level": max_level,
            # 品質ゲート: 1回ちょい出しのみのタイトルは個別ページを作らない
            # (索引には載せ、該当エピソードへ直接リンクする)
            "paged": len(eps_info) >= 2 or max_level >= 1,
            "reading": game_reading(title),
            "section": game_section(title),
        })
    _GAMES_DB = items
    return items


def games_series_map():
    """シリーズ自動グループ化: 「○○シリーズ」というタイトルが存在するとき、
    名寄せキーが「○○」で始まるタイトルをその子とみなす(人間の統合判断は不要)。
    data/game_series.json で例外を補正できる(stem=短い語幹の明示 / add / remove)。
    返り値: (child_of, children_of, page_child_of, page_children_of)
      前者2つ=前方一致のみ(索引の字下げ用・五十音順を壊さない)
      後者2つ=add補正込み(シリーズページ・個別ページの関連表示用)"""
    items = games_db()
    by_key = {i["key"]: i for i in items}

    try:
        overrides = json.loads((ROOT / "data/game_series.json").read_text(encoding="utf-8")).get("series", {})
    except FileNotFoundError:
        overrides = {}
    ov = {}
    for parent_title, o in overrides.items():
        pk = _shindan_norm(parent_title)
        if pk in by_key:
            ov[pk] = o
        else:
            print(f"  ⚠ game_series.json: 「{parent_title}」というタイトルが索引に見つかりません")

    parents = {}
    for i in items:
        if not i["key"].endswith("シリーズ"):
            continue
        o = ov.get(i["key"], {})
        if o.get("stem"):
            stem = _shindan_norm(o["stem"])
            min_len = 1  # 明示された語幹は長さ制限なし
        else:
            # 名寄せキーは末尾の長音等を落とすので、語幹にも同じ正規化を適用して比較する
            stem = i["key"][: -len("シリーズ")].rstrip("-ー–—・:：")
            min_len = 3  # 自動語幹は誤爆防止のため3文字以上
        if len(stem) >= min_len:
            parents[stem] = i

    removed = {}  # 親キー → 外す子キーの集合
    for pk, o in ov.items():
        for t in o.get("remove", []):
            removed.setdefault(pk, set()).add(_shindan_norm(t))

    child_of, children_of = {}, {}
    for i in items:
        if i["key"].endswith("シリーズ"):
            continue
        best = None
        for stem, p in parents.items():
            if i["key"].startswith(stem) and (best is None or len(stem) > len(best[0])):
                best = (stem, p)
        if best and i["key"] not in removed.get(best[1]["key"], set()):
            child_of[i["key"]] = best[1]
            children_of.setdefault(best[1]["key"], []).append(i["key"])

    # ページ表示用: add(前方一致しないシリーズ作品)を合成
    page_child_of = dict(child_of)
    page_children_of = {k: list(v) for k, v in children_of.items()}
    for pk, o in ov.items():
        for t in o.get("add", []):
            ck = _shindan_norm(t)
            if ck not in by_key:
                print(f"  ⚠ game_series.json: add指定「{t}」が索引に見つかりません")
                continue
            if ck in page_child_of:
                continue
            page_child_of[ck] = by_key[pk]
            page_children_of.setdefault(pk, []).append(ck)

    for m in (children_of, page_children_of):
        for k in m:
            m[k].sort(key=lambda ck: by_key[ck]["reading"])
    return child_of, children_of, page_child_of, page_children_of


def game_item_href(item, root_to_games=""):
    """索引・チップからのリンク先: ページがあれば個別ページ、なければ唯一の登場回へ"""
    if item["paged"]:
        return f"{root_to_games}{item['slug']}.html"
    return f"{root_to_games}../episodes/{item['eps'][0]['num']}.html"


def game_slug_map():
    """エピソードページのタグリンク用: 名寄せキー → データベースページのスラッグ
    (個別ページを持つタイトルのみ)"""
    m = {}
    for item in games_db():
        if item["paged"]:
            m[item["key"]] = item["slug"]
    return m


LEVEL_BADGE = {
    3: ("l3", "⭐ メインで語られた回"),
    2: ("l2", "🍜 滝壺3分ゲーム紹介"),
    1: ("l1", "📑 チャプターで登場"),
    0: ("l0", "💬 トーク内で登場"),
}


LEVEL_MARK = {3: "⭐", 2: "🍜", 1: "📑", 0: ""}


def _game_aliases_for(item, alias_pairs):
    """タイトルに対応する略称(検索用)を返す"""
    out = []
    for alias, canonical in alias_pairs:
        if _shindan_norm(canonical) and _shindan_norm(canonical) in item["key"]:
            out.append(alias)
    return out
