"""
test_parser.py — parser.py（DSL → 内部データ構造）の単体テスト。

これまで parser.py に直接のユニットテストが無く、examples 経由の間接検証のみだった。
今回のバグ修正（予約キー vs インデントの優先順位／ブロック内複数値の取りこぼし）を
回帰させないための最小テストを追加する。
"""
from slidegen.parser import parse, split_emphasis


def test_split_emphasis_basic():
    runs = split_emphasis("月額を {35%} 削減")
    assert runs == [("月額を ", False), ("35%", True), (" 削減", False)]


def test_split_emphasis_no_emphasis():
    assert split_emphasis("プレーンテキスト") == [("プレーンテキスト", False)]


def test_multi_value_prop_creates_list_suffix():
    text = 'slide bar_chart\n  categories "Q1" "Q2" "Q3"\n'
    slide = parse(text)[0]
    assert slide.props["categories"] == "Q1"           # 先頭値は単数キーにも入る
    assert slide.props["categories_list"] == ["Q1", "Q2", "Q3"]


def test_single_value_prop_has_no_list_suffix():
    text = 'slide bar_chart\n  unit "百万円"\n'
    slide = parse(text)[0]
    assert slide.props["unit"] == "百万円"
    assert "unit_list" not in slide.props


def test_triple_dash_splits_multiple_slides():
    text = 'slide title\n  headline "A"\n---\nslide title\n  headline "B"\n'
    slides = parse(text)
    assert [s.props["headline"] for s in slides] == ["A", "B"]


def test_col_highlight_flag():
    text = 'slide waterfall\n  col "期初" highlight\n    "100"\n  col "新規"\n    "+40"\n'
    slide = parse(text)[0]
    assert slide.blocks[0].highlight is True
    assert slide.blocks[1].highlight is False


def test_block_row_with_label():
    text = 'slide kpi\n  col "実績"\n    売上 "120"\n    利益 "30"\n'
    block = parse(text)[0].blocks[0]
    assert block.rows == [("売上", "120"), ("利益", "30")]


def test_block_multiple_quoted_values_on_one_line_are_not_dropped():
    # 回帰テスト: かつては vals[0] しか拾わず、2つ目以降の値が黙って消えていた。
    text = 'slide journey_map\n  col "行動"\n    "広告で知る" "比較する" "申し込む"\n'
    block = parse(text)[0].blocks[0]
    assert block.lines == ["広告で知る", "比較する", "申し込む"]


def test_reserved_keyword_inside_block_is_treated_as_block_content():
    # 回帰テスト: ブロック配下で `source "..."` のような予約キー同名行が
    # スライド props に吸われず、ブロックの内容として扱われることを確認する。
    text = 'slide kpi\n  col "実績"\n    source "値"\n'
    slide = parse(text)[0]
    assert "source" not in slide.props
    block = slide.blocks[0]
    assert block.rows == [("source", "値")]


def test_reserved_keyword_at_top_level_still_sets_slide_prop():
    text = 'slide title\n  source "矢野経済研究所"\n'
    slide = parse(text)[0]
    assert slide.props["source"] == "矢野経済研究所"
