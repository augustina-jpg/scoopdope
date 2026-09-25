#!/usr/bin/env bash
set -euo pipefail

PROFILE="${LOAD_PROFILE:-smoke}"
API_URL="${API_URL:-http://localhost:3000}"
RESULTS_DIR="${RESULTS_DIR:-load-test-results}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
JSON_PATH="$RESULTS_DIR/api-read-only-$PROFILE-$TIMESTAMP.json"
SUMMARY_PATH="$RESULTS_DIR/api-read-only-$PROFILE-$TIMESTAMP.txt"

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed or not available on PATH. See docs/load-testing.md." >&2
  exit 1
fi

mkdir -p "$RESULTS_DIR"
curl --fail --silent --show-error --max-time 10 "$API_URL/health/live" >/dev/null

K6_ARGS=(
  run
  --out "json=$JSON_PATH"
  --summary-export "$SUMMARY_PATH"
  --env "API_URL=$API_URL"
  --env "LOAD_PROFILE=$PROFILE"
  scripts/load-tests/api-read-only.js
)

if [[ "${INCLUDE_LEADERBOARD:-false}" == "true" ]]; then
  K6_ARGS+=(--env INCLUDE_LEADERBOARD=true)
fi

echo "Running k6 $PROFILE profile against $API_URL"
k6 "${K6_ARGS[@]}"
echo "Results written to $JSON_PATH"
echo "Summary written to $SUMMARY_PATH"
