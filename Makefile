# slidegen Makefile — テスト駆動で型を増やすときのショートカット
# 社内 Claude Code は基本これだけ覚えればよい

.PHONY: test visual all clean help snapshot-update

# 第1層：構造インバリアントの自動テスト（pytest）
test:
	uv run --extra dev python -m pytest tests/test_invariants.py -v

# 第2層(自動)：全型の図形ツリー・スナップショットを golden として再生成する
# （意図した見た目変更や新型追加のあとに実行し、差分をコミットする）
snapshot-update:
	SLIDEGEN_UPDATE_SNAPSHOTS=1 uv run --extra dev python -m pytest tests/test_visual_regression.py -q

# 第2層：全サンプルのモンタージュを生成（目視確認用）
visual:
	@mkdir -p out
	@for f in examples/*.slide; do \
		name=$$(basename $$f .slide); \
		echo "▶ $$name"; \
		uv run --extra dev python tools/visual.py $$f -o out/$$name.jpg; \
	done

# 全部：第1層→第2層
all: test visual

# 新型追加（使い方: make new TYPE=mytype INTENT="..." LAYOUT=grid COUNT="3..6"）
new:
	uv run --extra dev python tools/new_type.py $(TYPE) --intent "$(INTENT)" --layout $(LAYOUT) --count "$(COUNT)"

# 新型検証（使い方: make check TYPE=mytype）
check:
	uv run --extra dev python tools/new_type.py $(TYPE) --check

clean:
	rm -rf out build dist *.egg-info __pycache__ */__pycache__ */*/__pycache__

help:
	@echo "make test         - 第1層: pytestで構造インバリアントを確認"
	@echo "make visual       - 第2層: 全サンプルのモンタージュをoutに生成"
	@echo "make all          - 第1層+第2層"
	@echo "make new TYPE=mytype INTENT=\"...\" LAYOUT=grid COUNT=\"3..6\""
	@echo "                  - 新型の雛形を生成"
	@echo "make check TYPE=mytype"
	@echo "                  - 新型の検証（pytest+モンタージュ）"
	@echo "make snapshot-update - 第2層(自動): 図形ツリーの golden を再生成（見た目変更/新型後）"
