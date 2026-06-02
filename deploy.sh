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

# ── Auto-detecteer pm2 en bot-pad op de Pi
echo ""
info "Bot-locatie zoeken op Pi..."
PI_INFO=$(ssh "${PI_USER}@${PI_HOST}" "
  # Zoek pm2 binary
  PM2=\$(which pm2 2>/dev/null || find /home -name pm2 -type f 2>/dev/null | head -1 || echo '')

  # Zoek bot-pad via pm2 of filesystem
  PAD=''
  if [[ -n \"\$PM2\" ]]; then
    PAD=\$(\$PM2 list --no-color 2>/dev/null | grep -oE '/[^ ]+index\\.js' | head -1 | xargs dirname 2>/dev/null || echo '')
  fi
  if [[ -z \"\$PAD\" ]]; then
    PAD=\$(find /home -name 'index.js' -path '*kroket*' 2>/dev/null | head -1 | xargs dirname 2>/dev/null || echo '/home/jspr/kroketgod')
  fi
  echo \"\$PM2|\$PAD\"
")

PM2_BIN=$(echo "$PI_INFO" | cut -d'|' -f1)
PI_PAD=$(echo "$PI_INFO" | cut -d'|' -f2)

[[ -z "$PM2_BIN" ]] && error "pm2 niet gevonden op de Pi. Is Node.js geïnstalleerd?"
[[ -z "$PI_PAD" ]] && error "Bot-pad niet gevonden op de Pi."

info "pm2: ${PM2_BIN}"
info "Bot: ${PI_PAD}"

# ── Bestanden kopiëren
echo ""
info "Bestanden uploaden..."

BESTANDEN=(
  "index.js"
  "tone_of_voice.txt"
  "geboden.txt"
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
ssh "${PI_USER}@${PI_HOST}" "cd '${PI_PAD}' && npm install --silent 2>&1 | tail -2"

# ── Bot herstarten
echo ""
info "Bot herstarten..."
ssh "${PI_USER}@${PI_HOST}" "
  ${PM2_BIN} restart ${PM2_NAAM} 2>/dev/null \
    || ${PM2_BIN} start '${PI_PAD}/index.js' --name ${PM2_NAAM}
  sleep 3
  ${PM2_BIN} save --force 2>/dev/null || true
  ${PM2_BIN} status ${PM2_NAAM} --no-color 2>&1 | tail -5
"

# ── Startup check: kijk of bot zonder fouten opstartte
echo ""
info "Opstartlog controleren..."
OPSTART=$(ssh "${PI_USER}@${PI_HOST}" "${PM2_BIN} logs ${PM2_NAAM} --lines 5 --nostream --no-color 2>/dev/null | grep -E 'wakker|Fout|Error|ECONNREFUSED' || true")
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
echo "   ssh ${PI_USER}@${PI_HOST} '${PM2_BIN} logs ${PM2_NAAM}'"
echo ""
info "Toekomstige deploys (ook via Tailscale):"
echo "   bash deploy.sh kroketpi"
echo ""
