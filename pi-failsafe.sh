#!/bin/bash
# ─────────────────────────────────────────
#  Failsafe voor de Kroket Pi
#  Uitvoeren op de Pi: sudo bash pi-failsafe.sh   (opnieuw draaien kan altijd)
# ─────────────────────────────────────────
#
# Aanleiding (30 oktober 2026): de Pi staat op afstand, hing om 08:27 en niemand kon erbij.
# Dit zet vier vangnetten op, zodat hij zichzelf weer overeind krijgt:
#   1. Hardware-watchdog: hangt het systeem zelf, dan herstart de Pi na 15 seconden.
#   2. Waakhond (elke 2 minuten): reageert de bot niet meer op /health, dan pm2 restart;
#      is het internet 10 minuten weg, dan het netwerk opnieuw; na 20 minuten een herstart
#      van de Pi (hoogstens één keer per uur, zodat een lange storing geen herstartlus wordt).
#   3. Geheugengrens voor de bot in pm2, zodat een vollopend geheugen niet de hele Pi meesleept.
#   4. De bot start na elke herstart vanzelf (pm2 startup), en het systeemlog blijft over een
#      herstart heen bewaard, zodat achteraf te zien is wat er gebeurde.
# De bot zelf herstart al bij een verloren Slack-verbinding (de waakhond in index.js); dit is de
# laag daaronder.

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Draai dit met sudo: sudo bash pi-failsafe.sh"

GEBRUIKER="${SUDO_USER:-jspr}"
THUIS=$(getent passwd "$GEBRUIKER" | cut -d: -f6)
NODE_BIN=$(ls -d "$THUIS"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)
[ -x "$NODE_BIN/pm2" ] || error "pm2 niet gevonden onder $THUIS/.nvm"
PM2() { sudo -u "$GEBRUIKER" -H env PATH="$NODE_BIN:$PATH" pm2 "$@"; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      Failsafe — Kroket Pi            ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Hardware-watchdog via systemd
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/kroketgod-watchdog.conf <<'EOF'
[Manager]
RuntimeWatchdogSec=15
RebootWatchdogSec=2min
EOF
systemctl daemon-reexec
if [ -e /dev/watchdog ]; then info "Hardware-watchdog aan (15 s)"; else warn "Geen /dev/watchdog: zet dtparam=watchdog=on in /boot/firmware/config.txt en herstart"; fi

# ── 2. Waakhond: bot en netwerk
cat > /usr/local/bin/kroketgod-waakhond <<EOF
#!/bin/bash
# Elke 2 minuten via kroketgod-waakhond.timer. Opgezet door pi-failsafe.sh.
STAAT=/var/lib/kroketgod-waakhond
mkdir -p "\$STAAT"
tel() { local n=\$(( \$(cat "\$STAAT/\$1" 2>/dev/null || echo 0) + 1 )); echo \$n > "\$STAAT/\$1"; echo \$n; }

# De bot: geen antwoord op /health (het proces hangt of draait niet) → na drie keer pm2 restart.
# Een 503 telt als antwoord: dan is Slack weg, en dat lost de bot zelf op.
if curl -s -m 10 -o /dev/null http://localhost:3001/health; then
  echo 0 > "\$STAAT/bot"
elif [ "\$(tel bot)" -ge 3 ]; then
  logger -t kroketgod-waakhond "bot reageert niet op /health — pm2 restart"
  sudo -u $GEBRUIKER -H env PATH="$NODE_BIN:\$PATH" pm2 restart kroketgod || true
  echo 0 > "\$STAAT/bot"
fi

# Het internet: na 10 minuten zonder het netwerk opnieuw, na 20 minuten de Pi opnieuw,
# maar niet als hij nog geen uur aan staat.
if ping -c 1 -W 5 1.1.1.1 >/dev/null 2>&1 || ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1; then
  echo 0 > "\$STAAT/net"
else
  n=\$(tel net)
  if [ "\$n" -eq 5 ]; then
    logger -t kroketgod-waakhond "10 minuten geen internet — netwerk opnieuw"
    if command -v nmcli >/dev/null; then nmcli networking off; sleep 5; nmcli networking on
    else systemctl restart dhcpcd 2>/dev/null || systemctl restart networking 2>/dev/null || true; fi
  elif [ "\$n" -ge 10 ] && [ "\$(cut -d. -f1 /proc/uptime)" -gt 3600 ]; then
    logger -t kroketgod-waakhond "20 minuten geen internet — herstart"
    echo 0 > "\$STAAT/net"
    systemctl reboot
  fi
fi
EOF
chmod 755 /usr/local/bin/kroketgod-waakhond

cat > /etc/systemd/system/kroketgod-waakhond.service <<'EOF'
[Unit]
Description=Kroket God waakhond (bot en netwerk)

[Service]
Type=oneshot
ExecStart=/usr/local/bin/kroketgod-waakhond
EOF
cat > /etc/systemd/system/kroketgod-waakhond.timer <<'EOF'
[Unit]
Description=Kroket God waakhond, elke 2 minuten

[Timer]
OnBootSec=3min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now kroketgod-waakhond.timer >/dev/null
info "Waakhond actief (elke 2 minuten)"

# ── 3. Geheugengrens voor de bot: 40% van het werkgeheugen, hoogstens 800 MB
GRENS=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) * 4 / 10 / 1024 ))
[ "$GRENS" -gt 800 ] && GRENS=800
PM2 restart kroketgod --max-memory-restart "${GRENS}M" --update-env >/dev/null
info "Bot herstart vanzelf boven ${GRENS} MB"

# ── 4. Opstarten na een herstart, en een log dat een herstart overleeft
env PATH="$NODE_BIN:$PATH" pm2 startup systemd -u "$GEBRUIKER" --hp "$THUIS" >/dev/null
PM2 save --force >/dev/null
info "pm2 start de bot na een herstart ($(systemctl is-enabled "pm2-$GEBRUIKER" 2>/dev/null))"

mkdir -p /var/log/journal /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/kroketgod.conf <<'EOF'
[Journal]
Storage=persistent
SystemMaxUse=100M
EOF
systemctl restart systemd-journald
info "Systeemlog blijft bewaard over een herstart heen (hoogstens 100 MB)"

echo ""
info "Klaar. Controle: systemctl list-timers kroketgod-waakhond · journalctl -t kroketgod-waakhond"
