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
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from decimal import Decimal, InvalidOperation

from PIL import Image, ImageOps


ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data/ranking.json"
IMAGE_DIR = ROOT / "assets/img/awq"
IMAGE_SIZE = 640
IMAGE_QUALITY = 82

DEFAULT_SOURCE = {
    "spreadsheet_id": "1MeALGhgFlJluJpskujNx9pQJ0ivtwx7mJrc10UREMI0",
    "quiz_sheet": "出題リンク",
}
SEASON_SHEET_RE = re.compile(r"^シーズン([1-9]\d*)$")
SEASON_START_NOTE = "シーズン開始"
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


def workbook_sheet_names(spreadsheet_id: str) -> list[str]:
    """公開ブックのシート名をxlsxのメタデータから取得する。"""
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=xlsx"
    raw = fetch_bytes(
        url,
        accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
    )
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as workbook:
            info = workbook.getinfo("xl/workbook.xml")
            if info.file_size > 1024 * 1024:
                raise ValueError("Google Sheetsのブック情報が1MBを超えています")
            workbook_xml = workbook.read(info)
        root = ET.fromstring(workbook_xml)
    except (KeyError, zipfile.BadZipFile, ET.ParseError) as exc:
        raise ValueError("Google Sheetsのシート一覧を読み取れません") from exc

    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    sheets = root.find("main:sheets", namespace)
    if sheets is None:
        raise ValueError("Google Sheetsにシートがありません")
    return [sheet.attrib["name"] for sheet in sheets if sheet.attrib.get("name")]


def discover_score_sheet_names(spreadsheet_id: str) -> list[str]:
    """「シーズンN」シートを自動検出し、新しい順で返す。"""
    seasons = {}
    for sheet_name in workbook_sheet_names(spreadsheet_id):
        match = SEASON_SHEET_RE.fullmatch(sheet_name)
        if not match:
            continue
        number = int(match.group(1))
        if number in seasons:
            raise ValueError(f"シーズン番号が重複しています: {sheet_name}")
        seasons[number] = sheet_name

    if not seasons:
        raise ValueError("「シーズン1」形式の得点シートがありません")
    missing = sorted(set(range(1, max(seasons) + 1)) - seasons.keys())
    if missing:
        labels = "、".join(f"シーズン{number}" for number in missing)
        raise ValueError(f"得点シートは連番にしてください。不足: {labels}")
    return [seasons[number] for number in sorted(seasons, reverse=True)]


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
    declared_start_round = None

    if not rows or padded(rows[0], 9)[:3] != ["回", "名前", "ポイント"]:
        raise ValueError(f"{sheet_name}: A1:C1は「回 / 名前 / ポイント」にしてください")

    for row_number, source_row in enumerate(rows[1:], 2):
        row = padded(source_row, 9)
        round_text, name, points_text, note = row[0], row[1], row[2], row[3]
        x_url, summary_name, summary_points, summary_count = row[5:9]

        if name or points_text or round_text or note:
            if note == SEASON_START_NOTE and (name or points_text):
                raise ValueError(
                    f"{sheet_name}!{row_number}: 「{SEASON_START_NOTE}」行は名前とポイントを空欄にしてください"
                )
            if not name and not points_text:
                episode = parse_round(
                    round_text,
                    where=f"{sheet_name}!A{row_number}",
                    allow_blank=True,
                )
                if note == SEASON_START_NOTE:
                    if episode is None:
                        raise ValueError(
                            f"{sheet_name}!{row_number}: シーズン開始回をA列に入力してください"
                        )
                    if declared_start_round is not None:
                        raise ValueError(f"{sheet_name}: 「{SEASON_START_NOTE}」行が重複しています")
                    declared_start_round = episode
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

    return {
        "entries": entries,
        "listeners": listeners,
        "summaries": summaries,
        "declared_start_round": declared_start_round,
    }


def build_seasons(parsed_sheets: dict[str, dict], global_accounts: dict[str, str]) -> list[dict]:
    season_numbers = {}
    for sheet_name in parsed_sheets:
        match = SEASON_SHEET_RE.fullmatch(sheet_name)
        if not match:
            raise ValueError(f"得点シート名は「シーズンN」形式にしてください: {sheet_name}")
        number = int(match.group(1))
        if number in season_numbers:
            raise ValueError(f"シーズン番号が重複しています: {sheet_name}")
        season_numbers[number] = sheet_name
    latest_season = max(season_numbers)

    seasons = []
    for sheet_name, parsed in parsed_sheets.items():
        number = int(SEASON_SHEET_RE.fullmatch(sheet_name).group(1))

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
        season = {
            "season": number,
            "label": sheet_name,
            "active": number == latest_season,
            "start_round": parsed.get("declared_start_round"),
            "through_round": max(rounds) if rounds else None,
            "entries": parsed["entries"],
            "ranking": ranking,
        }
        seasons.append(season)

    seasons.sort(key=lambda season: season["season"], reverse=True)
    return seasons


def assign_season_starts(seasons: list[dict], quizzes: list[dict]) -> None:
    """明示マーカーを優先し、未指定の既存シーズンは前季の集計末尾から補完する。"""
    if not seasons:
        return

    ascending = sorted(seasons, key=lambda season: season["season"])
    quiz_rounds = [quiz["round"] for quiz in quizzes]
    earliest_quiz = min(quiz_rounds) if quiz_rounds else None
    latest_quiz = max(quiz_rounds) if quiz_rounds else None

    previous_start = None
    for index, season in enumerate(ascending):
        start_round = season.get("start_round")
        if index == 0 and start_round is None:
            start_round = earliest_quiz
        elif index > 0 and start_round is None:
            if season.get("through_round") is None:
                raise ValueError(
                    f"{season['label']}: 新しい空のシーズンには、A列へ開始回、D列へ"
                    f"「{SEASON_START_NOTE}」と入力してください"
                )
            previous_through = ascending[index - 1].get("through_round")
            if previous_through is None:
                raise ValueError(
                    f"{season['label']}: 開始回を推定できません。A列へ開始回、D列へ"
                    f"「{SEASON_START_NOTE}」と入力してください"
                )
            start_round = previous_through + 1

        if start_round is None:
            raise ValueError(f"{season['label']}: 開始回を決定できません")
        if previous_start is not None and start_round <= previous_start:
            raise ValueError(f"{season['label']}: 開始回は前シーズンより後にしてください")
        season["start_round"] = start_round
        previous_start = start_round

        scored_rounds = [
            entry["round"] for entry in season.get("entries", []) if entry.get("round") is not None
        ]
        rounds_before_start = [
            round_number for round_number in scored_rounds if round_number < start_round
        ]
        if rounds_before_start:
            raise ValueError(
                f"{season['label']}: 開始回より前の得点があります: 第{min(rounds_before_start)}回"
            )

    for season, next_season in zip(ascending, ascending[1:]):
        season_end = next_season["start_round"] - 1
        if season.get("through_round") is not None and season["through_round"] > season_end:
            raise ValueError(
                f"{season['label']}: 第{season['through_round']}回の得点が次シーズンの範囲と重なっています"
            )
    if latest_quiz is not None and ascending[-1]["start_round"] > latest_quiz + 1:
        raise ValueError(
            f"{ascending[-1]['label']}: 開始回は最新の出題（第{latest_quiz}回）の次までにしてください"
        )


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
        image.thumbnail((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(".tmp.webp")
        image.save(temporary, "WEBP", quality=IMAGE_QUALITY, method=6)
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
            if old.get("image_source_url"):
                quiz["image_source_url"] = old["image_source_url"]
                quiz["image_source_index"] = old.get("image_source_index", 1)
            if destination.exists():
                quiz["image"] = str(relative_path)
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
    quiz_sheet_name = source.get("quiz_sheet") or DEFAULT_SOURCE["quiz_sheet"]
    score_sheet_names = discover_score_sheet_names(spreadsheet_id)

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

    quizzes = parse_quizzes(sheet_rows(spreadsheet_id, quiz_sheet_name, "A:D"))
    seasons = build_seasons(parsed_sheets, global_accounts)
    assign_season_starts(seasons, quizzes)
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
    else:
        print("HTMLは未生成です。サイト表示も更新する場合は --build を付けて実行してください。")


if __name__ == "__main__":
    main()
