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
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from pptx.util import Pt
from pptx.dml.color import RGBColor
from pptx.oxml.ns import qn

if TYPE_CHECKING:
    from pptx.presentation import Presentation

_log = logging.getLogger(__name__)


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


# potx テーマ → Theme のスロット対応（§2-bis ルール3）。
# ブランド色は一般的な OOXML スロットから引く。企業テンプレによっては強調色が
# lt2 等の別スロットに入ることがある（例: 特定社の potx はブランドレッドが lt2）。
# その場合はここを差し替えるだけで対応できる。読めなければ DEFAULT_THEME にフォールバック。
_POTX_SLOTS = {
    "main":   "a:accent1",
    "main_2": "a:accent2",
    "accent": "a:accent6",   # ブランド強調色の一般的スロット
}

# theme part を指すリレーションシップ種別
_THEME_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"


def _is_valid_hex(val: str) -> bool:
    return len(val) == 6 and all(c in "0123456789ABCDEF" for c in val)


def theme_from_potx(prs: "Presentation") -> "Theme":
    """POTX/PPTX のテーマから brand 色（main/main_2/accent）を読み取り Theme を生成する。

    読み取れないフィールドは DEFAULT_THEME の値でフォールバックする（フェイルセーフ）。
    先頭スライドマスターのテーマのみ参照する。背景色（base/base_2）と文字色（ink）は
    可読性優先で DEFAULT_THEME を固定使用する。スロット対応は _POTX_SLOTS を参照。
    """
    d = DEFAULT_THEME
    try:
        master = prs.slide_masters[0]
        theme_part = master.part.part_related_by(_THEME_REL)
        from lxml import etree as _etree
        theme_el = _etree.fromstring(theme_part.blob)
        clr_scheme = theme_el.find(".//" + qn("a:clrScheme"))
        if clr_scheme is None:
            return d

        def pick(tag: str):
            el = clr_scheme.find(qn(tag))
            if el is None:
                return None
            srgb = el.find(qn("a:srgbClr"))
            if srgb is not None:
                val = (srgb.get("val") or "").upper()
                if _is_valid_hex(val):
                    return val
            sys_el = el.find(qn("a:sysClr"))
            if sys_el is not None:
                val = (sys_el.get("lastClr") or "").upper()
                if _is_valid_hex(val):
                    return val
            return None

        extracted = {name: pick(slot) for name, slot in _POTX_SLOTS.items()}
        _log.debug("POTX テーマカラー抽出: %s", extracted)
        return Theme(
            main   = extracted["main"]   or d.main,
            main_2 = extracted["main_2"] or d.main_2,
            accent = extracted["accent"] or d.accent,
        )
    except (KeyError, AttributeError, ValueError, IndexError) as e:
        _log.warning(
            "POTX テーマカラーの抽出に失敗しました（%s）。DEFAULT_THEME を使用します。", e
        )
        return d
