#!/bin/bash
# Gebruik: bash pi.sh pull        — haal alle codebestanden van de Pi
#          bash pi.sh push        — stuur gewijzigde bestanden naar Pi + herstart
#          bash pi.sh restart     — alleen herstarten
#          bash pi.sh logs        — live logs bekijken

PI="jspr@kroketpi"
PAD="/home/jspr/kroketgod"
PM2="source ~/.nvm/nvm.sh && pm2 restart kroketgod"
DIR="$(cd "$(dirname "$0")" && pwd)"

BESTANDEN=(index.js tone_of_voice.txt geboden.txt gepanneerde_rijk.txt members.json)

case "$1" in
  pull)
    echo "⬇️  Pull van Pi..."
    for f in "${BESTANDEN[@]}"; do
      scp -q "$PI:$PAD/$f" "$DIR/$f" && echo "   ✓ $f"
    done
    echo "Klaar."
    ;;
  push)
    echo "⬆️  Push naar Pi..."
    for f in "${BESTANDEN[@]}"; do
      [ -f "$DIR/$f" ] && scp -q "$DIR/$f" "$PI:$PAD/$f" && echo "   ✓ $f"
    done
    ssh "$PI" "bash -lc '$PM2'" 2>/dev/null | grep -E "✓|online|wakker" || true
    echo "⚜️  Bot herstart."
    ;;
  restart)
    ssh "$PI" "bash -lc '$PM2'" 2>/dev/null | grep -E "✓|online" || true
    echo "⚜️  Bot herstart."
    ;;
  logs)
    ssh "$PI" "bash -lc 'source ~/.nvm/nvm.sh && pm2 logs kroketgod --lines 50'"
    ;;
  *)
    echo "Gebruik: bash pi.sh [pull|push|restart|logs]"
    ;;
esac
