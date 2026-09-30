// Tests voor de Vijf Ambten: aanspraak, levensteken-poort, ambtscliff, tiebreaks en de
// stichtingsbezetting. Pure functies, dus geen state of tijdelijke mappen nodig.
// Run: `npm test` of `node --test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AMBTEN,
  AMBT_KEYS,
  VENSTER_DAGEN,
  LEVENSTEKEN_DADEN,
  AMBTSCLIFF_DAGEN,
  vensterSleutels,
  snoeiVenster,
  dadenInVenster,
  aanspraakVan,
  stichtingsBezetting,
  bepaalAmbten,
  zegelBudget,
} = require('./ambten.js');

const VANDAAG = '2026-09-14'; // een maandag
const DAG = 86_400_000;

// De echte bezetting uit members.json, zodat de tests over de werkelijke rollen gaan.
const LEDEN = {
  pet:     { bijnaam: 'Mr. KroketPet',                 rol: 'Rijkscampagnecommandant' },
  inho:    { bijnaam: 'Mr. Kroketinho',                rol: 'Hoofd Rijksintelligentie & Data' },
  lang:    { bijnaam: 'Mr. Te Lang Gefrituurde Kroket', rol: 'Rijksmarketeer' },
  groene:  { bijnaam: 'De Groene Kroket',              rol: 'Opperpaneerder & Rijksontwerper' },
  fuego:   { bijnaam: 'Dhr. Kroket de Fuego',          rol: 'Rijkssmaakdiplomaat' },
};

// Hulp: zet `acties` op één dag binnen het venster.
const opDag = (dag, acties) => ({ [dag]: acties });

// ── Het venster ───────────────────────────────────────────────────────────────

test('vensterSleutels: veertien dagen, vandaag eerst, aflopend', () => {
  const s = vensterSleutels(VANDAAG);
  assert.equal(s.length, VENSTER_DAGEN);
  assert.equal(s[0], '2026-09-14');
  assert.equal(s[13], '2026-09-01');
  assert.deepEqual([...s].sort().reverse(), s, 'moet aflopend zijn');
});

test('vensterSleutels: onzinnige datum levert een leeg venster', () => {
  assert.deepEqual(vensterSleutels('geen datum'), []);
  assert.deepEqual(vensterSleutels(''), []);
});

test('vensterSleutels: rekent correct over een maandgrens', () => {
  assert.ok(vensterSleutels('2026-03-03').includes('2026-02-18'));
});

test('snoeiVenster: gooit alles buiten het venster weg en houdt de marge', () => {
  const alles = {
    pet: {
      '2026-09-14': { offer: 1 },
      '2026-09-01': { duel: 1 },   // binnen het venster
      '2026-08-20': { duel: 9 },   // ver buiten de marge
    },
  };
  const uit = snoeiVenster(alles, VANDAAG);
  assert.deepEqual(Object.keys(uit.pet).sort(), ['2026-09-01', '2026-09-14']);
});

test('snoeiVenster: een lid zonder resterende dagen verdwijnt volledig', () => {
  const uit = snoeiVenster({ pet: { '2020-01-01': { duel: 1 } } }, VANDAAG);
  assert.deepEqual(uit, {});
});

test('snoeiVenster: leegte en null zijn veilig', () => {
  assert.deepEqual(snoeiVenster(null, VANDAAG), {});
  assert.deepEqual(snoeiVenster({}, VANDAAG), {});
});

// ── Aanspraak en levensteken ──────────────────────────────────────────────────

test('dadenInVenster: telt alle acties over alle dagen', () => {
  const venster = { '2026-09-14': { offer: 2, duel: 1 }, '2026-09-10': { eer_gegeven: 3 } };
  assert.equal(dadenInVenster(venster, vensterSleutels(VANDAAG)), 6);
});

test('dadenInVenster: daden buiten het venster tellen niet mee', () => {
  const venster = { '2026-08-01': { offer: 50 } };
  assert.equal(dadenInVenster(venster, vensterSleutels(VANDAAG)), 0);
});

test('aanspraakVan: weegt per actie volgens de formule', () => {
  // Muntmeester: winkel_koop×2 + beurs_koop + veiling_bod
  const venster = opDag(VANDAAG, { winkel_koop: 3, beurs_koop: 2, veiling_bod: 1, duel: 99 });
  assert.equal(aanspraakVan(venster, AMBTEN.muntmeester.aanspraak, vensterSleutels(VANDAAG)),
    3 * 2 + 2 + 1);
});

test('aanspraakVan: acties buiten de formule dragen niets bij', () => {
  const venster = opDag(VANDAAG, { duel: 40, offer: 40 });
  assert.equal(aanspraakVan(venster, AMBTEN.heraut.aanspraak, vensterSleutels(VANDAAG)), 0);
});

// ── Stichtingsbezetting ───────────────────────────────────────────────────────

test('stichtingsBezetting: elke rol krijgt het ambt dat erbij hoort', () => {
  const b = stichtingsBezetting(LEDEN);
  assert.equal(b.muntmeester, 'lang',        'Rijksmarketeer → Muntmeester');
  assert.equal(b.heraut, 'pet',              'Rijkscampagnecommandant → Heraut');
  assert.equal(b.opperpaneerder, 'groene',   'Opperpaneerder & Rijksontwerper → Opperpaneerder');
  assert.equal(b.rekenmeester, 'inho',       'Hoofd Rijksintelligentie & Data → Rekenmeester');
  assert.equal(b.voorspraak, 'fuego',        'Rijkssmaakdiplomaat → Voorspraak');
});

test('stichtingsBezetting: alle vijf de ambten zijn vergeven en niemand dubbel', () => {
  const b = stichtingsBezetting(LEDEN);
  assert.equal(Object.keys(b).length, AMBT_KEYS.length);
  assert.equal(new Set(Object.values(b)).size, AMBT_KEYS.length);
});

test('stichtingsBezetting: leden zonder passende rol vullen deterministisch aan', () => {
  const b1 = stichtingsBezetting({ a: { bijnaam: 'Anton', rol: '' }, b: { bijnaam: 'Bea', rol: '' } });
  const b2 = stichtingsBezetting({ b: { bijnaam: 'Bea', rol: '' }, a: { bijnaam: 'Anton', rol: '' } });
  assert.deepEqual(b1, b2, 'sleutelvolgorde mag de uitkomst niet veranderen');
  assert.equal(new Set(Object.values(b1)).size, 2, 'niemand krijgt twee ambten');
});

test('stichtingsBezetting: minder leden dan ambten laat de rest vacant', () => {
  const b = stichtingsBezetting({ lang: LEDEN.lang });
  assert.equal(b.muntmeester, 'lang');
  assert.equal(Object.keys(b).length, 1);
});

test('stichtingsBezetting: geen leden levert een lege bezetting', () => {
  assert.deepEqual(stichtingsBezetting({}), {});
});

// ── De hertelling ─────────────────────────────────────────────────────────────

test('bepaalAmbten: een leeg venster laat alles vacant — niets is erfelijk', () => {
  const uit = bepaalAmbten({ members: LEDEN, vandaagSleutel: VANDAAG });
  for (const key of AMBT_KEYS) {
    assert.equal(uit[key].houderId, null, `${key} moet vacant zijn`);
    assert.equal(uit[key].reden, 'vacant');
  }
});

test('bepaalAmbten: de levensteken-poort weigert een lid met te weinig daden', () => {
  // Eén enkele winkelaankoop = 1 daad, onder LEVENSTEKEN_DADEN, maar wél aanspraak.
  const venster = { lang: opDag(VANDAAG, { winkel_koop: 1 }) };
  assert.equal(LEVENSTEKEN_DADEN, 2);
  const uit = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  assert.equal(uit.muntmeester.houderId, null, 'één daad is geen levensteken');

  // Twee daden en het ambt is wél te dragen.
  const uit2 = bepaalAmbten({
    venster: { lang: opDag(VANDAAG, { winkel_koop: 2 }) },
    members: LEDEN, vandaagSleutel: VANDAAG,
  });
  assert.equal(uit2.muntmeester.houderId, 'lang');
});

test('bepaalAmbten: de hoogste aanspraak wint het ambt', () => {
  const venster = {
    lang: opDag(VANDAAG, { winkel_koop: 5 }),  // 10
    pet:  opDag(VANDAAG, { winkel_koop: 2 }),  // 4
  };
  const uit = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  assert.equal(uit.muntmeester.houderId, 'lang');
  assert.equal(uit.muntmeester.aanspraak, 10);
});

test('bepaalAmbten: één ambt per lid — wie op twee ambten de sterkste is, krijgt het hoogste', () => {
  // `pet` is de sterkste op zowel Muntmeester (18) als Heraut (9); hij kan er maar één dragen
  // en krijgt de hoogste. `lang` heeft alléén aanspraak op Muntmeester (4) en die is dan weg.
  const venster = {
    pet:  opDag(VANDAAG, { winkel_koop: 9, opdracht_klaar: 9 }),
    lang: opDag(VANDAAG, { winkel_koop: 2 }),
  };
  const uit = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  const houders = AMBT_KEYS.map(k => uit[k].houderId).filter(Boolean);
  assert.deepEqual(houders, ['pet'], 'precies één houder');
  assert.equal(uit.muntmeester.houderId, 'pet', 'de hoogste aanspraak van het hele veld eerst');
  assert.equal(uit.heraut.houderId, null);
  assert.equal(uit.muntmeester.aanspraak, 18);
});

test('bepaalAmbten: een tweede lid met eigen aanspraak vult het andere ambt wél', () => {
  // Zodra `lang` óók een aanspraak op Heraut heeft, raken beide zetels bezet. Dit is de
  // normale situatie bij vijf leden die van alles wat doen; de vacature hierboven vraagt om
  // een lid dat op precies één ambt aanspraak heeft en daar door een ander wordt verslagen.
  const venster = {
    pet:  opDag(VANDAAG, { winkel_koop: 9, opdracht_klaar: 9 }),
    lang: opDag(VANDAAG, { winkel_koop: 2, opdracht_klaar: 3 }),
  };
  const uit = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  assert.equal(uit.muntmeester.houderId, 'pet');
  assert.equal(uit.heraut.houderId, 'lang');
});

test('bepaalAmbten: bij gelijke aanspraak breekt de rol uit de eerste codex de gelijkstand', () => {
  // Beiden 4 aanspraak op Muntmeester; `lang` is Rijksmarketeer, `fuego` niet.
  const venster = {
    lang:  opDag(VANDAAG, { winkel_koop: 2 }),
    fuego: opDag(VANDAAG, { winkel_koop: 2 }),
  };
  const uit = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  assert.equal(uit.muntmeester.houderId, 'lang');
});

test('bepaalAmbten: de rol verdient nooit een ambt op nul aanspraak', () => {
  // `lang` heeft de passende rol maar deed niets in de richting van het ambt; `fuego` wel.
  const venster = {
    lang:  opDag(VANDAAG, { duel: 5 }),          // 0 aanspraak op Muntmeester
    fuego: opDag(VANDAAG, { winkel_koop: 2 }),   // 4
  };
  const uit = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  assert.equal(uit.muntmeester.houderId, 'fuego', 'erkenning, geen benoeming');
});

test('bepaalAmbten: de ambtscliff houdt een vers gewisseld ambt op zijn plek', () => {
  const nuTs = Date.parse(`${VANDAAG}T09:10:00Z`);
  const venster = {
    pet:  opDag(VANDAAG, { winkel_koop: 2 }),   // 4  — zittende houder
    lang: opDag(VANDAAG, { winkel_koop: 9 }),   // 18 — sterker, maar te vroeg
  };
  const huidig = { muntmeester: { houderId: 'pet', sinds: nuTs - 2 * DAG } };
  const uit = bepaalAmbten({ venster, members: LEDEN, huidig, vandaagSleutel: VANDAAG, nuTs });
  assert.equal(uit.muntmeester.houderId, 'pet');
  assert.equal(uit.muntmeester.reden, 'ambtscliff');
  assert.equal(uit.muntmeester.wissel, false);
  // `vorige` MOET gevuld zijn, ook al wisselt er niets. De aanroeper leidt uit
  // `vorige === houderId` af dat het ambt behouden is; ontbreekt het veld, dan ziet hij een
  // houder zonder voorganger, meldt hij "claimt het vacante ambt" en keert hij de +3 roem
  // voor een VEROVERING elke week opnieuw uit aan iemand die alleen maar bleef zitten.
  assert.equal(uit.muntmeester.vorige, 'pet');
});

test('bepaalAmbten: elke uitkomst met een houder draagt `vorige`, zodat behouden herkenbaar is', () => {
  const nuTs = Date.parse(`${VANDAAG}T09:10:00Z`);
  const venster = Object.fromEntries(
    Object.keys(LEDEN).map(id => [id, opDag(VANDAAG, { eer_gegeven: 3, winkel_koop: 2, opdracht_klaar: 2, raid_aanval: 2, beurs_koop: 2 })]));
  // Een veld van vijf zittende houders, allemaal met een verse wissel (dus ambtscliff) en
  // allemaal met een levensteken: precies het geval waarin de bug elke week +15 roem uitkeerde.
  const huidig = Object.fromEntries(
    AMBT_KEYS.map((k, i) => [k, { houderId: Object.keys(LEDEN)[i], sinds: nuTs - DAG }]));
  const uit = bepaalAmbten({ venster, members: LEDEN, huidig, vandaagSleutel: VANDAAG, nuTs });
  for (const key of AMBT_KEYS) {
    if (!uit[key].houderId) continue;
    assert.equal(uit[key].vorige, huidig[key].houderId, `${key} verliest zijn voorganger`);
    assert.equal(uit[key].wissel, false, `${key} mag niet als wissel gelden`);
  }
});

test('bepaalAmbten: na de ambtscliff wisselt het ambt wél', () => {
  const nuTs = Date.parse(`${VANDAAG}T09:10:00Z`);
  const venster = {
    pet:  opDag(VANDAAG, { winkel_koop: 2 }),
    lang: opDag(VANDAAG, { winkel_koop: 9 }),
  };
  const huidig = { muntmeester: { houderId: 'pet', sinds: nuTs - (AMBTSCLIFF_DAGEN + 1) * DAG } };
  const uit = bepaalAmbten({ venster, members: LEDEN, huidig, vandaagSleutel: VANDAAG, nuTs });
  assert.equal(uit.muntmeester.houderId, 'lang');
  assert.equal(uit.muntmeester.reden, 'veroverd');
  assert.equal(uit.muntmeester.vorige, 'pet');
});

test('bepaalAmbten: de ambtscliff beschermt geen houder zonder levensteken', () => {
  const nuTs = Date.parse(`${VANDAAG}T09:10:00Z`);
  const venster = { lang: opDag(VANDAAG, { winkel_koop: 3 }) }; // pet deed niets
  const huidig = { muntmeester: { houderId: 'pet', sinds: nuTs - DAG } };
  const uit = bepaalAmbten({ venster, members: LEDEN, huidig, vandaagSleutel: VANDAAG, nuTs });
  assert.equal(uit.muntmeester.houderId, 'lang', 'een stille houder houdt niets vast');
});

test('bepaalAmbten: een zittende houder die de sterkste blijft, behoudt zijn ambt', () => {
  const nuTs = Date.parse(`${VANDAAG}T09:10:00Z`);
  const venster = { lang: opDag(VANDAAG, { winkel_koop: 4 }) };
  const huidig = { muntmeester: { houderId: 'lang', sinds: nuTs - 30 * DAG } };
  const uit = bepaalAmbten({ venster, members: LEDEN, huidig, vandaagSleutel: VANDAAG, nuTs });
  assert.equal(uit.muntmeester.houderId, 'lang');
  assert.equal(uit.muntmeester.reden, 'behouden');
  assert.equal(uit.muntmeester.wissel, false);
});

test('bepaalAmbten: een uitgesloten lid (balling) draagt niets', () => {
  const venster = { lang: opDag(VANDAAG, { winkel_koop: 5 }) };
  const uit = bepaalAmbten({
    venster, members: LEDEN, vandaagSleutel: VANDAAG, uitgesloten: ['lang'],
  });
  assert.equal(uit.muntmeester.houderId, null);
});

test('bepaalAmbten: een ex-lid in `huidig` maakt de zetel vrij in plaats van hem te blokkeren', () => {
  const nuTs = Date.parse(`${VANDAAG}T09:10:00Z`);
  const venster = { lang: opDag(VANDAAG, { winkel_koop: 3 }) };
  const huidig = { muntmeester: { houderId: 'vertrokken', sinds: nuTs - DAG } };
  const uit = bepaalAmbten({ venster, members: LEDEN, huidig, vandaagSleutel: VANDAAG, nuTs });
  assert.equal(uit.muntmeester.houderId, 'lang');
});

test('bepaalAmbten: de uitkomst is deterministisch bij een volledig gelijk veld', () => {
  const venster = Object.fromEntries(
    Object.keys(LEDEN).map(id => [id, opDag(VANDAAG, { eer_gegeven: 2 })]));
  const a = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  const b = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  assert.deepEqual(a, b);
});

test('bepaalAmbten: één actief lid krijgt precies één ambt, de rest blijft vacant', () => {
  const venster = { fuego: opDag(VANDAAG, { eer_gegeven: 4, kroketje_gegeven: 3 }) };
  const uit = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  const houders = AMBT_KEYS.filter(k => uit[k].houderId);
  assert.equal(houders.length, 1);
  assert.equal(uit[houders[0]].houderId, 'fuego');
});

test('bepaalAmbten: daden verdeeld over het venster tellen net zo goed mee', () => {
  const venster = {
    lang: {
      '2026-09-14': { winkel_koop: 1 },
      '2026-09-05': { winkel_koop: 1 },
      '2026-09-02': { beurs_koop: 2 },
    },
  };
  const uit = bepaalAmbten({ venster, members: LEDEN, vandaagSleutel: VANDAAG });
  assert.equal(uit.muntmeester.houderId, 'lang');
  assert.equal(uit.muntmeester.aanspraak, 1 * 2 + 1 * 2 + 2);
});

// ── Zegelbudget ───────────────────────────────────────────────────────────────

test('zegelBudget: de norm van het ambt, plus wat de rang erbij geeft', () => {
  assert.equal(zegelBudget('heraut'), 5);
  assert.equal(zegelBudget('heraut', 2), 7);
  assert.equal(zegelBudget('opperpaneerder'), 1);
});

test('zegelBudget: nooit onder één, ook niet met een negatieve rangcorrectie', () => {
  assert.equal(zegelBudget('opperpaneerder', -5), 1);
  assert.equal(zegelBudget('muntmeester', -1), 2);
});

test('zegelBudget: een onbekend ambt levert geen zegels op', () => {
  assert.equal(zegelBudget('bestaatniet', 0), 1);
});

// ── De tabel zelf ─────────────────────────────────────────────────────────────

test('AMBTEN: elk ambt is volledig gedeclareerd', () => {
  for (const [key, def] of Object.entries(AMBTEN)) {
    assert.ok(def.naam && def.icoon && def.kort, `${key} mist een naam of icoon`);
    assert.ok(def.zegelNorm >= 1, `${key} heeft geen zegels`);
    assert.ok(def.bevoegdheid?.length > 10, `${key} mist een bevoegdheid`);
    assert.ok(Object.keys(def.aanspraak).length > 0, `${key} heeft geen aanspraakformule`);
    assert.ok(def.rolAanspraak instanceof RegExp, `${key} mist een rolAanspraak`);
  }
});

test('AMBTEN: geen twee ambten claimen dezelfde rol uit members.json', () => {
  const rollen = Object.values(LEDEN).map(l => l.rol);
  for (const rol of rollen) {
    const treffers = AMBT_KEYS.filter(k => AMBTEN[k].rolAanspraak.test(rol));
    assert.equal(treffers.length, 1, `rol "${rol}" matcht ${treffers.length} ambten: ${treffers}`);
  }
});

test('bepaalAmbten: een dubbele houder (na een waarneming) houdt hoogstens één ambt', () => {
  // Dit geval ontstaat bij een ontheffing: een zittende houder neemt een vrijgekomen zetel
  // waar en staat dan op twee stoelen, beide met een verse `sinds` — dus beide binnen de
  // ambtscliff. Zonder de vergevenAan-poort in de cliff-lus hield hij ze allebei en werd de
  // waarneming stilzwijgend bezit.
  const nuTs = Date.parse(`${VANDAAG}T09:10:00Z`);
  const venster = {
    inho: opDag(VANDAAG, { beurs_koop: 4, eer_gegeven: 4 }),
    pet:  opDag(VANDAAG, { eer_gegeven: 3, opdracht_klaar: 3 }),
  };
  const huidig = {
    rekenmeester: { houderId: 'inho', sinds: nuTs - DAG },
    voorspraak:   { houderId: 'inho', sinds: nuTs - DAG }, // de waarneming
  };
  const uit = bepaalAmbten({ venster, members: LEDEN, huidig, vandaagSleutel: VANDAAG, nuTs });
  const houders = AMBT_KEYS.map(k => uit[k].houderId).filter(Boolean);
  assert.equal(new Set(houders).size, houders.length, 'niemand mag twee ambten houden');
  assert.equal(houders.filter(h => h === 'inho').length, 1, 'inho houdt precies één ambt');
});
