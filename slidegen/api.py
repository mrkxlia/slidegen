"""
api.py — バックエンド用の public API。

アプリ（Webバックエンド等）から import して使う薄いラッパ。
parser.parse + render.build を組み合わせるだけで、座標・色・型登録の詳細は隠す。

設計の肝：
  - render_to_bytes はディスクを介さず、メモリ(io.BytesIO)で pptx の bytes を返す。
    HTTPレスポンスとしてそのまま返せるので、ファイルI/Oを持たないサーバーでも使える。
  - これらの関数を import した時点で親パッケージ slidegen/__init__.py が先に実行され、
    全 render_* が読み込まれて RENDERERS が埋まる。よって `from slidegen.api import ...`
    のようにトップ import を介さない経路でも全型がレンダリングできる。

CLI（slidegen/__main__.py, cli.py）もこの API を土台にする。
"""
from __future__ import annotations
import io
from pathlib import Path

from pptx.presentation import Presentation as _PresentationType

from .parser import parse
from .render import build
from .theme import Theme


def render_text(text: str, *, theme: Theme | None = None,
                template: str | None = None) -> _PresentationType:
    """記法テキストを python-pptx の Presentation オブジェクトに変換して返す。

    theme を省略（None）した場合、template があれば potx のテーマ色を自動抽出し、
    無ければ DEFAULT_THEME を使う（決定は build() 側）。
    """
    return build(parse(text), theme=theme, template=template)


def render_to_bytes(text: str, *, theme: Theme | None = None,
                    template: str | None = None) -> bytes:
    """記法テキストを pptx の bytes に変換して返す（メモリ完結・ディスク不要）。

    Webバックエンドからは、この bytes をそのまま
    `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`
    のレスポンスボディとして返せる。
    """
    prs = render_text(text, theme=theme, template=template)
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def render_file(input_path, output_path, *, theme: Theme | None = None,
                template: str | None = None) -> Path:
    """記法ファイル(.slide)を読み、pptx を output_path に保存する。保存先 Path を返す。"""
    text = Path(input_path).read_text(encoding="utf-8")
    prs = render_text(text, theme=theme, template=template)
    out = Path(output_path)
    prs.save(str(out))
    return out
