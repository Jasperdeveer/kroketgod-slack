// Tests voor het slot op het dashboard. Dit is de enige code die beslist wie er bij de scores,
// de bans, het verkondigen namens de Kroket God en de ledengegevens in /api/stats mag — en hij
// had geen test. De belangrijkste hieronder is de eerste: zonder DASHBOARD_TOKEN hoort het
// dashboard DICHT te zitten, niet open.
//
// KROKET_STATE_DIR wijst naar een tijdelijke map VOORDAT de module geladen wordt, zodat de
// audit-logtest niet over de echte auditlog.json heen schrijft.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kroket-dashboard-'));
process.env.KROKET_STATE_DIR = TMP;

const { dashboardAuth, logAudit } = require('./dashboardkern');

// Minimale namaak van een http-verzoek en -antwoord: dashboardAuth gebruikt alleen de
// authorization-header, writeHead en end.
function nep(authHeader) {
  const req = { headers: authHeader === undefined ? {} : { authorization: authHeader } };
  const res = {
    status: null,
    body: null,
    writeHead(code) { this.status = code; },
    end(tekst) { this.body = tekst; },
  };
  return { req, res };
}

function metToken(token, fn) {
  const vorig = process.env.DASHBOARD_TOKEN;
  if (token === null) delete process.env.DASHBOARD_TOKEN;
  else process.env.DASHBOARD_TOKEN = token;
  try { fn(); } finally {
    if (vorig === undefined) delete process.env.DASHBOARD_TOKEN;
    else process.env.DASHBOARD_TOKEN = vorig;
  }
}

// ── Het slot ──────────────────────────────────────────────────────────────────

test('zonder DASHBOARD_TOKEN op de server gaat het dashboard dicht, niet open', () => {
  metToken(null, () => {
    const { req, res } = nep('Bearer wat-dan-ook');
    assert.equal(dashboardAuth(req, res), false);
    assert.equal(res.status, 401);
    assert.match(res.body, /DASHBOARD_TOKEN/);
  });
});

test('een verzoek zonder Authorization-header wordt geweigerd', () => {
  metToken('geheim123', () => {
    const { req, res } = nep(undefined);
    assert.equal(dashboardAuth(req, res), false);
    assert.equal(res.status, 401);
  });
});

test('het juiste token mag erdoor en er wordt niets teruggeschreven', () => {
  metToken('geheim123', () => {
    const { req, res } = nep('Bearer geheim123');
    assert.equal(dashboardAuth(req, res), true);
    assert.equal(res.status, null);
  });
});

test('een verkeerd token van dezelfde lengte wordt geweigerd', () => {
  metToken('geheim123', () => {
    const { req, res } = nep('Bearer geheim124');
    assert.equal(dashboardAuth(req, res), false);
    assert.equal(res.status, 401);
  });
});

test('een token van een andere lengte wordt geweigerd en laat timingSafeEqual niet knallen', () => {
  // crypto.timingSafeEqual gooit bij ongelijke bufferlengtes; de lengtecheck ervoor vangt dat af.
  metToken('geheim123', () => {
    for (const aangeboden of ['Bearer g', 'Bearer geheim123456789', 'Bearer ']) {
      const { req, res } = nep(aangeboden);
      assert.equal(dashboardAuth(req, res), false, aangeboden);
      assert.equal(res.status, 401);
    }
  });
});

test('alleen het Bearer-schema telt mee', () => {
  metToken('geheim123', () => {
    const { req, res } = nep('geheim123');  // zonder "Bearer "
    assert.equal(dashboardAuth(req, res), false);
  });
});

// ── Audit-log ─────────────────────────────────────────────────────────────────

test('logAudit schrijft de actie weg en kapt af op de laatste 200', () => {
  const bestand = path.join(TMP, 'auditlog.json');
  try { fs.rmSync(bestand); } catch (_) {}

  logAudit('score', 'Jan: +5 → 20');
  const na1 = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  assert.equal(na1.items.length, 1);
  assert.equal(na1.items[0].endpoint, 'score');
  assert.equal(na1.items[0].samenvatting, 'Jan: +5 → 20');
  assert.ok(na1.items[0].ts > 0);

  // Net over de grens van 200: elke schrijfactie is een echte fsync, dus niet meer dan nodig.
  for (let i = 0; i < 205; i++) logAudit('ban', `actie ${i}`);
  const na2 = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  assert.equal(na2.items.length, 200);
  assert.equal(na2.items[199].samenvatting, 'actie 204');  // de nieuwste blijft staan
});

test('logAudit kapt een lange samenvatting af en laat de bot nooit vallen', () => {
  const bestand = path.join(TMP, 'auditlog.json');
  try { fs.rmSync(bestand); } catch (_) {}

  logAudit('verkondig', 'x'.repeat(500));
  const data = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  assert.equal(data.items[0].samenvatting.length, 200);

  // Een onmogelijke samenvatting (toString gooit) mag geen uitzondering naar buiten laten.
  assert.doesNotThrow(() => logAudit('test', { toString() { throw new Error('stuk'); } }));
});
