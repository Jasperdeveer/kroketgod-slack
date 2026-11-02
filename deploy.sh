#!/bin/bash
# ─────────────────────────────────────────
#  Kroket God — deploy naar jsprsuperserver
#  Gebruik: bash deploy.sh [hostname/IP]
#    bash deploy.sh                    → jsprsuperserver via Tailscale
#    bash deploy.sh 192.168.178.x      → een ander adres
#
#  De bot draait daar in Docker (container 'kroketgod' plus 'kroketgod-waakhond', zie compose.yml;
#  op de server staat die in ~/docker/kroketgod). De container doet bij elke start zelf npm install,
#  dus bestanden kopiëren en herstarten is genoeg. MagicDNS staat uit in de tailnet, daarom het IP.
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
SERVER_USER="jspr"
SERVER_HOST="${1:-100.101.216.108}"   # jsprsuperserver
SERVER="${SERVER_USER}@${SERVER_HOST}"
SERVER_PAD="/home/jspr/kroketgod"
COMPOSE_PAD="/home/jspr/docker/kroketgod"
CONTAINER="kroketgod"

echo ""
info "Verbinden met: ${SERVER}"

if ! ssh -o ConnectTimeout=6 -o BatchMode=yes "$SERVER" "echo ok" &>/dev/null; then
  echo ""
  error "Kan niet verbinden met ${SERVER_HOST}.
  Mogelijke oorzaken:
    - Tailscale staat niet aan op deze laptop
    - de server staat uit
  Probeer: ping ${SERVER_HOST}"
fi
info "SSH verbinding OK"

# ── Bestanden kopiëren
echo ""
info "Bestanden uploaden..."

BESTANDEN=(
  "index.js"
  # package.json + lock MOETEN mee: de container installeert bij het starten tegen dit bestand.
  "package.json"
  "package-lock.json"
  "dashboard.html"
  "prompt-safety.js"
  "tone_of_voice.txt"
  "tone_of_voice_satebal.txt"
  "tone_of_voice_straattaal.txt"
  "geboden.txt"
  # Legacy-ledenlijst. members.json is de echte bron, maar index.js leest dit bestand nog met
  # readFileSync zonder try/catch bij het opbouwen van SYSTEM_PROMPT_BASIS.
  "leden.txt"
  # Het Vetgeschrift — de Onderste Codex. MOET mee: index.js leest hem met readFileSync
  # zonder try/catch, dus zonder dit bestand start de bot niet op.
  "vetgeschrift.txt"
  "gepanneerde_rijk.txt"
  "kroketgod.png"
  # Materiaalstaal dat als bijlage meegaat met elke Gemini-beeldopdracht (zie KROKET_REFERENTIE).
  # Zonder dit bestand valt de referentie stil terug op kroketgod.png.
  "referentie-kroket.jpg"
)

# Bestanden waarvan de SERVER de bron van waarheid is: de bot schrijft ze zelf (aanmelden,
# rolwissel, profielvelden). Ze worden alleen geüpload als ze daar nog NIET bestaan —
# anders zou een deploy vanaf een verouderde laptop-kopie nieuwe leden wegvagen.
# (Net als .env, die nooit wordt gedeployed.)
SERVER_EIGEN=(
  "members.json"
)

for bestand in "${BESTANDEN[@]}"; do
  lokaal="${LOKAAL_PAD}/${bestand}"
  if [[ -f "$lokaal" ]]; then
    scp -q "$lokaal" "${SERVER}:${SERVER_PAD}/${bestand}"
    info "  ${bestand}"
  else
    warn "  ${bestand} niet gevonden, overgeslagen"
  fi
done

# ── Interne modules (lib/) en het lettertype voor de casinoplaatjes (fonts/). Bewust de hele
# mappen, zodat een nieuwe module niet vergeten kan worden.
ssh "$SERVER" "mkdir -p '${SERVER_PAD}/lib' '${SERVER_PAD}/fonts'"
scp -q "${LOKAAL_PAD}/lib/"*.js "${SERVER}:${SERVER_PAD}/lib/"
info "  lib/ ($(ls -1 "${LOKAAL_PAD}/lib/"*.js | wc -l | tr -d ' ') modules)"
scp -q "${LOKAAL_PAD}/fonts/"* "${SERVER}:${SERVER_PAD}/fonts/"
info "  fonts/"

for bestand in "${SERVER_EIGEN[@]}"; do
  lokaal="${LOKAAL_PAD}/${bestand}"
  [[ -f "$lokaal" ]] || continue
  if ssh "$SERVER" "test -f '${SERVER_PAD}/${bestand}'"; then
    info "  ${bestand} overgeslagen (de server is de bron van waarheid)"
  else
    scp -q "$lokaal" "${SERVER}:${SERVER_PAD}/${bestand}"
    info "  ${bestand} (eerste keer aangelegd)"
  fi
done

# ── Bot herstarten en wachten tot hij wakker is (npm install zit in de start). Is compose.yml
# veranderd, dan maakt compose de containers opnieuw aan (dat is meteen de herstart); anders een
# gewone herstart, die de log van de container laat staan.
echo ""
scp -q "${LOKAAL_PAD}/compose.yml" "${SERVER}:${COMPOSE_PAD}/compose.yml.nieuw"
if ssh "$SERVER" "cmp -s '${COMPOSE_PAD}/compose.yml.nieuw' '${COMPOSE_PAD}/compose.yml'"; then
  info "Bot herstarten..."
  SINDS=$(ssh "$SERVER" "rm '${COMPOSE_PAD}/compose.yml.nieuw'; date -u +%Y-%m-%dT%H:%M:%SZ; docker restart ${CONTAINER} >/dev/null")
else
  info "compose.yml gewijzigd: containers opnieuw aanmaken..."
  SINDS=$(ssh "$SERVER" "cd '${COMPOSE_PAD}' && mv compose.yml.nieuw compose.yml && date -u +%Y-%m-%dT%H:%M:%SZ && docker compose up -d --force-recreate --quiet-pull >/dev/null")
fi

OPSTART=""
for _ in $(seq 1 30); do
  sleep 2
  OPSTART=$(ssh "$SERVER" "docker logs ${CONTAINER} --since ${SINDS} 2>&1" || true)
  echo "$OPSTART" | grep -q "wakker" && break
done
if echo "$OPSTART" | grep -q "wakker"; then
  info "Bot is succesvol opgestart ⚜️"
else
  warn "Geen opstartbevestiging binnen een minuut. Laatste regels:"
  echo "$OPSTART" | tail -15
fi

echo ""
info "Live logs:"
echo "   ssh ${SERVER} 'docker logs -f --tail 50 ${CONTAINER}'"
echo ""
