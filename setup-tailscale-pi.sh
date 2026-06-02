#!/bin/bash
# ─────────────────────────────────────────
#  Tailscale setup voor Raspberry Pi
#  Uitvoeren op de Pi: bash setup-tailscale-pi.sh
# ─────────────────────────────────────────

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Tailscale setup — Kroket Pi      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Controleer of we op een Pi draaien
if ! uname -m | grep -qE 'arm|aarch'; then
  warn "Dit lijkt geen ARM-machine (Pi). Doorgaan toch? [j/N]"
  read -r antwoord
  [[ "$antwoord" =~ ^[jJ]$ ]] || error "Gestopt."
fi

# ── 2. Update package list
info "Pakketlijst bijwerken..."
sudo apt-get update -qq

# ── 3. Installeer Tailscale via officieel script
if command -v tailscale &>/dev/null; then
  info "Tailscale is al geïnstalleerd ($(tailscale version | head -1))"
else
  info "Tailscale installeren..."
  curl -fsSL https://tailscale.com/install.sh | sh
  info "Tailscale geïnstalleerd."
fi

# ── 4. Zorg dat de service actief is
info "Tailscale service starten..."
sudo systemctl enable --now tailscaled
sleep 2

# ── 5. Verbind met Tailscale netwerk
if tailscale status &>/dev/null 2>&1; then
  info "Tailscale is al verbonden."
  tailscale status
else
  echo ""
  warn "Je moet nu inloggen met je Tailscale account."
  warn "Er verschijnt een URL — open die op je telefoon of laptop."
  echo ""
  sudo tailscale up --accept-routes
fi

# ── 6. Stel hostname in
HUIDIGE_NAAM=$(hostname)
echo ""
echo "Huidige Pi-naam: ${HUIDIGE_NAAM}"
echo "Wil je een andere naam instellen? (bijv. 'kroketpi') [leeg = overslaan]"
read -r NIEUWE_NAAM
if [[ -n "$NIEUWE_NAAM" ]]; then
  sudo hostnamectl set-hostname "$NIEUWE_NAAM"
  sudo tailscale set --hostname "$NIEUWE_NAAM"
  info "Hostname ingesteld op: $NIEUWE_NAAM"
fi

# ── 7. Zet SSH open in firewall (als ufw actief is)
if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
  sudo ufw allow ssh
  info "SSH toegestaan in firewall."
fi

# ── 8. Kroket God bot herstarten
echo ""
echo "── Bot herstarten ──────────────────────"
if command -v pm2 &>/dev/null; then
  BOT_NAAM=$(pm2 list --no-color 2>/dev/null | grep -oE 'kroket[a-z]+' | head -1 || echo "kroketgod")
  info "pm2 gevonden. Bot herstarten: ${BOT_NAAM}"
  pm2 restart "$BOT_NAAM" && pm2 save
  sleep 2
  pm2 status "$BOT_NAAM"
  info "Bot herstart met alle nieuwe functies:"
  echo "   • Gemini 2.0 Flash afbeeldingen"
  echo "   • Gespreksgeheugen (sarcasme-detectie)"
  echo "   • Timezone fix (Amsterdam)"
  echo "   • Vergrijpentracking (3x waarschuwing → 5x ban)"
  echo "   • RECHTER / HERDER karakterbalans"
else
  warn "pm2 niet gevonden. Herstart de bot handmatig:"
  echo "    pm2 restart kroketgod"
fi

# ── 9. Cron instellen: nachtelijke herstart + wekelijkse update
echo ""
echo "── Cron instellen ──────────────────────"

# Bouw nieuwe crontab op — verwijder eventuele oude kroketgod-regels eerst
CRON_BESTAAND=$(crontab -l 2>/dev/null | grep -v 'kroketgod\|pm2 restart' || true)

BOT_PAD=$(pm2 list --no-color 2>/dev/null | grep -oE '/[^ ]+index\.js' | head -1 | xargs dirname 2>/dev/null || echo "$HOME/kroketgod-slack")
PM2_BIN=$(which pm2 2>/dev/null || echo "$HOME/.npm-global/bin/pm2")

NIEUWE_CRON=$(cat <<CRON
${CRON_BESTAAND}
# Kroket God — nachtelijke herstart (elke nacht 03:00)
0 3 * * * ${PM2_BIN} restart kroketgod >> ${BOT_PAD}/cron.log 2>&1
# Kroket God — wekelijkse npm update (elke maandag 03:30)
30 3 * * 1 cd ${BOT_PAD} && npm install --silent >> ${BOT_PAD}/cron.log 2>&1 && ${PM2_BIN} restart kroketgod >> ${BOT_PAD}/cron.log 2>&1
CRON
)

echo "$NIEUWE_CRON" | crontab -
info "Cron ingesteld:"
echo "   • Elke nacht 03:00 → pm2 restart kroketgod"
echo "   • Elke maandag 03:30 → npm install + restart"
echo "   • Logs: ${BOT_PAD}/cron.log"

# ── 10. Klaar — toon verbindingsinfo
echo ""
echo "╔══════════════════════════════════════╗"
echo "║              Klaar! ✓                ║"
echo "╚══════════════════════════════════════╝"
echo ""
info "Tailscale IP van deze Pi:"
tailscale ip -4
echo ""
info "Je kunt nu vanaf elke plek SSH'en:"
PI_NAAM=$(tailscale status --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Self']['HostName'])" 2>/dev/null || hostname)
echo ""
echo "    ssh pi@${PI_NAAM}"
echo ""
warn "Vergeet niet Tailscale ook op je Mac te installeren:"
echo "    https://tailscale.com/download/mac"
echo ""
