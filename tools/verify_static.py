#!/usr/bin/env python3
"""Static project checks that only require the Python standard library."""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
JSON_PATHS = (ROOT / "package.json", ROOT / "manifest.webmanifest")
JS_PATHS = (
    ROOT / "src" / "core.js",
    ROOT / "src" / "game.js",
    ROOT / "src" / "report.js",
)
CSS_PATH = ROOT / "src" / "styles.css"
SERVICE_WORKER_PATH = ROOT / "sw.js"


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        for key in ("href", "src"):
            value = attr_map.get(key)
            if value and not value.startswith(("http://", "https://", "#")):
                self.assets.append(value)


def fail(message: str) -> None:
    print(f"verify_static: {message}", file=sys.stderr)
    raise SystemExit(1)


def check_json() -> None:
    for path in JSON_PATHS:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            fail(f"{path.relative_to(ROOT)} has invalid JSON: {exc}")


def check_html_assets() -> None:
    parser = AssetParser()
    parser.feed(HTML_PATH.read_text(encoding="utf-8"))

    for asset in parser.assets:
        target = (HTML_PATH.parent / asset).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            fail(f"HTML asset escapes repository root: {asset}")
        if not target.exists():
            fail(f"HTML asset is missing: {asset}")


def check_js_imports() -> None:
    import_pattern = re.compile(r"from\s+[\"'](?P<path>\./[^\"']+)[\"']")
    for js_path in JS_PATHS:
        text = js_path.read_text(encoding="utf-8")
        for match in import_pattern.finditer(text):
            target = (js_path.parent / match.group("path")).resolve()
            if not target.exists():
                fail(
                    f"{js_path.relative_to(ROOT)} imports missing file "
                    f"{match.group('path')}"
                )


def check_required_game_ids() -> None:
    html = HTML_PATH.read_text(encoding="utf-8")
    js_bundle = "\n".join(path.read_text(encoding="utf-8") for path in JS_PATHS)
    ids = re.findall(r'id="([^"]+)"', html)

    for element_id in ids:
        selector = f"#{element_id}"
        if selector in js_bundle or element_id in ("game-canvas",):
            continue
        fail(f"DOM id is not wired in game.js: {element_id}")


def check_css_guardrails() -> None:
    css = CSS_PATH.read_text(encoding="utf-8")
    if re.search(r"letter-spacing\s*:\s*-", css):
        fail("negative letter spacing is not allowed")
    if re.search(r"font-size\s*:\s*[^;]*(vw|vh|vmin|vmax)", css):
        fail("viewport-scaled font sizes are not allowed")


def check_service_worker_cache() -> None:
    text = SERVICE_WORKER_PATH.read_text(encoding="utf-8")
    cached_assets = set(re.findall(r'"([^"]+)"', text))
    required_assets = {
        "index.html",
        "manifest.webmanifest",
        "assets/favicon.svg",
        "src/core.js",
        "src/game.js",
        "src/report.js",
        "src/styles.css",
    }
    missing = sorted(required_assets - cached_assets)
    if missing:
        fail(f"service worker cache is missing: {', '.join(missing)}")


def check_result_deep_link_wiring() -> None:
    html = HTML_PATH.read_text(encoding="utf-8")
    game = (ROOT / "src" / "game.js").read_text(encoding="utf-8")
    required_snippets = (
        'id="link-button"',
        'const resultParam = "result"',
        "createResultUrl",
        "syncResultUrl",
        "URLSearchParams(location.search)",
    )

    for snippet in required_snippets:
        if snippet not in html and snippet not in game:
            fail(f"result deep-link wiring is missing: {snippet}")


def main() -> None:
    check_json()
    check_html_assets()
    check_js_imports()
    check_required_game_ids()
    check_css_guardrails()
    check_service_worker_cache()
    check_result_deep_link_wiring()
    print("verify_static: OK")


if __name__ == "__main__":
    main()
