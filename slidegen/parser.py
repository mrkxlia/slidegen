"""
parser.py — 中間記法(DSL) → 内部データ構造への変換（MNPの「パーサー」要素）。

記法の設計方針（設計ドキュメント §5-2 で試作・HTML検証済み）：
- インデント（2スペース）で階層を表す。
- 1行目が `slide <type>` で型を宣言。
- 以降 `key "value"` でプロパティ、`col "title" [highlight]` で要素ブロック。
- 強調は2手段のみ： col の `highlight` と、本文中の `{ }`。これ以外に装飾手段を作らない。
  → 装飾の暴走を構造的に封じる（§3 デザイン制約）。

AIはこの記法だけを書けばよい。座標・色・フォントは一切書かない（§2 責任分界）。

内部表現:
  Slide(type=str, props={kicker, headline, foot, ...}, blocks=[Block(...)])
  Block(title=str, highlight=bool, rows=[(label, value), ...], lines=[str,...])
"""
from __future__ import annotations
from dataclasses import dataclass, field
import re


@dataclass
class Block:
    title: str = ""
    highlight: bool = False
    rows: list = field(default_factory=list)   # [(label, value)]
    lines: list = field(default_factory=list)  # 箇条書き等、値だけの行


@dataclass
class Slide:
    type: str
    props: dict = field(default_factory=dict)
    blocks: list = field(default_factory=list)


_STR = re.compile(r'"([^"]*)"')


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _strings(s: str):
    return _STR.findall(s)


def parse(text: str) -> list[Slide]:
    """記法テキストを Slide のリストにパースする。複数スライドは `---` 区切り。"""
    slides = []
    for chunk in re.split(r'^\s*---\s*$', text, flags=re.MULTILINE):
        chunk = chunk.rstrip()
        if not chunk.strip():
            continue
        slides.append(_parse_one(chunk))
    return slides


def _parse_one(text: str) -> Slide:
    lines = [ln for ln in text.splitlines() if ln.strip() and not ln.strip().startswith("#")]
    if not lines:
        raise ValueError("空のスライド定義です")

    # 1行目: slide <type>
    head = lines[0].strip().split()
    if head[0] != "slide" or len(head) < 2:
        raise ValueError(f"スライドは 'slide <type>' で始める必要があります: {lines[0]!r}")
    slide = Slide(type=head[1])

    cur_block = None
    for ln in lines[1:]:
        ind = _indent(ln)
        s = ln.strip()
        key = s.split()[0] if s.split() else ""

        if key == "col":
            # col "タイトル" [highlight]
            title = _strings(s)
            cur_block = Block(
                title=title[0] if title else "",
                highlight=("highlight" in s.split()),
            )
            slide.blocks.append(cur_block)
        elif ind >= 4 and cur_block is not None:
            # ブロック配下の行： `ラベル "値"`、`"値1" "値2" ...`（箇条書き）、または `"値"`。
            # kicker/title 等の予約キーと同名でも、ブロック内では常にブロックの内容として扱う
            # （予約キー判定をここより先に行うと、ブロック内の同名行がスライド props に吸われてしまう）。
            vals = _strings(s)
            if len(vals) >= 1 and not s.startswith('"'):
                label = s.split('"')[0].strip()
                cur_block.rows.append((label, vals[0]))
            elif vals:
                cur_block.lines.extend(vals)
            else:
                cur_block.lines.append(s)
        elif key in ("kicker", "headline", "foot", "title", "subtitle", "source"):
            vals = _strings(s)
            slide.props[key] = vals[0] if vals else s[len(key):].strip()
        else:
            # トップレベルのその他プロパティ： `key "値"` または `key "v1" "v2" ...`
            vals = _strings(s)
            if vals:
                # 複数値なら最初を文字列、全体を <key>_list にも保持（多値プロパティ用）
                slide.props[key] = vals[0]
                if len(vals) > 1:
                    slide.props[key + "_list"] = vals
    return slide


# 本文の {強調} を (テキスト, 強調フラグ) のランに分解
_EM = re.compile(r'\{([^}]+)\}')

def split_emphasis(text: str):
    """ '月額を {35%} 削減' -> [('月額を ',False),('35%',True),(' 削減',False)] """
    runs, last = [], 0
    for m in _EM.finditer(text):
        if m.start() > last:
            runs.append((text[last:m.start()], False))
        runs.append((m.group(1), True))
        last = m.end()
    if last < len(text):
        runs.append((text[last:], False))
    return runs or [(text, False)]
