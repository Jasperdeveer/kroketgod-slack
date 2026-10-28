// Tests voor de opslaglaag: élk JSON-bestand van het genootschap gaat hier doorheen. Juist
// daarom stond deze module tot nu toe zonder test, terwijl de rest van lib/ er wél een had —
// en een kapotte atomic write of een stukke corrupt-redding merk je pas bij de eerstvolgende
// stroomuitval op de Pi, als de spelstaat al weg is.
//
// KROKET_STATE_DIR wijst naar een tijdelijke map VOORDAT de module geladen wordt; anders zou
// deze test over de echte scores.json heen schrijven.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kroket-state-'));
process.env.KROKET_STATE_DIR = TMP;

const { readJSON, writeJSON } = require('./state');

const pad = (naam) => path.join(TMP, naam);

// Elk testbestand krijgt een eigen naam: de module cachet op bestandsnaam, dus hergebruik van
// één naam zou tests via die cache aan elkaar knopen.
let teller = 0;
const versName = () => `t${++teller}.json`;

// ── Schrijven en teruglezen ───────────────────────────────────────────────────

test('writeJSON schrijft en readJSON leest hetzelfde terug', () => {
  const f = versName();
  writeJSON(f, { punten: 12, leden: ['U1', 'U2'] });
  assert.deepEqual(readJSON(f), { punten: 12, leden: ['U1', 'U2'] });
});

test('writeJSON laat geen .tmp-bestand achter', () => {
  const f = versName();
  writeJSON(f, { a: 1 });
  assert.equal(fs.existsSync(`${pad(f)}.tmp`), false);
});

test('writeJSON overschrijft een bestaande stand volledig', () => {
  const f = versName();
  writeJSON(f, { a: 1, b: 2 });
  writeJSON(f, { a: 9 });
  assert.deepEqual(readJSON(f), { a: 9 });
  assert.deepEqual(JSON.parse(fs.readFileSync(pad(f), 'utf8')), { a: 9 });
});

// ── Ontbrekend bestand ────────────────────────────────────────────────────────

test('readJSON geeft de fallback bij een bestand dat nog niet bestaat', () => {
  assert.deepEqual(readJSON(versName(), { week: null }), { week: null });
});

test('readJSON geeft een expliciete null-fallback terug en gooit die niet weg', () => {
  // null is een geldige fallback (loadMissie: "geen actieve missie"); alleen `undefined`
  // betekent "geen fallback opgegeven".
  assert.equal(readJSON(versName(), null), null);
});

test('readJSON gooit bij een ontbrekend bestand zonder fallback', () => {
  assert.throws(() => readJSON(versName()), { code: 'ENOENT' });
});

// ── Corrupt bestand ───────────────────────────────────────────────────────────
// Het scenario waar dit allemaal voor is: de Pi valt uit midden in een schrijfactie.

test('readJSON stelt een corrupt bestand veilig en gaat met de fallback door', () => {
  const f = versName();
  fs.writeFileSync(pad(f), '{"punten": 12, "leden": ["U1"');  // afgekapt

  const uit = readJSON(f, { punten: 0 });
  assert.deepEqual(uit, { punten: 0 });

  // Het kapotte bestand is opzijgezet, niet weggegooid: de inhoud is nog te redden.
  const bewaard = fs.readdirSync(TMP).filter(n => n.startsWith(`${f}.corrupt.`));
  assert.equal(bewaard.length, 1);
  assert.match(fs.readFileSync(path.join(TMP, bewaard[0]), 'utf8'), /"punten": 12/);

  // En het pad is vrij, dus de volgende schrijfactie werkt gewoon weer.
  writeJSON(f, { punten: 5 });
  assert.deepEqual(readJSON(f), { punten: 5 });
});

test('readJSON gooit bij corrupt JSON zonder fallback in plaats van stilletjes door te gaan', () => {
  const f = versName();
  fs.writeFileSync(pad(f), 'dit is geen json');
  assert.throws(() => readJSON(f), SyntaxError);
});

// ── Cache ─────────────────────────────────────────────────────────────────────

test('readJSON ziet een wijziging van buitenaf', () => {
  const f = versName();
  writeJSON(f, { a: 1 });
  assert.deepEqual(readJSON(f), { a: 1 });

  // Een andere mtime afdwingen: op een snelle schijf kunnen twee schrijfacties in dezelfde
  // milliseconde vallen, en dan zou de cache de oude stand blijven geven.
  fs.writeFileSync(pad(f), JSON.stringify({ a: 2 }));
  const t = new Date(Date.now() + 2000);
  fs.utimesSync(pad(f), t, t);

  assert.deepEqual(readJSON(f), { a: 2 });
});
