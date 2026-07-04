# ゲームの滝壺 公式サイト

ゲーム系ポッドキャスト「ゲームの滝壺」の公式サイト一式です。
**データ(JSON)を書き換えてビルドすると、全ページが自動生成される**仕組みになっています。

## フォルダ構成

```
takitsubo/
├── index.html            トップページ(生成物)
├── guide.html            ポッドキャストの聴き方(生成物)
├── otayori.html          おたよりフォーム(生成物)
├── episodes/             エピソード一覧+全112回の個別ページ(生成物)
├── series/               名物企画ページ(生成物)
├── news/                 お知らせページ(生成物)
├── assets/               CSS・JS・画像
├── data/                 ★ここを編集する
│   ├── site.json         サイト設定(URL・メンバー情報など)
│   ├── episodes.json     全エピソードデータ
│   ├── series.json       名物企画の定義
│   ├── news.json         お知らせ
│   ├── aliases.json      ゲームタイトル表記ゆれ辞書
│   └── ranking.json      アートワーククイズ集計(ページは後日実装)
├── scripts/
│   ├── build.py          データ→全HTML生成
│   ├── update_from_rss.py RSSから新着取得→自動更新(画像も取得)
│   ├── fetch_images.py   既存回のエピソード画像を一括取り込み(初回用)
│   └── seed_episodes.py  初期データ生成(基本もう使わない)
└── .github/workflows/update.yml  毎週水曜に自動更新するGitHub Actions
```

## 最初にやること(公開前チェックリスト)

1. **`data/site.json` の TODO を埋める**
   - Spotify / Apple Podcasts / Amazon Music / LISTEN の番組URL
   - 夜中たわしのブログ「夜中に前へ」のURL
   - `base_url` を実際の公開URLに(例: `https://ユーザー名.github.io/takitsubo`)
2. `python3 scripts/build.py` を実行して再生成
3. ローカル確認: `python3 -m http.server` を実行して `http://localhost:8000` を開く
   (※検索機能は fetch を使うため、ファイル直開きでは動きません。必ずサーバー経由で確認)

## 公開のしかた(GitHub Pages・無料)

1. GitHubで新しいリポジトリを作成(公開設定)
2. このフォルダの中身をすべてpush
3. リポジトリの Settings → Pages → Branch を `main` / `(root)` にして保存
4. 数分で `https://ユーザー名.github.io/リポジトリ名/` に公開されます
5. **自動更新が有効化**: `.github/workflows/update.yml` が毎週水曜の配信後にRSSを見に行き、新着エピソードのページを自動生成してコミットします。基本ノータッチでOK

## 日常の運用

### 新エピソード → 何もしなくてOK
毎週水曜23:30(JST)にGitHub Actionsが自動実行され、タイトル・配信日・概要文・チャプター・登場ゲームタイトルが自動反映されます。

### 表記ゆれ辞書を育てる(ときどき)
自動実行のログに「表記ゆれ辞書に未登録のゲーム名」が出力されます。
気になったら `data/aliases.json` に1行追加 → 次回実行から自動で名寄せされます。

### エピソード画像 → 自動で取り込み・表示
各回のアートワーク(RSSの `itunes:image`)を `assets/img/ep/<番号>.jpg` に取り込み、
一覧・名物企画のカード画像と個別ページの見出し画像として自動表示します。
- 保存時に **800pxへ自動縮小**(元3000pxのままだと容量を圧迫するため)。Pillowが必要: `pip install Pillow`
- 新規回は毎週の自動更新(`update_from_rss.py`)で画像も一緒に取得されます。
- 既存回にまとめて取り込みたいときは `python3 scripts/fetch_images.py` を実行。
  (画像URLが変わった回・未取得の回だけダウンロードするので、何度実行してもOK)
画像が無い回は番号バッジで表示されます。個別ページのOGP画像(SNSシェア時のサムネ)にも各回の画像が使われます。

### シリーズの新しい回
タイトルに「わるい村」「ふさわしいゲーム」等が含まれていれば自動でタグ付けされます。
外れた場合は `data/episodes.json` の該当回の `"series"` と `"tags"` を手で直すだけ。

### お知らせを追加
`data/news.json` に1ブロック追加 → `python3 scripts/build.py`(GitHub上ならcommitすればActions実行時に反映)

### 名物企画を追加
`data/series.json` に1ブロック追加し、対象回の `series` フィールドにslugを設定 → ビルド

### アートワーククイズランキング(後日実装)
`data/ranking.json` に毎週の結果を追記しておけば、ページ実装時にそのまま集計できます。

## Claude Code への引き継ぎ方

このフォルダごとClaude Codeに渡せば、続きの開発ができます。手順:

1. Claude Code(デスクトップアプリ or ターミナル)を起動
2. このフォルダを開いて、最初にこう伝える:
   > 「このフォルダはポッドキャスト公式サイトです。READMEを読んで構成を把握してください。」
3. あとはやりたいことを日本語で頼むだけ。例:
   - 「GitHub Pagesへの公開まで手伝って」
   - 「ranking.jsonを使ってアートワーククイズのランキングページを作って」
   - 「トップページのヒーローに新しい背景イラスト(assets/img/hero.pngに置いた)を組み込んで」

## 技術メモ

- 静的サイト(サーバー不要・無料ホスティングでOK)
- 検索は `assets/js/search.js` がクライアントサイドで実行(ひらがな→カタカナ変換対応)
- 個別ページの「登場ゲームタイトル」タグを押すと、一覧ページに `?q=ゲーム名` 付きで飛び、同じゲームの回を横断検索できる
- OGP画像・ファビコン・sitemap.xml・robots.txt 生成済み
