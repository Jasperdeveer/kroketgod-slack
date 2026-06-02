#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Kroket God — eenmalige volledige setup + deploy
#  Voer dit uit als je voor het eerst thuis bent na alle updates
#  Daarna: gebruik deploy.sh voor toekomstige updates
# ─────────────────────────────────────────────────────────────

set -e

PI_USER="jspr"
PI_HOST="192.168.178.80"
PI="${PI_USER}@${PI_HOST}"
BOT_PAD="/home/jspr/kroketgod"
LOKAAL="$(cd "$(dirname "$0")" && pwd)"
PM2="/home/jspr/.nvm/versions/node/v20.20.2/bin/pm2"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Kroket God — Volledige Setup + Deploy  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Verbinding testen
info "Verbinding testen met Pi..."
ssh -o ConnectTimeout=5 -o BatchMode=yes "$PI" "echo ok" > /dev/null \
  || error "Kan niet verbinden met $PI. Controleer of je op het thuisnetwerk zit."
info "Verbinding OK"

# ── 2. Bestanden kopiëren
echo ""
info "Bestanden kopiëren..."
scp -q "$LOKAAL/index.js"              "$PI:$BOT_PAD/index.js"
info "  index.js (alle nieuwe functies)"
scp -q "$LOKAAL/tone_of_voice.txt"     "$PI:$BOT_PAD/tone_of_voice.txt"
info "  tone_of_voice.txt"
scp -q "$LOKAAL/geboden.txt"           "$PI:$BOT_PAD/geboden.txt"
info "  geboden.txt"
scp -q "$LOKAAL/setup-tailscale-pi.sh" "$PI:~/setup-tailscale-pi.sh"
info "  setup-tailscale-pi.sh"

# ── 3. npm install
echo ""
info "Dependencies controleren..."
ssh "$PI" "cd $BOT_PAD && npm install --silent 2>&1 | tail -2"

# ── 4. Tailscale installeren + cron instellen + bot herstarten
echo ""
info "Tailscale setup starten op Pi..."
echo "   (Je krijgt een URL te zien — open die op je telefoon of laptop)"
echo ""
ssh -t "$PI" "bash ~/setup-tailscale-pi.sh"

# ── 5. Bevestiging
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║           Alles klaar! ✓                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
info "Wat er nu actief is:"
echo "   ✓ index.js met alle nieuwe functies"
echo "   ✓ Weerdata (open-meteo Amsterdam)"
echo "   ✓ Airfryer/magnetron detector"
echo "   ✓ Vrijdag-streak tracking"
echo "   ✓ Gele kaarten systeem"
echo "   ✓ 'eer naam1 en naam2' ondersteuning"
echo "   ✓ Tailscale (SSH van overal)"
echo "   ✓ Nachtelijke cron (03:00 restart, maandag 03:30 npm)"
echo ""
info "Vanaf nu SSH'en van overal:"
echo "   ssh jspr@kroketpi"
echo ""
info "Toekomstige updates deployen:"
echo "   bash deploy.sh"
echo ""
