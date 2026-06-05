#!/bin/bash
# ─────────────────────────────────────────
#  Kroket God — deploy naar Raspberry Pi
#  Gebruik: bash deploy.sh [hostname/IP]
#  Voorbeelden:
#    bash deploy.sh                    → keuzemenu
#    bash deploy.sh 192.168.178.80     → direct via IP
#    bash deploy.sh kroketpi           → via Tailscale
# ─────────────────────────────────────────

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Configuratie
LOKAAL_PAD="$(cd "$(dirname "$0")" && pwd)"
PI_USER="jspr"
PI_HOST="${1:-}"
PM2_NAAM="kroketgod"

# ── Bepaal hostname
if [[ -z "$PI_HOST" ]]; then
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║     Kroket God Deploy Script         ║"
  echo "╚══════════════════════════════════════╝"
  echo ""
  echo "Via welk netwerk verbind je?"
  echo "  1) Thuis (lokaal netwerk) → 192.168.178.80"
  echo "  2) Tailscale (overal)     → kroketpi"
  echo "  3) Handmatig invoeren"
  echo ""
  read -rp "Keuze [1/2/3]: " keuze
  case "$keuze" in
    1) PI_HOST="192.168.178.80" ;;
    2) PI_HOST="kroketpi" ;;
    3) read -rp "Hostname of IP: " PI_HOST ;;
    *) error "Ongeldige keuze." ;;
  esac
fi

echo ""
info "Verbinden met: ${PI_USER}@${PI_HOST}"

# ── Verbinding testen met duidelijke foutmelding
if ! ssh -o ConnectTimeout=6 -o BatchMode=yes "${PI_USER}@${PI_HOST}" "echo ok" &>/dev/null; then
  echo ""
  error "Kan niet verbinden met ${PI_HOST}.
  Mogelijke oorzaken:
    - Niet op het thuisnetwerk en Tailscale niet actief
    - Pi staat uit
    - Verkeerd IP of gebruikersnaam
  Probeer: ping ${PI_HOST}"
fi

info "SSH verbinding OK"

# ── nvm-omgeving: zet de nieuwste geïnstalleerde node-bin op PATH zodat node/npm/pm2 ook in
#    een NON-interactieve SSH-sessie vindbaar zijn. Dit was de oude bug: `which pm2` faalde en
#    `find` pikte een verkeerd 'pm2'-bestand (logrotate-template) → de bot werd nooit herstart.
NVM_SETUP='export PATH="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1):$PATH"'

# ── Verifieer dat pm2 nu bereikbaar is en bepaal het bot-pad
echo ""
info "pm2 en bot-pad zoeken op Pi..."
if ! ssh "${PI_USER}@${PI_HOST}" "${NVM_SETUP}; command -v pm2 >/dev/null 2>&1"; then
  error "pm2 niet gevonden op de Pi (ook niet via nvm). Is Node.js/pm2 geïnstalleerd?"
fi

PI_PAD=$(ssh "${PI_USER}@${PI_HOST}" "${NVM_SETUP}
  PAD=\$(pm2 list --no-color 2>/dev/null | grep -oE '/[^ ]+index\\.js' | head -1 | xargs dirname 2>/dev/null)
  [[ -z \"\$PAD\" ]] && PAD=\$(find /home -name 'index.js' -path '*kroket*' 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
  echo \"\${PAD:-/home/jspr/kroketgod}\"
")
[[ -z "$PI_PAD" ]] && PI_PAD="/home/jspr/kroketgod"

info "pm2: bereikbaar via nvm op PATH"
info "Bot: ${PI_PAD}"

# ── Bestanden kopiëren
echo ""
info "Bestanden uploaden..."

BESTANDEN=(
  "index.js"
  "tone_of_voice.txt"
  "geboden.txt"
  "gepanneerde_rijk.txt"
  "members.json"
  "kroketgod.png"
)

for bestand in "${BESTANDEN[@]}"; do
  lokaal="${LOKAAL_PAD}/${bestand}"
  if [[ -f "$lokaal" ]]; then
    scp -q "$lokaal" "${PI_USER}@${PI_HOST}:${PI_PAD}/${bestand}"
    info "  ${bestand}"
  else
    warn "  ${bestand} niet gevonden, overgeslagen"
  fi
done

# ── npm install
echo ""
info "Dependencies controleren..."
ssh "${PI_USER}@${PI_HOST}" "${NVM_SETUP}; cd '${PI_PAD}' && npm install --silent 2>&1 | tail -2"

# ── Bot herstarten
echo ""
info "Bot herstarten..."
ssh "${PI_USER}@${PI_HOST}" "${NVM_SETUP}
  pm2 restart ${PM2_NAAM} 2>/dev/null \
    || pm2 start '${PI_PAD}/index.js' --name ${PM2_NAAM}
  sleep 3
  pm2 save --force 2>/dev/null || true
  pm2 status ${PM2_NAAM} --no-color 2>&1 | tail -5
"

# ── Startup check: kijk of bot zonder fouten opstartte
echo ""
info "Opstartlog controleren..."
OPSTART=$(ssh "${PI_USER}@${PI_HOST}" "${NVM_SETUP}; pm2 logs ${PM2_NAAM} --lines 5 --nostream --no-color 2>/dev/null | grep -E 'wakker|Fout|Error|ECONNREFUSED' || true")
if echo "$OPSTART" | grep -q "wakker"; then
  info "Bot is succesvol opgestart ⚜️"
elif echo "$OPSTART" | grep -qiE "Fout|Error|ECONNREFUSED"; then
  warn "Mogelijke opstartfout gedetecteerd:"
  echo "$OPSTART"
else
  warn "Kon opstartbevestiging niet lezen — controleer logs handmatig"
fi

# ── Samenvatting
echo ""
echo "╔══════════════════════════════════════╗"
echo "║         Deploy geslaagd! ✓           ║"
echo "╚══════════════════════════════════════╝"
echo ""
info "Actieve functies:"
echo "   • Gemini 2.0 Flash afbeeldingen + Pollinations fallback"
echo "   • Gespreksgeheugen + context-aware sarcasme"
echo "   • Dagelijkse stemming (streng/genadig/filosofisch/...)"
echo "   • Weersverwachting met echt Amsterdams weer"
echo "   • Airfryer/magnetron detector"
echo "   • Vrijdag-streak tracking + aankondigingen"
echo "   • 11:30 reminder + 12:00 heilig moment"
echo "   • Gele kaarten systeem (escalerende bans)"
echo "   • Ban beroep (20% kans op genade)"
echo "   • 'eer naam1 en naam2' multi-naam support"
echo "   • Vergrijpentracking, achievements, TTS"
echo ""
info "Live logs:"
echo "   ssh ${PI_USER}@${PI_HOST} 'pm2 logs ${PM2_NAAM}'"
echo ""
info "Toekomstige deploys (ook via Tailscale):"
echo "   bash deploy.sh kroketpi"
echo ""
