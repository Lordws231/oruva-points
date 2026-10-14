#!/usr/bin/env bash
#
# Oruva social follow-verification bot worker (Threads + LinkedIn).
# Instagram keeps its own worker (workers/ig-worker.sh); Facebook is
# verified live by the API via the Graph API and needs no worker.
#
# Modes:
#   threads-snapshot — refresh the cached @oruvatransport Threads follower
#                      list on the API (every ~30 min)
#   threads-pending  — check queued Threads bio-code proofs and report
#                      results (every ~5 min)
#   linkedin-pending — list queued LinkedIn claims for the founder to check
#                      against his own LinkedIn follower list + the code in
#                      each claimant's About section (LinkedIn has no API
#                      for individual follows — see docs/VERIFICATION_BOT.md)
#   linkedin-verify <xUserId> <true|false> [taskId] — submit the founder's verdict
#                      for a queued LinkedIn claim (points award on true)
#
# Environment (from $SOCIAL_WORKER_ENV, default ~/.config/oruva-social-worker.env):
#   ORUVA_API_URL    e.g. https://apps-api-production-8edb.up.railway.app
#   ORUVA_ADMIN_KEY  shared secret for /api/social/admin/* (x-admin-key)
#
# The @oruvatransport Threads account must be linked to threads-cli
# (Meta Accounts Center) before the Threads modes can run.

set -euo pipefail

ENV_FILE="${SOCIAL_WORKER_ENV:-$HOME/.config/oruva-social-worker.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
: "${ORUVA_API_URL:?ORUVA_API_URL is not set (see $ENV_FILE)}"
: "${ORUVA_ADMIN_KEY:?ORUVA_ADMIN_KEY is not set (see $ENV_FILE)}"

MODE="${1:?usage: social-worker.sh threads-snapshot|threads-pending|linkedin-pending|linkedin-verify <xUserId> <true|false> [taskId]}"
API="$ORUVA_API_URL/api/social/admin"

api_post() { # $1=path $2=json-body
  curl -sS -m 60 -X POST "$API/$1" \
    -H "x-admin-key: $ORUVA_ADMIN_KEY" \
    -H "Content-Type: application/json" \
    --data "$2"
}

threads_account() {
  local accounts_json
  accounts_json="$(threads-cli accounts 2>/dev/null || echo '{"accounts":[]}')"
  local id
  id="$(echo "$accounts_json" | jq -r '.accounts[] | select((.username // "" | ascii_downcase)=="oruvatransport") | .id // .user_fbid // empty' 2>/dev/null | head -1)"
  if [[ -z "$id" ]]; then
    id="$(echo "$accounts_json" | jq -r '.accounts[0].id // .accounts[0].user_fbid // empty' 2>/dev/null)"
  fi
  if [[ -z "$id" ]]; then
    echo "social-worker: no linked Threads account (link @oruvatransport first)" >&2
    exit 1
  fi
  echo "$id"
}

threads_snapshot() {
  local account_id self_id entries='[]' cursor="" page=0 resp has_next
  account_id="$(threads_account)"
  # The linked account IS @oruvatransport: its own profile gives its user id.
  self_id="$(threads-cli profile --account-id "$account_id" 2>/dev/null \
    | jq -r '.id // .user_id // .user.id // empty' 2>/dev/null | head -1)"
  if [[ -z "$self_id" ]]; then
    echo "social-worker: could not resolve @oruvatransport Threads user id" >&2
    exit 1
  fi
  while (( page < 100 )); do
    if [[ -z "$cursor" ]]; then
      resp="$(threads-cli followers --account-id "$account_id" --user-id "$self_id" --first 50 2>/dev/null || true)"
    else
      resp="$(threads-cli followers --account-id "$account_id" --user-id "$self_id" --first 50 --after "$cursor" 2>/dev/null || true)"
    fi
    [[ -z "$resp" ]] && { echo "social-worker: followers read failed" >&2; exit 1; }
    entries="$(echo "$entries" "$resp" | jq -s '
      .[0] + [ .[1] | (.users // .followers // .data // [])[]
               | {username: (.username // empty),
                  providerUserId: ((.id // .user_id // "") | tostring)} ]
      | unique_by(.username)')"
    has_next="$(echo "$resp" | jq -r '.has_next_page // .has_more // false' 2>/dev/null)"
    cursor="$(echo "$resp" | jq -r '.next_cursor // .next_max_id // empty' 2>/dev/null)"
    page=$((page + 1))
    if [[ "$has_next" != "true" || -z "$cursor" ]]; then break; fi
  done
  local body
  body="$(jq -n --argjson entries "$entries" '{provider: "threads", entries: $entries}')"
  api_post "snapshot" "$body" | jq -c '{ok, count} // .'
  echo "social-worker: threads snapshot pushed ($(echo "$entries" | jq 'length') followers)"
}

threads_pending() {
  local list count i xuser task uname uid code bio ok reason payload res
  list="$(curl -sS -m 60 "$API/pending?provider=threads" -H "x-admin-key: $ORUVA_ADMIN_KEY")"
  count="$(echo "$list" | jq '.pending | length' 2>/dev/null || echo 0)"
  (( count == 0 )) && { echo "social-worker: no pending Threads checks"; return; }
  local account_id
  account_id="$(threads_account)"
  for (( i = 0; i < count; i++ )); do
    xuser="$(echo "$list" | jq -r ".pending[$i].xUserId")"
    task="$(echo "$list" | jq -r ".pending[$i].taskId")"
    uname="$(echo "$list" | jq -r ".pending[$i].username")"
    uid="$(echo "$list" | jq -r ".pending[$i].providerUserId // empty")"
    code="$(echo "$list" | jq -r ".pending[$i].code")"
    bio=""
    if [[ -n "$uid" ]]; then
      bio="$(threads-cli user-profile --account-id "$account_id" --user-id "$uid" 2>/dev/null \
        | jq -r '.biography // .bio // .profiles[0].biography // .profiles[0].bio // empty' 2>/dev/null || true)"
    fi
    if [[ -n "$bio" && "$bio" == *"$code"* ]]; then
      ok=true; reason="code_found_in_bio"
    else
      ok=false; reason="code_not_in_bio"
    fi
    payload="$(jq -n --arg xUserId "$xuser" --arg taskId "$task" --argjson ok "$ok" --arg reason "$reason" \
      '{xUserId: $xUserId, taskId: $taskId, ok: $ok, reason: $reason}')"
    res="$(api_post "verify-result" "$payload")"
    echo "social-worker: threads bio check @$uname -> ok=$ok ($(echo "$res" | jq -r '.reason // .awarded // "?"'))"
  done
}

linkedin_pending() {
  local list count
  list="$(curl -sS -m 60 "$API/pending?provider=linkedin" -H "x-admin-key: $ORUVA_ADMIN_KEY")"
  count="$(echo "$list" | jq '.pending | length' 2>/dev/null || echo 0)"
  echo "Pending LinkedIn claims: $count"
  echo "For each one: open the profile, confirm (1) they follow the target"
  echo "(founder profile, or the Oruva company Page for FOLLOW_ORUVA_LINKEDIN —"
  echo "check the Page admin follower list) and (2) the code is in their"
  echo "About section, then run:"
  echo "  social-worker.sh linkedin-verify <xUserId> true|false <taskId>"
  echo "$list" | jq -r '.pending[] | "\(.xUserId)\t\(.taskId)\tlinkedin.com/in/\(.username)\tcode: \(.code)"'
}

linkedin_verify() {
  local xuser="${2:?usage: linkedin-verify <xUserId> <true|false> [taskId]}"
  local ok="${3:?usage: linkedin-verify <xUserId> <true|false> [taskId]}"
  local task="${4:-FOLLOW_FOUNDER_LINKEDIN}"
  [[ "$ok" == "true" || "$ok" == "false" ]] || { echo "third arg must be true|false" >&2; exit 2; }
  local payload res
  payload="$(jq -n --arg xUserId "$xuser" --arg taskId "$task" --argjson ok "$ok" \
    '{xUserId: $xUserId, taskId: $taskId, ok: $ok, reason: "follower_list_and_about_code_checked"}')"
  res="$(api_post "verify-result" "$payload")"
  echo "$res" | jq -c '.'
}

case "$MODE" in
  threads-snapshot) threads_snapshot ;;
  threads-pending) threads_pending ;;
  linkedin-pending) linkedin_pending ;;
  linkedin-verify) linkedin_verify "$@" ;;
  *) echo "usage: social-worker.sh threads-snapshot|threads-pending|linkedin-pending|linkedin-verify <xUserId> <true|false> [taskId]" >&2; exit 2 ;;
esac
