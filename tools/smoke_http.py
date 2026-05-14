#!/usr/bin/env python3
"""Serve the repo briefly and smoke-test the static app shell."""

from __future__ import annotations

import contextlib
import functools
import http.server
import socketserver
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATHS = (
    "/",
    "/index.html",
    "/manifest.webmanifest",
    "/assets/favicon.svg",
    "/src/core.js",
    "/src/game.js",
    "/src/styles.css",
    "/sw.js",
)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def fail(message: str) -> None:
    print(f"smoke_http: {message}", file=sys.stderr)
    raise SystemExit(1)


def request(url: str) -> bytes:
    try:
        with urllib.request.urlopen(url, timeout=4) as response:
            if response.status != 200:
                fail(f"{url} returned {response.status}")
            return response.read()
    except urllib.error.URLError as exc:
        fail(f"{url} failed: {exc}")


def main() -> None:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with ReusableTCPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base_url = f"http://127.0.0.1:{server.server_address[1]}"

        try:
            for path in PATHS:
                body = request(f"{base_url}{path}")
                if not body:
                    fail(f"{path} returned an empty body")

            index = request(f"{base_url}/index.html").decode("utf-8")
            if "Lumen Drift" not in index:
                fail("index.html is missing the game title")
            if 'src="src/game.js"' not in index:
                fail("index.html is missing the game module")
            if 'href="src/styles.css"' not in index:
                fail("index.html is missing the stylesheet")
        finally:
            with contextlib.suppress(Exception):
                server.shutdown()

    print("smoke_http: OK")


if __name__ == "__main__":
    main()
