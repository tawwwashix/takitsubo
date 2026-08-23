# -*- coding: utf-8 -*-
"""GoogleスプレッドシートからAWQランキングと出題画像を同期する。

通常運用:
  python scripts/sync_awq.py --build

Google Sheetsをランキングの原本とし、data/ranking.json を生成する。
出題画像はXの公式埋め込み表示から画像IDを取得し、初回だけローカルへ保存する。
一度保存した画像はX側へ再問い合わせしないため、公開済みページはXの状態に依存しない。
"""
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import pathlib
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from decimal import Decimal, InvalidOperation

from PIL import Image, ImageOps


ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data/ranking.json"
IMAGE_DIR = ROOT / "assets/img/awq"

DEFAULT_SOURCE = {
    "spreadsheet_id": "1MeALGhgFlJluJpskujNx9pQJ0ivtwx7mJrc10UREMI0",
    "score_sheets": ["シーズン3", "シーズン2", "シーズン1"],
    "quiz_sheet": "出題リンク",
}
SEASON_META = {
    "シーズン1": {"season": 1, "label": "シーズン1", "active": False},
    "シーズン2": {"season": 2, "label": "シーズン2", "active": False},
    "シーズン3": {"season": 3, "label": "シーズン3", "active": True},
}
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 "
    "takitsubo-awq-sync/1.0"
)
X_POST_RE = re.compile(r"^https://x\.com/game_tktb/status/(\d+)(?:[/?#].*)?$")
X_ACCOUNT_RE = re.compile(r"^https://x\.com/[A-Za-z0-9_]+/?$")
MEDIA_ID_RE = re.compile(r"https://pbs\.twimg\.com/media/([A-Za-z0-9_-]+)")


def fetch_bytes(url: str, *, accept: str = "*/*", timeout: int = 30) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": accept},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        data = response.read(25 * 1024 * 1024 + 1)
        if len(data) > 25 * 1024 * 1024:
            raise ValueError("取得データが25MBを超えています")
        return data


def sheet_rows(spreadsheet_id: str, sheet_name: str, cell_range: str) -> list[list[str]]:
    params = urllib.parse.urlencode(
        {"tqx": "out:csv", "sheet": sheet_name, "range": cell_range}
    )
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?{params}"
    raw = fetch_bytes(url, accept="text/csv,*/*")
    text = raw.decode("utf-8-sig")
    return [[cell.strip() for cell in row] for row in csv.reader(io.StringIO(text))]


def padded(row: list[str], size: int) -> list[str]:
    return row[:size] + [""] * max(0, size - len(row))


def parse_decimal(value: str, *, where: str) -> Decimal:
    normalized = value.replace(",", "").strip()
    try:
        number = Decimal(normalized)
    except InvalidOperation as exc:
        raise ValueError(f"{where}: ポイント「{value}」を数値として読めません") from exc
    if not number.is_finite():
        raise ValueError(f"{where}: ポイントが有限値ではありません")
    return number


def json_number(value: Decimal) -> int | float:
    if value == value.to_integral_value():
        return int(value)
    return float(value)


def parse_round(value: str, *, where: str, allow_blank: bool = False) -> int | None:
    value = value.strip()
    if not value and allow_blank:
        return None
    try:
        number = int(value)
    except ValueError as exc:
        raise ValueError(f"{where}: 回「{value}」を整数として読めません") from exc
    if number < 0:
        raise ValueError(f"{where}: 回は0以上にしてください")
    return number


def load_previous() -> dict:
    try:
        return json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def normalize_x_account(url: str) -> str:
    url = url.strip().replace("https://twitter.com/", "https://x.com/")
    return url.rstrip("/") if url else ""


def parse_score_sheet(rows: list[list[str]], sheet_name: str) -> dict:
    entries = []
    listeners = []
    summaries = {}
    seen_listener_rows = set()

    if not rows or padded(rows[0], 9)[:3] != ["回", "名前", "ポイント"]:
        raise ValueError(f"{sheet_name}: A1:C1は「回 / 名前 / ポイント」にしてください")

    for row_number, source_row in enumerate(rows[1:], 2):
        row = padded(source_row, 9)
        round_text, name, points_text, note = row[0], row[1], row[2], row[3]
        x_url, summary_name, summary_points, summary_count = row[5:9]

        if name or points_text or round_text:
            if not name and not points_text:
                pass  # 将来分として回だけ入力された行
            elif not name or not points_text:
                raise ValueError(f"{sheet_name}!{row_number}: 名前とポイントは両方入力してください")
            else:
                points = parse_decimal(points_text, where=f"{sheet_name}!C{row_number}")
                episode = parse_round(
                    round_text,
                    where=f"{sheet_name}!A{row_number}",
                    allow_blank=True,
                )
                item = {
                    "round": episode,
                    "listener": name,
                    "points": json_number(points),
                }
                if note:
                    item["note"] = note
                entries.append(item)

        if summary_name:
            normalized_url = normalize_x_account(x_url)
            if normalized_url and not X_ACCOUNT_RE.match(normalized_url):
                raise ValueError(
                    f"{sheet_name}!F{row_number}: XアカウントURLの形式が不正です: {x_url}"
                )
            if summary_name in seen_listener_rows:
                raise ValueError(f"{sheet_name}: 名簿に「{summary_name}」が重複しています")
            seen_listener_rows.add(summary_name)
            listeners.append({"name": summary_name, "x_url": normalized_url or None})

            if summary_points:
                total = parse_decimal(summary_points, where=f"{sheet_name}!H{row_number}")
                try:
                    award_count = int(summary_count.replace(",", "")) if summary_count else None
                except ValueError:
                    award_count = None
                summaries[summary_name] = (total, award_count)

    return {"entries": entries, "listeners": listeners, "summaries": summaries}


def build_seasons(parsed_sheets: dict[str, dict], global_accounts: dict[str, str]) -> list[dict]:
    seasons = []
    for sheet_name, parsed in parsed_sheets.items():
        meta = SEASON_META.get(sheet_name)
        if not meta:
            raise ValueError(f"未設定の得点シートです: {sheet_name}")

        totals: dict[str, Decimal] = defaultdict(Decimal)
        counts: dict[str, int] = defaultdict(int)
        participant_names = {listener["name"] for listener in parsed["listeners"]}
        for entry in parsed["entries"]:
            name = entry["listener"]
            participant_names.add(name)
            totals[name] += Decimal(str(entry["points"]))
            counts[name] += 1

        ranking = []
        for name in participant_names:
            ranking.append(
                {
                    "listener": name,
                    "points": json_number(totals[name]),
                    "awards": counts[name],
                    "x_url": global_accounts.get(name) or None,
                }
            )
        ranking.sort(key=lambda item: (-Decimal(str(item["points"])), -item["awards"], item["listener"]))

        previous_points = None
        previous_rank = 0
        for position, item in enumerate(ranking, 1):
            points = Decimal(str(item["points"]))
            if points != previous_points:
                previous_rank = position
                previous_points = points
            item["rank"] = previous_rank

        for name, (sheet_total, sheet_count) in parsed["summaries"].items():
            if totals[name] != sheet_total or (sheet_count is not None and counts[name] != sheet_count):
                print(
                    f"  ⚠ {sheet_name}: {name} のシート集計"
                    f"({json_number(sheet_total)}pt/{sheet_count}回)と明細集計"
                    f"({json_number(totals[name])}pt/{counts[name]}回)が一致しません。明細を採用します。"
                )

        missing_accounts = [item["listener"] for item in ranking if not item["x_url"]]
        if missing_accounts:
            print(f"  ⚠ {sheet_name}: Xアカウント未登録: {', '.join(missing_accounts)}")

        rounds = [entry["round"] for entry in parsed["entries"] if entry["round"] is not None]
        season = dict(meta)
        season.update(
            {
                "through_round": max(rounds) if rounds else None,
                "entries": parsed["entries"],
                "ranking": ranking,
            }
        )
        seasons.append(season)

    seasons.sort(key=lambda season: season["season"], reverse=True)
    return seasons


def parse_quizzes(rows: list[list[str]]) -> list[dict]:
    if not rows or padded(rows[0], 4)[:4] != ["回", "X投稿URL", "画像番号", "備考"]:
        raise ValueError("出題リンク: A1:D1は「回 / X投稿URL / 画像番号 / 備考」にしてください")

    quizzes = []
    seen_rounds = set()
    for row_number, source_row in enumerate(rows[1:], 2):
        round_text, x_url, image_index_text, note = padded(source_row, 4)
        if not x_url:
            continue
        quiz_round = parse_round(round_text, where=f"出題リンク!A{row_number}")
        if quiz_round in seen_rounds:
            raise ValueError(f"出題リンク: 第{quiz_round}回が重複しています")
        seen_rounds.add(quiz_round)

        match = X_POST_RE.match(x_url)
        if not match:
            raise ValueError(
                f"出題リンク!B{row_number}: game_tktbのX投稿URLではありません: {x_url}"
            )
        image_index = parse_round(
            image_index_text or "1",
            where=f"出題リンク!C{row_number}",
        )
        if image_index is None or not 1 <= image_index <= 4:
            raise ValueError(f"出題リンク!C{row_number}: 画像番号は1〜4にしてください")

        quiz = {
            "round": quiz_round,
            "x_url": x_url.split("?", 1)[0].rstrip("/"),
            "image_index": image_index,
        }
        if note:
            quiz["note"] = note
        quizzes.append(quiz)

    quizzes.sort(key=lambda quiz: quiz["round"])
    return quizzes


def extract_media_ids(x_url: str) -> list[str]:
    status_id = X_POST_RE.match(x_url).group(1)
    urls = [
        f"https://platform.twitter.com/embed/Tweet.html?id={status_id}&dnt=true&theme=light",
        x_url,
    ]
    for url in urls:
        try:
            source = fetch_bytes(url, accept="text/html,*/*").decode("utf-8", "replace")
        except Exception:
            continue
        decoded = html.unescape(source).replace("\\/", "/")
        decoded = urllib.parse.unquote(decoded)
        media_ids = list(dict.fromkeys(MEDIA_ID_RE.findall(decoded)))
        if media_ids:
            return media_ids
    raise RuntimeError("X投稿から画像URLを取得できませんでした")


def save_media_image(media_id: str, destination: pathlib.Path) -> None:
    image_url = f"https://pbs.twimg.com/media/{media_id}?format=jpg&name=large"
    raw = fetch_bytes(image_url, accept="image/avif,image/webp,image/apng,image/*,*/*")
    with Image.open(io.BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(".tmp.webp")
        image.save(temporary, "WEBP", quality=82, method=6)
        temporary.replace(destination)


def sync_quiz_images(
    quizzes: list[dict], previous: dict, *, no_images: bool, force_images: bool
) -> tuple[int, list[str]]:
    previous_quizzes = {quiz.get("round"): quiz for quiz in previous.get("quizzes", [])}
    post_cache: dict[str, list[str]] = {}
    downloaded = 0
    failures = []

    for quiz in quizzes:
        quiz_round = quiz["round"]
        relative_path = pathlib.PurePosixPath("assets/img/awq") / f"{quiz_round}.webp"
        destination = ROOT / pathlib.Path(*relative_path.parts)
        old = previous_quizzes.get(quiz_round, {})
        source_matches = (
            old.get("image_source_url") == quiz["x_url"]
            and old.get("image_source_index", 1) == quiz["image_index"]
        )

        if no_images:
            if destination.exists():
                quiz["image"] = str(relative_path)
            if old.get("image_source_url"):
                quiz["image_source_url"] = old["image_source_url"]
                quiz["image_source_index"] = old.get("image_source_index", 1)
            continue

        needs_download = force_images or not destination.exists() or not source_matches
        if needs_download:
            try:
                media_ids = post_cache.get(quiz["x_url"])
                if media_ids is None:
                    media_ids = extract_media_ids(quiz["x_url"])
                    post_cache[quiz["x_url"]] = media_ids
                image_position = quiz["image_index"] - 1
                if image_position >= len(media_ids):
                    raise RuntimeError(
                        f"画像{quiz['image_index']}を指定していますが、投稿には{len(media_ids)}枚しかありません"
                    )
                save_media_image(media_ids[image_position], destination)
                downloaded += 1
                quiz["image_source_url"] = quiz["x_url"]
                quiz["image_source_index"] = quiz["image_index"]
            except Exception as exc:
                failures.append(f"第{quiz_round}回: {exc}")
                if old.get("image_source_url"):
                    quiz["image_source_url"] = old["image_source_url"]
                    quiz["image_source_index"] = old.get("image_source_index", 1)
        else:
            quiz["image_source_url"] = quiz["x_url"]
            quiz["image_source_index"] = quiz["image_index"]

        if destination.exists():
            quiz["image"] = str(relative_path)

    return downloaded, failures


def sync(*, no_images: bool = False, force_images: bool = False) -> dict:
    previous = load_previous()
    source = previous.get("source") or DEFAULT_SOURCE
    spreadsheet_id = source.get("spreadsheet_id") or DEFAULT_SOURCE["spreadsheet_id"]
    score_sheet_names = source.get("score_sheets") or DEFAULT_SOURCE["score_sheets"]
    quiz_sheet_name = source.get("quiz_sheet") or DEFAULT_SOURCE["quiz_sheet"]

    parsed_sheets = {}
    global_accounts = {}
    account_owners = {}
    for sheet_name in score_sheet_names:
        rows = sheet_rows(spreadsheet_id, sheet_name, "A:I")
        parsed = parse_score_sheet(rows, sheet_name)
        parsed_sheets[sheet_name] = parsed
        for listener in parsed["listeners"]:
            name, x_url = listener["name"], listener["x_url"]
            if not x_url:
                continue
            if name in global_accounts and global_accounts[name] != x_url:
                raise ValueError(
                    f"Xアカウントが競合しています: {name} = {global_accounts[name]} / {x_url}"
                )
            if x_url in account_owners and account_owners[x_url] != name:
                raise ValueError(
                    f"Xアカウントが複数名に対応しています: {x_url} = "
                    f"{account_owners[x_url]} / {name}"
                )
            global_accounts[name] = x_url
            account_owners[x_url] = name

    seasons = build_seasons(parsed_sheets, global_accounts)
    quizzes = parse_quizzes(sheet_rows(spreadsheet_id, quiz_sheet_name, "A:D"))
    downloaded, failures = sync_quiz_images(
        quizzes,
        previous,
        no_images=no_images,
        force_images=force_images,
    )

    output = {
        "_使い方": (
            "Googleスプレッドシートから scripts/sync_awq.py が自動生成します。"
            "このファイルを直接編集せず、得点と出題リンクはスプレッドシートで更新してください。"
        ),
        "source": {
            "spreadsheet_id": spreadsheet_id,
            "score_sheets": score_sheet_names,
            "quiz_sheet": quiz_sheet_name,
        },
        "listeners": [
            {"name": name, "x_url": url}
            for name, url in sorted(global_accounts.items(), key=lambda item: item[0])
        ],
        "seasons": seasons,
        "quizzes": quizzes,
    }
    DATA_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    total_entries = sum(len(season["entries"]) for season in seasons)
    print(
        f"AWQ同期完了: 得点明細{total_entries}件 / "
        f"出題リンク{len(quizzes)}件 / 新規・更新画像{downloaded}件"
    )
    if failures:
        print("--- X画像を取得できなかった回(次回も自動再試行します) ---")
        for failure in failures:
            print("  ⚠", failure)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="AWQランキングをGoogle Sheetsから同期")
    parser.add_argument("--build", action="store_true", help="同期後に全HTMLも再生成する")
    parser.add_argument("--no-images", action="store_true", help="X画像の取得を行わない")
    parser.add_argument(
        "--force-images",
        action="store_true",
        help="保存済みの出題画像もすべて再取得する",
    )
    args = parser.parse_args()

    sync(no_images=args.no_images, force_images=args.force_images)
    if args.build:
        subprocess.run([sys.executable, str(ROOT / "scripts/build.py")], check=True)


if __name__ == "__main__":
    main()
