#!/usr/bin/env bash
# eia-workbench 스캐폴드 부트스트랩 스크립트.
# 원문은 docs/eia-workbench-setup-manual.md 부록 B 참조.
set -euo pipefail

PROJECT_NAME="${1:-eia-workbench}"
PARENT_DIR="${2:-/c/0_project}"

cd "$PARENT_DIR"
mkdir -p "$PROJECT_NAME" && cd "$PROJECT_NAME"

git init
git branch -M main

mkdir -p docs/plans docs/reviews docs/changelog docs/design
mkdir -p prompts/modules prompts/gs_sp
mkdir -p data/samples/public data/samples/private data/rules data/templates
mkdir -p scripts tests

touch README.md CLAUDE.md progress.md DESIGN.md
touch .gitignore .claudeignore .editorconfig
touch docs/00_project_brief.md
touch docs/changelog/session_log.md
touch prompts/00_project_context.md

echo "[ok] scaffold created at $(pwd)"
echo "[next] CLAUDE.md, progress.md, .gitignore, .claudeignore 내용을 이 매뉴얼에서 붙여넣으세요."
