// ── Dashboard-infrastructuur ───────────────────────────────────────────────────
// Het gereedschap rond het dashboard: authenticatie, audit-logboek en het inlezen van de HTML.
// De route-definities en bouwDashboardData() blijven bewust in index.js — die weten precies
// welke spelstaat er bestaat en horen dus bij de projectkennis, niet bij de infrastructuur.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_DIR = path.join(__dirname, '..');

function dashboardAuth(req, res) {
  const vereistToken = process.env.DASHBOARD_TOKEN;
  if (!vereistToken) return true; // geen token geconfigureerd → open (dev)
  const authHeader = req.headers['authorization'] || '';
  const aangeboden = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  // Constant-time vergelijking — buffers moeten even lang zijn voor timingSafeEqual
  const a = Buffer.from(aangeboden);
  const b = Buffer.from(vereistToken);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ ok: false, error: 'Onbevoegd. DASHBOARD_TOKEN vereist.' }));
  return false;
}

// Audit-log: elke geslaagde schrijfactie via het dashboard wordt vastgelegd (laatste 200).
// fs/path zijn hier al geladen; readJSON/writeJSON nog niet gedefinieerd op module-load,
// dus we gebruiken een lazy require-vrije implementatie via een functie-aanroep later.
function logAudit(endpoint, samenvatting) {
  try {
    const file = path.join(PROJECT_DIR, 'auditlog.json');
    let data = { items: [] };
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
    data.items.push({ ts: Date.now(), endpoint, samenvatting: String(samenvatting).substring(0, 200) });
    data.items = data.items.slice(-200);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
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
