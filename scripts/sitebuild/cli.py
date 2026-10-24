"""CLI entry and generation order; used by manual builds and RSS updates."""
from .context import EPS, SERIES
from .home import recommended_episodes, build_index
from .episodes import build_episode_list, build_episode_pages, build_search_json
from .series import build_series
from .awq import build_awq
from .pages import build_news, build_guide, build_otayori, build_privacy, build_lab
from .shindan import build_shindan_json, build_shindan
from .games import build_games
from .sitemap import static_page_dates, build_sitemap


def main(argv=None):
    import argparse
    parser = argparse.ArgumentParser(description="Generate the site or selected prototype pages")
    parser.add_argument("--page", choices=["lab", "shindan"], action="append", help="Generate only this page (repeatable); existing data JSON is reused")
    args = parser.parse_args(argv)
    static_page_dates()  # Validate metadata before writing any output.
    if args.page:
        for name in dict.fromkeys(args.page):
            {"lab": build_lab, "shindan": build_shindan}[name]()
        print("Generated: " + ", ".join(args.page))
        return 0
    recommended_episodes()  # 設定不備がある場合は生成物を書き換える前に停止
    build_search_json()    # 先に生成(episode一覧ページが ?v= のハッシュを参照するため)
    build_shindan_json()   # 同上(診断ページが ?v= のハッシュを参照)
    build_shindan()
    build_lab()
    n_games = build_games()
    build_index()
    build_episode_list()
    build_episode_pages()
    build_series()
    build_awq()
    build_news()
    build_guide()
    build_otayori()
    build_privacy()
    build_sitemap()
    print(f"ビルド完了: エピソード{len(EPS)}ページ + シリーズ{len(SERIES)}ページ + AWQランキング + データベース{n_games}ページ + その他")
    return 0
