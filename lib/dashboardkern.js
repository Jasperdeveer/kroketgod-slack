// ── Dashboard-infrastructuur ───────────────────────────────────────────────────
// Het gereedschap rond het dashboard: authenticatie, audit-logboek en het inlezen van de HTML.
// De route-definities en bouwDashboardData() blijven bewust in index.js — die weten precies
// welke spelstaat er bestaat en horen dus bij de projectkennis, niet bij de infrastructuur.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readJSON, writeJSON } = require('./state.js');

const PROJECT_DIR = path.join(__dirname, '..');

function weiger(res, boodschap) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: boodschap }));
  return false;
}

// Zonder DASHBOARD_TOKEN gaat het dashboard DICHT, niet open. Hiervoor gaf deze functie `true`
// terug zodra de env var ontbrak, "dev-mode" — maar daarmee lag bij elke installatie zonder token
// alles open voor wie poort 3001 kon bereiken: scores, bans, verkondigen namens de Kroket God, en
// via /api/stats de ledengegevens inclusief de actorId's die lib/anoniem.js juist geheim houdt.
// Falen hoort de veilige kant op te vallen.
function dashboardAuth(req, res) {
  const vereistToken = process.env.DASHBOARD_TOKEN;
  if (!vereistToken) return weiger(res, 'Dashboard gesloten: DASHBOARD_TOKEN ontbreekt op de server.');
  const authHeader = req.headers['authorization'] || '';
  const aangeboden = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  // Constant-time vergelijking — buffers moeten even lang zijn voor timingSafeEqual
  const a = Buffer.from(aangeboden);
  const b = Buffer.from(vereistToken);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  return weiger(res, 'Onbevoegd. DASHBOARD_TOKEN vereist.');
}

// Audit-log: elke geslaagde schrijfactie via het dashboard wordt vastgelegd (laatste 200).
// Gaat via state.js, net als alle andere spelstaat: die schrijft atomair (temp + fsync + rename),
// zodat een stroomuitval op de Pi geen half auditlog.json achterlaat.
function logAudit(endpoint, samenvatting) {
  try {
    // Kopie: readJSON geeft het gecachete object terug, en dat mag deze functie niet muteren.
    const items = [...(readJSON('auditlog.json', { items: [] }).items || [])];
    items.push({ ts: Date.now(), endpoint, samenvatting: String(samenvatting).substring(0, 200) });
    writeJSON('auditlog.json', { items: items.slice(-200) });
  } catch (_) {}
}

// Dashboard-HTML staat sinds de 2.0-upgrade in een los bestand (dashboard.html) — makkelijker
// te onderhouden dan een inline template. mtime-cache zodat een deploy direct zichtbaar is.
let _dashboardHtmlCache = { mtimeMs: 0, html: '' };

function leesDashboardHtml() {
  const p = path.join(PROJECT_DIR, 'dashboard.html');
  try {
    const stat = fs.statSync(p);
    if (stat.mtimeMs !== _dashboardHtmlCache.mtimeMs) {
      _dashboardHtmlCache = { mtimeMs: stat.mtimeMs, html: fs.readFileSync(p, 'utf8') };
    }
    return _dashboardHtmlCache.html;
  } catch (_) {
    return '<h1>dashboard.html ontbreekt op de server</h1>';
  }
}

module.exports = {
  dashboardAuth,
  logAudit,
  leesDashboardHtml,
};
