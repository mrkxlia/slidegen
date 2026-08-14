"""slidegen — 記法(DSL)から編集可能なpptxを生成するパッケージ。"""
from .parser import parse, Slide, Block
from .render import build
from . import render_more       # noqa: F401  追加型を登録
from . import render_relations  # noqa: F401  39パターン由来の関係図系の型を登録
from . import render_base_labeled  # noqa: F401  基底レイアウト labeled_blocks + variant 群
from . import render_base_split  # noqa: F401  基底レイアウト split_layout + variant 群
from . import render_base_grid  # noqa: F401  基底レイアウト grid_2d + variant 群
from . import render_base_nodes  # noqa: F401  基底レイアウト nodes_and_connectors + variant 群
from . import render_base_hero  # noqa: F401  基底レイアウト hero_canvas + variant 群
from . import render_base_columns  # noqa: F401  基底レイアウト columns_with_header + variant 群
from . import render_base_band  # noqa: F401  基底レイアウト band_strip + variant 群
from . import render_base_curve  # noqa: F401  基底レイアウト narrative_curve + variant 群
from . import render_base_framed  # noqa: F401  基底レイアウト framed_canvas + variant 群
from . import render_charts  # noqa: F401  ネイティブチャート型（棒/折れ線/積み上げ等）
from . import render_charts_shapes  # noqa: F401  図形描画チャート型（bullet/funnel/football_field等）
from . import render_frameworks  # noqa: F401  ビジネスフレーム型（swot/venn2）
from . import render_data_support  # noqa: F401  データ補助型（data_source_footer/waterfall）
from . import render_tech  # noqa: F401  技術系型（code_block/terminal/api_endpoint_table）
from . import render_frameworks2  # noqa: F401  ビジネスフレーム第2弾（bmc/journey_map/pricing_tiers）
from .theme import Theme, DEFAULT_THEME
from .api import render_text, render_to_bytes, render_file  # バックエンド用 public API

__all__ = [
    "parse", "build", "Slide", "Block", "Theme", "DEFAULT_THEME",
    "render_text", "render_to_bytes", "render_file",
]
