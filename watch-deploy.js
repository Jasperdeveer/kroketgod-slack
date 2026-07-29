#!/usr/bin/env node
// Auto-deploy naar Pi zodra een bewaakt bestand wijzigt.
// Gebruik: node watch-deploy.js [kroketpi|192.168.178.80]
// Vereist: SSH-toegang zonder wachtwoord (key-based auth)

const fs   = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const PI_USER = 'jspr';
const PI_HOST = process.argv[2] || 'kroketpi';
const PI_PAD  = '/home/jspr/kroketgod';
const PM2_CMD = 'source ~/.nvm/nvm.sh && pm2 restart kroketgod';

const BEWAAKT = [
  'index.js',
  'tone_of_voice.txt',
  'geboden.txt',
  'gepanneerde_rijk.txt',
  'members.json',
];

const ROOT = __dirname;

// Test verbinding bij start
try {
  execSync(`ssh -o ConnectTimeout=5 -o BatchMode=yes ${PI_USER}@${PI_HOST} "echo ok"`, { stdio: 'pipe' });
  console.log(`✅ Verbonden met ${PI_HOST} — bewaking gestart`);
  console.log(`📁 Bestanden: ${BEWAAKT.join(', ')}\n`);
} catch {
  console.error(`❌ Kan niet verbinden met ${PI_HOST}. Controleer Tailscale of het netwerk.`);
  process.exit(1);
}

let debounceTimer = null;
const gewijzigd  = new Set();

function deploy() {
  const bestanden = [...gewijzigd];
  gewijzigd.clear();

  console.log(`\n🚀 Wijziging gedetecteerd: ${bestanden.join(', ')}`);
  console.log(`   Uploaden naar ${PI_HOST}...`);

  const bronnen = bestanden.map(f => `"${path.join(ROOT, f)}"`).join(' ');
  const doel    = `${PI_USER}@${PI_HOST}:${PI_PAD}/`;

  exec(`scp ${bronnen} ${doel}`, (err) => {
    if (err) {
      console.error(`   ❌ Upload mislukt: ${err.message}`);
      return;
    }
    console.log(`   ✅ Upload klaar — bot herstarten...`);
    exec(`ssh ${PI_USER}@${PI_HOST} "bash -lc '${PM2_CMD}'"`, (err2, stdout) => {
      if (err2) {
        console.error(`   ❌ Herstart mislukt: ${err2.message}`);
      } else {
        const online = stdout.includes('online') || stdout.includes('✓');
        console.log(`   ${online ? '⚜️  Bot is wakker' : '⚠️  Controleer logs: pm2 logs kroketgod'}`);
      }
    });
  });
}

for (const bestand of BEWAAKT) {
  const volledigPad = path.join(ROOT, bestand);
  if (!fs.existsSync(volledigPad)) {
    console.warn(`⚠️  ${bestand} niet gevonden, wordt genegeerd`);
    continue;
  }
  fs.watch(volledigPad, () => {
    gewijzigd.add(bestand);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(deploy, 1500); // 1.5s debounce — bundelt snelle saves
  });
  console.log(`👁  ${bestand}`);
}

console.log(`\nWachten op wijzigingen... (Ctrl+C om te stoppen)\n`);
