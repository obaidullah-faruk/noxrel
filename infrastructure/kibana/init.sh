#!/bin/sh
set -e

KIBANA="http://kibana:5601"
AUTH="elastic:${ELASTIC_PASSWORD}"

# ── 1. Data view ─────────────────────────────────────────────────────────────
echo "Creating Platform Logs data view..."
DV_RESP=$(curl -sf -u "$AUTH" -X POST "$KIBANA/api/data_views/data_view" \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d @/kibana/data_view.json 2>/dev/null || true)

DATA_VIEW_ID=$(echo "$DV_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$DATA_VIEW_ID" ]; then
  echo "Data view already exists — fetching existing id..."
  LIST_RESP=$(curl -sf -u "$AUTH" "$KIBANA/api/data_views" -H 'kbn-xsrf: true' 2>/dev/null || true)
  DATA_VIEW_ID=$(echo "$LIST_RESP" | grep -o '"id":"[^"]*"' | grep -A1 'platform-logs' | head -1 | cut -d'"' -f4)
  # fallback: grab id of second entry (first is APM) if grep above is empty
  if [ -z "$DATA_VIEW_ID" ]; then
    DATA_VIEW_ID=$(echo "$LIST_RESP" | grep -o '"id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4)
  fi
fi

if [ -z "$DATA_VIEW_ID" ]; then
  echo "ERROR: could not determine data view id — aborting."
  exit 1
fi
echo "Data view id: $DATA_VIEW_ID"

# ── 2. Dashboard ──────────────────────────────────────────────────────────────
echo "Creating Platform Logs dashboard..."

# Substitute the data view id placeholder then POST
sed "s/__DATA_VIEW_ID__/$DATA_VIEW_ID/g" /kibana/dashboard.json > /tmp/dashboard_resolved.json

DASH_RESP=$(curl -sf -u "$AUTH" -X POST "$KIBANA/api/saved_objects/dashboard" \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d @/tmp/dashboard_resolved.json 2>/dev/null || true)

echo "$DASH_RESP" | grep -q '"id"' \
  && echo "Dashboard created." \
  || echo "Dashboard already exists or creation failed — $DASH_RESP"
