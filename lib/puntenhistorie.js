// ── Dagstanden: de weekscore per lid aan het eind van elke dag (pure kern) ───
//
// Puur: geen I/O en geen klok; `nu` en de scores komen van buiten. index.js leest en schrijft
// puntenhistorie.json, legt om 23:55 (Amsterdam) en bij opstart de stand van de dag vast.
// De weekscore gaat zondag 23:59 op nul, dus de zondagstand van 23:55 is de eindstand van de week.
//
// ── staat (puntenhistorie.json) ──
//   { dagen: { 'JJJJ-MM-DD': { userId: weekscore } } }   // dag = Amsterdamse dagsleutel
//   Een ontbrekend veld telt als leeg. Hoogstens BEWAAR_DAGEN dagen (ruimOp).
'use strict';
const { amsMoment } = require('./regie.js');

const BEWAAR_DAGEN = 60;
const DAG_MS = 86_400_000;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

// Dagsleutel + n dagen (via 12:00 UTC, dus DST-vrij).
const plusDagen = (dag, n) => new Date(Date.parse(`${dag}T12:00:00Z`) + n * DAG_MS).toISOString().slice(0, 10);
const dagenVan = (staat) => (staat && staat.dagen) || {};

// Nieuwe staat met de scores van `datum` (overschrijft die dag). Niet-eindige scores vallen weg.
function legDagstandVast(staat, datum, scores) {
  const dagen = { ...dagenVan(staat) };
  if (DATUM.test(datum || '')) {
    dagen[datum] = Object.fromEntries(Object.entries(scores || {}).filter(([, v]) => Number.isFinite(v)));
  }
  return { ...(staat || {}), dagen };
}

// Zeven waarden vanaf `maandag`: de score van het lid, 0 als het die dag niet in de stand stond,
// null voor een dag zonder stand (toekomst of bot lag eruit).
function weekReeks(staat, maandag, userId) {
  const dagen = dagenVan(staat);
  return Array.from({ length: 7 }, (_, i) => {
    const d = dagen[plusDagen(maandag, i)];
    return d ? (d[userId] ?? 0) : null;
  });
}

// Gemiddelde weekscore over de leden in de stand van elke dag (een tiende nauwkeurig), null zonder stand.
function gemiddeldeReeks(staat, maandag) {
  const dagen = dagenVan(staat);
  return Array.from({ length: 7 }, (_, i) => {
    const w = Object.values(dagen[plusDagen(maandag, i)] || {});
    return w.length ? Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10 : null;
  });
}

// Nieuwe staat zonder dagen ouder dan BEWAAR_DAGEN (gerekend vanaf de Amsterdamse dag van `nu`).
function ruimOp(staat, nu) {
  const grens = plusDagen(amsMoment(nu).dag, -BEWAAR_DAGEN);
  const dagen = Object.fromEntries(Object.entries(dagenVan(staat)).filter(([d]) => d >= grens));
  return { ...(staat || {}), dagen };
}

module.exports = { BEWAAR_DAGEN, legDagstandVast, weekReeks, gemiddeldeReeks, ruimOp };
