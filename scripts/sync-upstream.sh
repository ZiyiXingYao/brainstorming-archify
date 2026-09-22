#!/usr/bin/env bash
# sync-upstream.sh — show what changed in superpowers' brainstorming SKILL.md
#
# This skill is a modified copy of superpowers' brainstorming skill. When
# upstream changes, run this script to see the diff, then re-apply the
# intended deviations (see the "同步上游" section in README.md).
#
# Usage:
#   ./sync-upstream.sh                 # compare against upstream default branch
#   ./sync-upstream.sh --ref v6.3.0    # compare against a specific tag/branch
#
# Requires: git

set -euo pipefail

UPSTREAM_REPO="${UPSTREAM_REPO:-https://github.com/obra/superpowers.git}"
UPSTREAM_PATH="skills/brainstorming/SKILL.md"
REF="default"

usage() {
  sed -n '2,12p' "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# 本脚本位于 <仓库根>/scripts/，技能文档位于 <仓库根>/skill/SKILL.md。
LOCAL="$SCRIPT_DIR/../skill/SKILL.md"

if [[ ! -f "$LOCAL" ]]; then
  echo "ERROR: $LOCAL not found" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching $UPSTREAM_REPO ..."
git clone --quiet --depth 1 "$UPSTREAM_REPO" "$TMP/upstream"

if [[ "$REF" != "default" ]]; then
  echo "Checking out ref: $REF"
  git -C "$TMP/upstream" fetch --quiet --depth 1 origin "$REF"
  git -C "$TMP/upstream" checkout --quiet --detach FETCH_HEAD
fi

UPSTREAM="$TMP/upstream/$UPSTREAM_PATH"
if [[ ! -f "$UPSTREAM" ]]; then
  echo "ERROR: $UPSTREAM_PATH not found upstream" >&2
  exit 1
fi

UPSTREAM_SHA="$(git -C "$TMP/upstream" rev-parse --short HEAD)"
UPSTREAM_SUBJECT="$(git -C "$TMP/upstream" log -1 --format=%s)"
UPSTREAM_DESC="$(git -C "$TMP/upstream" describe --tags --always 2>/dev/null || echo "unknown")"

echo
echo "Upstream: $UPSTREAM_REPO"
echo "  describe: $UPSTREAM_DESC"
echo "  commit:   $UPSTREAM_SHA ($UPSTREAM_SUBJECT)"
echo "  path:     $UPSTREAM_PATH"
echo
echo "===== diff (upstream -> local SKILL.md) ====="
diff -u "$UPSTREAM" "$LOCAL" || true
echo "===== end of diff ====="
echo
echo "Next: if upstream changed, re-apply the intended deviations on top of it."
echo "See the \"同步上游\" section in README.md for the list of deviations."
