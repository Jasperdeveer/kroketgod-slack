// Tests voor de rekenregels van De Frituurbeurs. Pure functies, dus geen state of tijdelijke
// mappen nodig. Run: `npm test` of `node --test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_AANDELEN_TOTAAL,
  MAX_PER_DOELWIT,
  koers,
  verkoopprijs,
  dividendVoorPlek,
  totaalAandelen,
  aandelenIn,
  toetsAankoop,
  toetsVerkoop,
  berekenAfrekening,
} = require('./beurs');

// ── Koers ──────────────────────────────────────────────────────────────────────

test('koers stijgt met de stand en heeft een bodem van 1', () => {
  assert.equal(koers(0), 1);
  assert.equal(koers(1), 1);
  assert.equal(koers(4), 1);
  assert.equal(koers(5), 2);
  assert.equal(koers(20), 5);
  assert.equal(koers(40), 10);
});

test('koers is bestendig tegen rommel en negatieve standen', () => {
  assert.equal(koers(-10), 1);
  assert.equal(koers(null), 1);
  assert.equal(koers(undefined), 1);
  assert.equal(koers('12'), 3);
});

test('verkopen levert minder op dan kopen kost — anders was het een geldkraan', () => {
  for (const score of [0, 5, 12, 20, 40, 59]) {
    assert.ok(verkoopprijs(score) <= koers(score),
      `verkoopprijs(${score}) mag nooit boven de koers liggen`);
  }
  assert.equal(verkoopprijs(0), 1);   // bodem: nooit nul opbrengst
  assert.equal(verkoopprijs(20), 3);  // koers 5 → 3
  assert.equal(verkoopprijs(40), 7);  // koers 10 → 7
});

test('winst vraagt een echte klim: pas bij ruwweg verdubbelde koers loont verkopen', () => {
  // Gekocht op stand 8 (koers 2). Verkopen wordt pas winstgevend als de opbrengst boven 2 komt.
  const gekochtVoor = koers(8);
  assert.ok(verkoopprijs(8) <= gekochtVoor, 'direct terugverkopen mag geen winst geven');
  assert.ok(verkoopprijs(16) <= gekochtVoor, 'een halve verdubbeling is nog geen winst');
  assert.ok(verkoopprijs(24) > gekochtVoor, 'een ruime verdrievoudiging hoort wél te lonen');
});

// ── Dividend ───────────────────────────────────────────────────────────────────

test('dividend geldt alleen voor de eerste drie plekken', () => {
  assert.equal(dividendVoorPlek(1), 3);
  assert.equal(dividendVoorPlek(2), 2);
  assert.equal(dividendVoorPlek(3), 1);
  assert.equal(dividendVoorPlek(4), 0);
  assert.equal(dividendVoorPlek(99), 0);
});

// ── Portefeuille tellen ────────────────────────────────────────────────────────

test('totaalAandelen telt over alle doelwitten', () => {
  const p = { U1: { U2: 2, U3: 1 } };
  assert.equal(totaalAandelen(p, 'U1'), 3);
  assert.equal(totaalAandelen(p, 'onbekend'), 0);
  assert.equal(totaalAandelen({}, 'U1'), 0);
  assert.equal(aandelenIn(p, 'U1', 'U2'), 2);
  assert.equal(aandelenIn(p, 'U1', 'U9'), 0);
});

// ── Aankoop toetsen ────────────────────────────────────────────────────────────

const AANKOOP = { koperId: 'U1', doelId: 'U2', aantal: 1, doelScore: 20, punten: 50 };

test('een gewone aankoop mag en kost de koers', () => {
  const r = toetsAankoop(AANKOOP);
  assert.equal(r.ok, true);
  assert.equal(r.kosten, 5); // koers(20)
});

test('meerdere aandelen kosten een veelvoud', () => {
  assert.equal(toetsAankoop({ ...AANKOOP, aantal: 3 }).kosten, 15);
});

test('handel in uw eigen aandeel is insiderhandel', () => {
  const r = toetsAankoop({ ...AANKOOP, doelId: 'U1' });
  assert.equal(r.ok, false);
  assert.match(r.reden, /insiderhandel/i);
});

test('aandelen in een niet-lid of een balling worden niet verhandeld', () => {
  assert.equal(toetsAankoop({ ...AANKOOP, doelIsLid: false }).ok, false);
  const balling = toetsAankoop({ ...AANKOOP, doelVerbannen: true });
  assert.equal(balling.ok, false);
  assert.match(balling.reden, /geschorst/i);
});

test('te weinig punten blokkeert de aankoop en noemt het tekort', () => {
  const r = toetsAankoop({ ...AANKOOP, aantal: 3, punten: 10 });
  assert.equal(r.ok, false);
  assert.match(r.reden, /15 kroketpunten/);
  assert.match(r.reden, /u heeft 10/);
});

test('nul of negatieve aantallen worden geweigerd', () => {
  assert.equal(toetsAankoop({ ...AANKOOP, aantal: 0 }).ok, false);
  assert.equal(toetsAankoop({ ...AANKOOP, aantal: -2 }).ok, false);
  assert.equal(toetsAankoop({ ...AANKOOP, aantal: 'x' }).ok, false);
});

test('de grens per doelwit geldt cumulatief', () => {
  const posities = { U1: { U2: MAX_PER_DOELWIT } };
  const r = toetsAankoop({ ...AANKOOP, posities });
  assert.equal(r.ok, false);
  assert.match(r.reden, new RegExp(`${MAX_PER_DOELWIT} aandelen in één lid`));
  // Precies tot de grens mag wel.
  assert.equal(toetsAankoop({ ...AANKOOP, posities: { U1: { U2: MAX_PER_DOELWIT - 1 } } }).ok, true);
});

test('de grens op de hele portefeuille geldt over doelwitten heen', () => {
  // Verdeeld over genoeg doelwitten om de totaalgrens te raken zonder de per-doelwitgrens.
  const posities = { U1: { U8: 3, U9: 3 } };
  assert.equal(totaalAandelen(posities, 'U1'), MAX_AANDELEN_TOTAAL);
  const r = toetsAankoop({ ...AANKOOP, posities });
  assert.equal(r.ok, false);
  assert.match(r.reden, new RegExp(`${MAX_AANDELEN_TOTAAL} aandelen`));
});

test('de portefeuille van een ander lid beperkt u niet', () => {
  const posities = { U7: { U2: MAX_PER_DOELWIT, U8: 3 } };
  assert.equal(toetsAankoop({ ...AANKOOP, posities }).ok, true);
});

// ── Verkoop toetsen ────────────────────────────────────────────────────────────

test('verkopen van bezit levert de verkoopprijs op', () => {
  const r = toetsVerkoop({ koperId: 'U1', doelId: 'U2', aantal: 2, doelScore: 40, posities: { U1: { U2: 2 } } });
  assert.equal(r.ok, true);
  assert.equal(r.opbrengst, 14); // verkoopprijs(40) = 7, × 2
});

test('verkopen wat u niet heeft wordt geweigerd', () => {
  assert.equal(toetsVerkoop({ koperId: 'U1', doelId: 'U2', aantal: 1, doelScore: 20, posities: {} }).ok, false);
  const teveel = toetsVerkoop({ koperId: 'U1', doelId: 'U2', aantal: 3, doelScore: 20, posities: { U1: { U2: 2 } } });
  assert.equal(teveel.ok, false);
  assert.match(teveel.reden, /U bezit 2/);
});

// ── Afrekening ─────────────────────────────────────────────────────────────────

const EINDSTAND = [['U2', 40], ['U3', 30], ['U4', 20], ['U5', 5]];

test('afrekening betaalt per aandeel naar eindplek', () => {
  const uit = berekenAfrekening({ posities: { U1: { U2: 2 } }, eindstand: EINDSTAND });
  assert.equal(uit.length, 1);
  assert.equal(uit[0].koperId, 'U1');
  assert.equal(uit[0].roem, 6); // plek 1 = 3 roem × 2 aandelen
  assert.deepEqual(uit[0].regels, [{ doelId: 'U2', aantal: 2, plek: 1, roem: 6 }]);
});

test('aandelen buiten de dividendplekken leveren niets op', () => {
  const uit = berekenAfrekening({ posities: { U1: { U5: 3 } }, eindstand: EINDSTAND });
  assert.deepEqual(uit, []); // wie niets ophaalt komt niet in de uitkomst
});

test('een gespreide portefeuille telt op en zet de beste regel bovenaan', () => {
  const uit = berekenAfrekening({ posities: { U1: { U4: 1, U2: 1, U5: 2 } }, eindstand: EINDSTAND });
  assert.equal(uit[0].roem, 4); // plek 1 (3) + plek 3 (1); U5 levert niets
  assert.equal(uit[0].regels[0].doelId, 'U2');
  assert.equal(uit[0].regels.length, 2); // de nulopbrengst staat er niet bij
});

test('kopers worden op opbrengst gesorteerd', () => {
  const uit = berekenAfrekening({
    posities: { klein: { U3: 1 }, groot: { U2: 3 } },
    eindstand: EINDSTAND,
  });
  assert.equal(uit[0].koperId, 'groot');
  assert.equal(uit[0].roem, 9);
  assert.equal(uit[1].koperId, 'klein');
  assert.equal(uit[1].roem, 2);
});

test('een doelwit dat niet in de eindstand staat levert niets op', () => {
  // Bijvoorbeeld een lid dat door het tribunaal uit het genootschap is gezet.
  const uit = berekenAfrekening({ posities: { U1: { verdwenen: 3 } }, eindstand: EINDSTAND });
  assert.deepEqual(uit, []);
});

test('afrekening is bestendig tegen een lege of rommelige beurs', () => {
  assert.deepEqual(berekenAfrekening({}), []);
  assert.deepEqual(berekenAfrekening({ posities: { U1: {} }, eindstand: EINDSTAND }), []);
  assert.deepEqual(berekenAfrekening({ posities: { U1: { U2: 0 } }, eindstand: EINDSTAND }), []);
  assert.deepEqual(berekenAfrekening({ posities: { U1: { U2: 1 } }, eindstand: [] }), []);
});
