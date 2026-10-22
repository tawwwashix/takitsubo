"""Serve this checkout on a stable, local-only origin and open its episode lab."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import socket
import sys
from urllib.error import URLError
from urllib.request import build_opener, ProxyHandler
import webbrowser

ROOT = Path(__file__).resolve().parent.parent
STATUS_PATH = "/__episode_lab_preview__/status"


class PreviewServer(ThreadingHTTPServer):
    # HTTPServer's default address reuse can bind an occupied port on Windows.
    allow_reuse_address = sys.platform != "win32"

    def server_bind(self):
        if sys.platform == "win32":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Refresh must show the current worktree even when generated hashes are unchanged.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == STATUS_PATH:
            body = json.dumps({"app": "takitsubo-episode-lab-preview", "root": str(ROOT)}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, format, *args):
        if len(args) < 2 or str(args[1]) not in ("200", "304"):
            super().log_message(format, *args)


def is_same_preview(origin):
    try:
        # Do not send localhost requests through a configured system proxy.
        opener = build_opener(ProxyHandler({}))
        with opener.open(origin + STATUS_PATH, timeout=2) as response:
            info = json.loads(response.read(8192))
        return (info.get("app") == "takitsubo-episode-lab-preview"
                and Path(info.get("root", "")).resolve() == ROOT)
    except (URLError, OSError, ValueError, AttributeError):
        return False


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")
    if not (ROOT / "lab.html").is_file():
        print("ページが見つからない。このWorktreeでページを生成してから起動してね。", flush=True)
        return 1
    origin = f"http://127.0.0.1:{args.port}"
    url = origin + "/lab.html"
    if is_same_preview(origin):
        print(f"このWorktreeのプレビューは起動済み。\n{url}", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        return 0
    try:
        server = PreviewServer(("127.0.0.1", args.port), partial(PreviewHandler, directory=str(ROOT)))
    except OSError as error:
        print(f"ポート {args.port} を利用できない。ほかのサーバーを上書きせず停止した。\n"
              f"既に開いているプレビュー用のウィンドウを確認してね。\n{error}", flush=True)
        return 1
    title = "エピソード研究所"
    print(f"\n{title} — このWorktreeのプレビュー\n\n"
          f"フォルダー: {ROOT}\nURL: {url}\n\n"
          "このウィンドウを開いたまま遊べる。終了は Ctrl+C、またはウィンドウを閉じる。\n"
          "更新された内容を見るときは、ブラウザを再読み込みしてね。\n"
          "PC内だけに公開。ビルド、RSS更新、Git操作は行わない。\n", flush=True)
    if not args.no_browser and not webbrowser.open(url):
        print("ブラウザを自動で開けなかったので、上のURLを開いてね。", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nプレビューを終了した。", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
