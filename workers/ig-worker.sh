#!/usr/bin/env bash
#
# Oruva Instagram follow-bot worker.
#
# Two modes (run as separate cron jobs):
#   snapshot — refresh the cached @oruvatransportation follower list on the API
#              (every 30 min is plenty; the API serves claims from cache)
#   pending  — check queued bio-code ownership proofs and report results
#              (every 5 min; each check is one lightweight profile read)
#
# Environment (from $IG_WORKER_ENV, default ~/.config/oruva-ig-worker.env):
#   ORUVA_API_URL    e.g. https://apps-api-production-8edb.up.railway.app
#   ORUVA_ADMIN_KEY  shared secret for /api/instagram/admin/* (x-admin-key)
#
# The @oruvatransportation Instagram account must be linked to instagram-cli
# (via the Meta Accounts Center connect flow) before this can run.

set -euo pipefail

ENV_FILE="${IG_WORKER_ENV:-$HOME/.config/oruva-ig-worker.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
: "${ORUVA_API_URL:?ORUVA_API_URL is not set (see $ENV_FILE)}"
: "${ORUVA_ADMIN_KEY:?ORUVA_ADMIN_KEY is not set (see $ENV_FILE)}"

MODE="${1:?usage: ig-worker.sh snapshot|pending}"
API="$ORUVA_API_URL/api/instagram/admin"

ACCOUNTS_JSON="$(instagram-cli accounts 2>/dev/null || echo '{"accounts":[]}')"
ACCOUNT_ID="$(echo "$ACCOUNTS_JSON" | jq -r '.accounts[] | select(.username=="oruvatransportation") | .user_fbid // empty' 2>/dev/null | head -1)"
if [[ -z "$ACCOUNT_ID" ]]; then
  ACCOUNT_ID="$(echo "$ACCOUNTS_JSON" | jq -r '.accounts[0].user_fbid // empty' 2>/dev/null)"
fi
if [[ -z "$ACCOUNT_ID" ]]; then
  echo "ig-worker: no linked Instagram account (link @oruvatransportation first)" >&2
  exit 1
fi

api_post() { # $1=path $2=json-body
  curl -sS -m 60 -X POST "$API/$1" \
    -H "x-admin-key: $ORUVA_ADMIN_KEY" \
    -H "Content-Type: application/json" \
    --data "$2"
}

snapshot() {
  local usernames=() cursor="" page=0 resp has_more
  while (( page < 50 )); do
    if [[ -z "$cursor" ]]; then
      resp="$(instagram-cli followers --account-id "$ACCOUNT_ID" --count 200 2>/dev/null || true)"
    else
      resp="$(instagram-cli followers --account-id "$ACCOUNT_ID" --count 200 --after "$cursor" 2>/dev/null || true)"
    fi
    [[ -z "$resp" ]] && { echo "ig-worker: followers read failed" >&2; exit 1; }
    while IFS= read -r u; do
      [[ -n "$u" ]] && usernames+=("$u")
    done < <(echo "$resp" | jq -r '.users[]?.username // empty' 2>/dev/null)
    has_more="$(echo "$resp" | jq -r '.has_more // false' 2>/dev/null)"
    cursor="$(echo "$resp" | jq -r '.next_max_id // empty' 2>/dev/null)"
    page=$((page + 1))
    if [[ "$has_more" != "true" || -z "$cursor" ]]; then break; fi
  done
  local body
  body="$(printf '%s\n' "${usernames[@]}" | jq -R . | jq -s '{usernames: .}')"
  api_post "snapshot" "$body" | jq -c '{ok, count} // .'
  echo "ig-worker: snapshot pushed (${#usernames[@]} followers)"
}

pending() {
  local list count i xuser uname code bio ok reason res
  list="$(curl -sS -m 60 "$API/pending" -H "x-admin-key: $ORUVA_ADMIN_KEY")"
  count="$(echo "$list" | jq '.pending | length' 2>/dev/null || echo 0)"
  (( count == 0 )) && { echo "ig-worker: no pending bio checks"; return; }
  for (( i = 0; i < count; i++ )); do
    xuser="$(echo "$list" | jq -r ".pending[$i].xUserId")"
    uname="$(echo "$list" | jq -r ".pending[$i].username")"
    code="$(echo "$list" | jq -r ".pending[$i].code")"
    bio="$(instagram-cli user-profile --account-id "$ACCOUNT_ID" --username "$uname" 2>/dev/null \
      | jq -r '.profiles[0].bio // empty' 2>/dev/null || true)"
    if [[ -n "$bio" && "$bio" == *"$code"* ]]; then
      ok=true; reason="code_found_in_bio"
    else
      ok=false; reason="code_not_in_bio"
    fi
    local payload
    payload="$(jq -n --arg xUserId "$xuser" --argjson ok "$ok" --arg reason "$reason" \
      '{xUserId: $xUserId, ok: $ok, reason: $reason}')"
    res="$(api_post "verify-result" "$payload")"
    echo "ig-worker: bio check @$uname -> ok=$ok ($(echo "$res" | jq -r '.reason // .awarded // "?"'))"
  done
}

case "$MODE" in
  snapshot) snapshot ;;
  pending) pending ;;
  *) echo "usage: ig-worker.sh snapshot|pending" >&2; exit 2 ;;
esac
