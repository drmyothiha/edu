#!/bin/bash
set -euo pipefail

# Configuration
CLOUD_SSH_HOST="mth@34.21.230.33"
CLOUD_DIR="/home/mth/edu/"
LOCAL_DIR="/Users/drmyothiha/Documents/edu/edu/"
MAC_USER="drmyothiha"

# Common rsync exclusions to keep build artifacts and secrets intact
EXCLUDES=(
  --exclude 'node_modules'
  --exclude 'tmp'
  --exclude 'bin'
  --exclude '.DS_Store'
  --exclude '.env'
)

OS_TYPE=$(uname -s)

if [ "$OS_TYPE" = "Darwin" ] || [ -d "$LOCAL_DIR" ]; then
  echo "🚀 [Local Mac] Initiating two-way sync with Cloud ($CLOUD_SSH_HOST)..."
  
  echo "📥 1/2 Pulling newer edits from Cloud to Local..."
  rsync -avu "${EXCLUDES[@]}" "$CLOUD_SSH_HOST:$CLOUD_DIR" "$LOCAL_DIR"
  
  echo "📤 2/2 Pushing newer edits from Local to Cloud..."
  rsync -avu "${EXCLUDES[@]}" "$LOCAL_DIR" "$CLOUD_SSH_HOST:$CLOUD_DIR"
  
  echo "✅ Two-way sync complete! Local and Cloud are in sync."

else
  echo "☁️  [Cloud VM] Initiating two-way sync with Local Mac..."
  
  # Check if reverse SSH tunnel on port 2222 is active
  if timeout 1 bash -c "</dev/tcp/127.0.0.1/2222" 2>/dev/null; then
    SSH_OPTS="ssh -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    
    echo "📥 1/2 Pulling newer edits from Mac to Cloud..."
    rsync -avu -e "$SSH_OPTS" "${EXCLUDES[@]}" "$MAC_USER@127.0.0.1:$LOCAL_DIR" "$CLOUD_DIR"
    
    echo "📤 2/2 Pushing newer edits from Cloud to Mac..."
    rsync -avu -e "$SSH_OPTS" "${EXCLUDES[@]}" "$CLOUD_DIR" "$MAC_USER@127.0.0.1:$LOCAL_DIR"
    
    echo "✅ Two-way sync complete! Cloud and Local are in sync."
  else
    echo "⚠️  Reverse SSH tunnel (port 2222) is not active in this session."
    echo "💡 You can simply run 'make sync' on your Mac terminal anytime,"
    echo "   or connect from your Mac using: ssh mth@34.21.230.33 (which forwards port 2222)."
  fi
fi
