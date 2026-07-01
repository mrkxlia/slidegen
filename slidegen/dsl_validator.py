"""
dsl_validator.py — DSL の静的バリデーション（純粋関数・軽量版）

build() の前に走らせ、確実に導出できる問題だけを検出する。型ごとの必須ブロック等を
ハードコードしたカタログは**持たない**（RENDERERS と乖離してドリフト負債になるため。
「真実は RENDERERS」の方針に合わせる）。ここで見るのは:

  validate(slides, renderers) → ValidationResult
    .blocking_warnings: 未知の型（RENDERERS に無い）→ CLI では exit(1)
    .warnings:          誤ったトップレベルキー / 実質空スライド → 警告表示のみ

新しい観点を足すときも「RENDERERS もしくは DSL 構造から機械的に判る」ものに限ること。
"""
from __future__ import annotations
from dataclasses import dataclass, field

# col ブロックに書くべき内容を、トップレベルのキーとして誤記しがちなもの。
INVALID_TOP_LEVEL_KEYS = frozenset({"bullet", "event", "step"})


@dataclass
class ValidationResult:
    blocking_warnings: list = field(default_factory=list)
    warnings: list = field(default_factory=list)

    @property
    def ok(self) -> bool:
        """処理を止めるべき致命的エラーが無ければ True。"""
        return not self.blocking_warnings


def validate(slides, renderers) -> ValidationResult:
    """slides（parse 済み）を検査して ValidationResult を返す。renderers は RENDERERS。"""
    result = ValidationResult()
    for i, slide in enumerate(slides, 1):
        label = f"スライド {i}（{slide.type}型）"

        # 1) 未知の型 — 描画できないので致命的。
        if slide.type not in renderers:
            result.blocking_warnings.append(f"{label}: 未対応の型です")
            continue

        # 2) col ブロックに書くべき内容をトップレベルキーで書いている誤記法。
        for key in INVALID_TOP_LEVEL_KEYS:
            if key in slide.props:
                result.warnings.append(
                    f"{label}: `{key}` はトップレベルでは使えません。col ブロックに書き直してください"
                )

        # 3) 実質空のスライド（props も blocks も無い）— 空白ページになりやすい。
        if not slide.props and not slide.blocks:
            result.warnings.append(f"{label}: 内容が空です（headline も col も無し）")

    return result
