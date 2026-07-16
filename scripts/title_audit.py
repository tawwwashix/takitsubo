# -*- coding: utf-8 -*-
"""タイトル表記ゆれの検出ツール(統廃合の仕上げ用・ワンショット実行)。

名寄せ後もなお別タイトル扱いになっている「怪しいペア」を機械抽出する:
  A. 編集距離1〜2のペア(タイプミス疑い)。数字・ローマ数字・英字だけの差
     (鉄拳2/鉄拳3、FF VI/VII等の正当なナンバリング差)は除外
  B. 片方がもう片方の前方一致になっているペア(表記の長短ゆれ疑い)。
     「○○シリーズ」の親子関係と、差分が数字等だけのものは除外

出力は候補リストであり、統合すべきかどうかは人間が判断する。
統合する場合は data/aliases.json に表記ゆれを1行足す(→次回RSS更新で名寄せ)か、
data/episodes.json の該当回の表記を直接直す。

使い方:  python scripts/title_audit.py
"""
import importlib.util
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("build", ROOT / "scripts/build.py")
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

# ナンバリング・エディション差として無視する文字
NUMERIC = set("0123456789ivxIVXⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ")


def levenshtein(a, e, limit=2):
    """編集距離(limitを超えたら打ち切り)"""
    if abs(len(a) - len(e)) > limit:
        return limit + 1
    prev = list(range(len(e) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        best = limit + 1
        for j, cb in enumerate(e, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (ca != cb)))
            best = min(best, cur[-1])
        if best > limit:
            return limit + 1
        prev = cur
    return prev[-1]


def diff_chars(a, e):
    """2つの文字列の差分に含まれる文字の集合(雑でよい: 対称差ベース)"""
    from collections import Counter
    ca, cb = Counter(a), Counter(e)
    out = set()
    for ch in set(ca) | set(cb):
        if ca[ch] != cb[ch]:
            out.add(ch)
    return out


def main():
    items = b.games_db()
    keys = [(i["key"], i["title"], i["count"]) for i in items]
    n = len(keys)
    print(f"対象: {n}タイトル\n")

    print("=== A. 編集距離1〜2(タイプミス疑い) ===")
    hits_a = 0
    for x in range(n):
        ka, ta, ca = keys[x]
        if len(ka) < 5:
            continue
        for y in range(x + 1, n):
            kb, tb, cb2 = keys[y]
            if len(kb) < 5:
                continue
            d = levenshtein(ka, kb)
            if d <= 2 and not diff_chars(ka, kb) <= NUMERIC:
                print(f"  「{ta}」({ca}回) ⇔ 「{tb}」({cb2}回)")
                hits_a += 1
    print(f"  計{hits_a}件\n")

    print("=== B. 前方一致(表記の長短ゆれ疑い) ===")
    hits_b = 0
    for x in range(n):
        ka, ta, ca = keys[x]
        if len(ka) < 5 or ka.endswith("シリーズ"):
            continue
        for y in range(n):
            if x == y:
                continue
            kb, tb, cb2 = keys[y]
            if kb.endswith("シリーズ") or not kb.startswith(ka):
                continue
            rest = kb[len(ka):]
            # ナンバリング・記号だけの差、副題(スペース等で始まる長い続き)は正当な別作品とみなす
            if set(rest) <= NUMERIC or len(rest) >= 7:
                continue
            print(f"  「{ta}」({ca}回) ⊂ 「{tb}」({cb2}回)  差分:「{rest}」")
            hits_b += 1
    print(f"  計{hits_b}件")


if __name__ == "__main__":
    main()
