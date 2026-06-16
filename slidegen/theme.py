"""
theme.py — デザイン制約をコードで固定するレイヤー。

設計ドキュメント §3（デザイン制約）と §2-bis（編集可能性）に対応。
- 配色は3カテゴリのみ（base / main / accent）。比率 70:25:5 を運用で守る。
- フォントは1種。
- ここを potx 由来の値に差し替えれば、会社テンプレートに準拠できる。

【社内 Claude Code への引き継ぎメモ】
本来は potx のテーマカラー（accent1 等）を参照するのが理想（§2-bis ルール3）。
potx が用意できたら、下記のRGB直値を potx のスライドマスター/テーマ参照に置き換えること。
python-pptx では prs.slide_masters[0] のテーマ色を読めるので、そこから引く実装に変更する。
"""
from dataclasses import dataclass, field
from pptx.util import Pt
from pptx.dml.color import RGBColor


def hex_to_rgb(h: str) -> RGBColor:
    h = h.lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


@dataclass
class Theme:
    # ---- 配色（3カテゴリのみ / 70:25:5） ----
    base:     str = "FFFFFF"   # ベース 70%（背景）
    base_2:   str = "F4F6F8"   # ベースの濃淡（カード地）
    main:     str = "1F3A5F"   # メイン 25%（基本1色）
    main_2:   str = "3D6098"   # メインの濃淡
    main_3:   str = "D7E0EC"   # メインの薄い濃淡
    accent:   str = "E2483D"   # アクセント 5%（強調1箇所のみ）
    ink:      str = "262626"   # 文字（真っ黒は避ける／Cone則：パレット黒列上から3つ目相当のグレー）
    muted:    str = "6B7280"   # 補足文字
    rule:     str = "D9DDE2"   # 罫線（グレー・目立たせない / §3-2）
    on_main:  str = "FFFFFF"   # メイン地の上の文字
    on_accent:str = "FFFFFF"   # アクセント地の上の文字

    # ---- フォント（1種 / §3-1） ----
    font:        str = "Yu Gothic"   # 游ゴシック。社内既定が違えばここを変える
    font_light:  str = "Yu Gothic Light"
    font_mono:   str = "Consolas"    # コード表示用の等幅（無い環境ではCourier New等にフォールバック）

    # ---- サイズ（pt） ----
    sz_kicker:   int = 14
    sz_headline: int = 30
    sz_col_title:int = 18
    sz_body:     int = 16
    sz_foot:     int = 11
    sz_stat:     int = 60   # KPIハイライト用の大数字

    def rgb(self, name: str) -> RGBColor:
        return hex_to_rgb(getattr(self, name))


# デフォルトテーマ（potx未提供時のフォールバック）
DEFAULT_THEME = Theme()
