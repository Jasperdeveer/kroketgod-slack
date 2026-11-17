// ── De regisseur: de Kroket God beslist zelf (pure kern) ─────────────────────
//
// Een regieboek (REGIEBOEK) met ingrepen, verrassingen en praatjes, en een kiezer (kiesIngreep) die per
// tik hoogstens één daarvan kiest, met alle plafonds. Puur: geen I/O, geen klok, geen Math.random. Elke
// tijdafhankelijke functie krijgt `nu` (epoch-ms), elke willekeurige keuze een `rng` (() => [0,1)).
// Dag- en weekgrenzen lopen via amsMoment (Europe/Amsterdam), want het proces draait op TZ=UTC.
// Het effect van een ingreep staat hier niet: index.js voert uit, kondigt aan en boekt (boek/boekNawerking).
//
// ── staat (regie.json) ──
//   { schatkist: n,
//     effecten: [{ id, soort, tot, data }],
//     log: [{ ts, id, laag: 'ingreep'|'verrassing'|'praatje'|'nawerking', doel, punten, soort, schorsing? }],
//     verrassing: null | {...} }          // lopende verrassing, alleen doorgegeven
//   Een ontbrekend veld telt als leeg. Logregels met laag 'nawerking' (uitbetalingen achteraf) tellen mee
//   voor ruimte() maar niet voor dagbudget, tempo, afkoeltijd of doelwitregels.
//
// ── stand (door index.js gevuld; `nu`, `weekdag` en `minuutVanDag` rekent de kiezer zelf uit) ──
//   { leden: [{ id, score,                // weekscore
//               actiefVandaag,            // bericht of spel vandaag
//               werkdagenStil,            // werkdagen op rij zonder activiteit
//               verbannen, afwezig, gast, // nooit doelwit
//               zegen, goudenKorst,       // alleen voor de uitvoerder (afketsen); de kiezer negeert ze
//               geleKaartDezeWeek, vergrijpVandaag,
//               casino: { spellen, netto, winreeks },   // vandaag; netto = winst min verlies
//               duelGewonnenVandaag }],
//     casino: { spellenVandaag, open },
//     raid: { actief, hp, maxHp, weekdag, strijders, leden, extraAanvalVandaag },
//     kanaal: { laatsteLidBerichtMs },    // laatste bericht van een lid, epoch-ms (of null)
//     archiefKandidaat }                  // truthy als er een lidbericht van precies een maand geleden is
//   De loterijtrekking (vrijdag 16:00) is hier ingebakken: er is geen veld voor.
//
// ── keuze (resultaat van kiesIngreep) ──
//   { ingreep, doel, punten, duurMinuten, reden }
//   punten: wat nu direct wordt geboekt (+ geven, - nemen), al begrensd door plafonds en saldo.
//   Wat later pas wordt uitbetaald (knop, verrassing) boekt de uitvoerder met boekNawerking. `omvang` wordt
//   alleen bij het kiezen gecontroleerd en niet gereserveerd: de uitvoerder (index.js) begrenst elke
//   uitbetaling achteraf zelf tegen ruimte() op het moment van uitbetalen.

'use strict';

const UUR = 3_600_000;
const DAG = 86_400_000;

const PLAFOND = { geven: 15, nemen: 10, nemenPerLid: 5, schorsing: 1 };
const NIVEAUS = {
  uit: { kans: 0, perDag: 0 },
  laag: { kans: 0.08, perDag: 2 },
  normaal: { kans: 0.15, perDag: 4 },
  wild: { kans: 0.25, perDag: 7 },
};
const VERRASSING_KANS = 0.03;
const VERRASSINGEN_PER_WEEK = 2;
// ~27 tikken per werkdag: 1 - (1 - 0,06)^27 ≈ 0,81, dus op ongeveer 4 van de 5 werkdagen een praatje.
const PRAATJE_KANS = 0.06;
const TEMPO_MINUTEN = 45;
const VENSTER = { van: 8 * 60 + 30, tot: 17 * 60 + 30 }; // minuten sinds middernacht, Amsterdam
const LOG_DAGEN = 21;

// ── Tijd (Amsterdam) ──
const AMS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function isoWeek(dag) {
  const d = new Date(`${dag}T00:00:00Z`); // middernacht: een halve dag extra zou de week een te hoog maken
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // de donderdag van deze ISO-week
  const jaar = d.getUTCFullYear();
  const nr = Math.ceil(((d - Date.UTC(jaar, 0, 1)) / DAG + 1) / 7);
  return `${jaar}-W${String(nr).padStart(2, '0')}`;
}

// { dag: 'JJJJ-MM-DD', weekdag: 1..7 (maandag=1), minuut: sinds middernacht, week: 'JJJJ-Www' }
function amsMoment(nu) {
  const p = Object.fromEntries(AMS.formatToParts(nu).map((x) => [x.type, x.value]));
  const dag = `${p.year}-${p.month}-${p.day}`;
  return { dag, weekdag: new Date(`${dag}T12:00:00Z`).getUTCDay() || 7, minuut: Number(p.hour) * 60 + Number(p.minute), week: isoWeek(dag) };
}
const gisterenVan = (dag) => new Date(Date.parse(`${dag}T12:00:00Z`) - DAG).toISOString().slice(0, 10);

// ── Hulpjes voor de regels ──
const kies = (lijst, rng) => lijst[Math.min(lijst.length - 1, Math.floor(rng() * lijst.length))];
const basis = (s) => s.leden.filter((l) => !l.gast && !l.verbannen && !l.afwezig);
const doelen = (s) => basis(s).filter((l) => s.mag(l.id));
const actief = (s) => doelen(s).filter((l) => l.actiefVandaag);
const rang = (s) => [...basis(s)].sort((a, b) => b.score - a.score);
const koploper = (s) => {
  const r = rang(s);
  return r.length >= 2 && r[0].score - r[1].score >= 15 && s.mag(r[0].id) ? r[0] : null;
};
const scoreVan = (s, id) => s.leden.find((l) => l.id === id)?.score ?? 0;
const open = (s) => s.casino.open !== false;
const spellen = (s) => s.casino.spellenVandaag || 0;
const kleem = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const ingreep = (o) => ({ laag: 'ingreep', gewicht: 1, afkoelUren: 12, maxPerDag: 1, punten: 0, duurMinuten: 0, kiesDoel: () => null, ...o });
const verrassing = (o) => ingreep({ laag: 'verrassing', soort: 'verrassing', afkoelUren: LOG_DAGEN * 24, ...o });
const praatje = (o) => ingreep({ laag: 'praatje', soort: 'praatje', afkoelUren: 48, ...o });

// Veld `effect`: het effect dat de ingreep zet; `botst`: effecten waarmee hij niet tegelijk mag lopen.
// Veld `omvang`: wat de ingreep later nog kan geven of nemen (alleen gecontroleerd tegen de plafonds).
const REGIEBOEK = [
  // ── Geven ──
  ingreep({ id: 'huis_geeft', soort: 'geven', gewicht: 2, afkoelUren: 24,
    voorwaarde: (s) => s.minuutVanDag >= 12 * 60 && open(s) && spellen(s) < 3,
    reden: (s) => `er waren vandaag pas ${spellen(s)} spellen`,
    opdracht: 'Het Huis geeft iedereen vandaag 3 extra casinospellen.' }),
  ingreep({ id: 'gunst_stil', soort: 'geven', afkoelUren: 24, omvang: { geven: 2 },
    voorwaarde: (s) => doelen(s).some((l) => l.werkdagenStil >= 3),
    kiesDoel: (s, rng) => kies(doelen(s).filter((l) => l.werkdagenStil >= 3), rng).id,
    reden: (s, doel) => `${s.leden.find((l) => l.id === doel)?.werkdagenStil} werkdagen stil`,
    opdracht: 'Spreek een stil lid aan en geef het een knop: binnen een uur drukken is 2 punten.' }),
  ingreep({ id: 'loterij_gevuld', soort: 'geven', punten: 3, afkoelUren: 24,
    voorwaarde: (s) => s.weekdag === 4 || (s.weekdag === 5 && s.minuutVanDag < 16 * 60),
    reden: () => 'de trekking komt eraan',
    opdracht: 'Doe 3 punten in de pot van de Frituurloterij.' }),

  // ── Nemen ──
  ingreep({ id: 'belasting', soort: 'nemen', afkoelUren: 48,
    voorwaarde: (s) => !!koploper(s),
    kiesDoel: (s) => koploper(s).id,
    punten: (s, doel) => -kleem(Math.round(scoreVan(s, doel) * 0.1), 2, 5),
    reden: (s) => { const r = rang(s); return `staat ${r[0].score - r[1].score} punten voor`; },
    opdracht: 'De koploper van de week draagt belasting af aan de Schatkist.' }),
  ingreep({ id: 'beslag', soort: 'nemen', afkoelUren: 24, punten: -3,
    voorwaarde: (s) => doelen(s).some((l) => l.casino.netto >= 10),
    kiesDoel: (s) => doelen(s).filter((l) => l.casino.netto >= 10).sort((a, b) => b.casino.netto - a.casino.netto)[0].id,
    reden: (s, doel) => `won vandaag ${s.leden.find((l) => l.id === doel).casino.netto} punten in het casino`,
    opdracht: 'Wie vandaag groot won in het casino, verliest 3 punten aan de Schatkist.' }),
  ingreep({ id: 'schorsing', soort: 'nemen', gewicht: 0.5, afkoelUren: 72, schorsing: true, duurMinuten: 60,
    voorwaarde: (s) => doelen(s).some((l) => l.geleKaartDezeWeek || l.vergrijpVandaag),
    kiesDoel: (s, rng) => kies(doelen(s).filter((l) => l.geleKaartDezeWeek || l.vergrijpVandaag), rng).id,
    reden: (s, doel) => (s.leden.find((l) => l.id === doel).vergrijpVandaag ? 'een vergrijp vandaag' : 'een gele kaart deze week'),
    opdracht: 'Een uur schorsing, zonder stemming en zonder kaart, met de reden erbij.' }),

  // ── Casino ──
  ingreep({ id: 'hoge_tafel', soort: 'casino', effect: 'hogeTafel', botst: ['dicht'], duurMinuten: 60,
    voorwaarde: (s) => open(s) && (spellen(s) >= 10 || s.leden.some((l) => l.casino.winreeks >= 3)),
    reden: (s) => (spellen(s) >= 10 ? `${spellen(s)} spellen vandaag` : 'een winreeks van drie'),
    opdracht: 'Een uur lang is de maximale inzet twee keer zo hoog.' }),
  ingreep({ id: 'casino_dicht', soort: 'casino', effect: 'dicht', botst: ['hogeTafel', 'goudenUur'], afkoelUren: 24, duurMinuten: [120, 180],
    voorwaarde: (s) => open(s) && s.minuutVanDag < VENSTER.tot - 60 && (spellen(s) >= 15 || s.leden.some((l) => l.casino.netto <= -10)),
    reden: (s) => (spellen(s) >= 15 ? `${spellen(s)} spellen vandaag` : 'iemand verloor vandaag 10 punten of meer'),
    opdracht: 'Het casino gaat twee tot drie uur dicht: de frituur wordt gereinigd.' }),
  ingreep({ id: 'gouden_uur', soort: 'casino', effect: 'goudenUur', botst: ['dicht'], duurMinuten: 60,
    voorwaarde: (s) => open(s), omvang: { geven: 5 },
    reden: () => 'het Huis is gul',
    opdracht: 'Een uur lang betaalt één spel anderhalf keer uit, met hoogstens 5 extra punten per spel.' }),

  // ── Grillen ──
  ingreep({ id: 'duelverbod', soort: 'gril', effect: 'duelverbod', botst: ['uitdaging'], duurMinuten: 120,
    voorwaarde: () => true, reden: () => 'de Kroket God wil rust',
    opdracht: 'Twee uur lang mag niemand duelleren.' }),
  ingreep({ id: 'inflatie', soort: 'gril', effect: 'inflatie', botst: ['uitverkoop'], duurMinuten: 60,
    voorwaarde: () => true, reden: () => 'de frituurolie werd duurder',
    opdracht: 'Een uur lang is alles in de Aflatenhandel twee keer zo duur.' }),
  ingreep({ id: 'uitverkoop', soort: 'gril', effect: 'uitverkoop', botst: ['inflatie'], duurMinuten: 60,
    voorwaarde: () => true, reden: () => 'de Kroket God is mild gestemd',
    opdracht: 'Een uur lang is alles in de Aflatenhandel 1 punt goedkoper, met een minimum van 1.' }),
  ingreep({ id: 'dubbele_eer', soort: 'gril', effect: 'dubbeleEer', duurMinuten: 60,
    voorwaarde: () => true, reden: () => 'eer verdient meer eer',
    opdracht: 'Een uur lang telt elke eer één klasse hoger, voor iedereen.' }),

  // ── Toespraak en weekvijand ──
  ingreep({ id: 'koploper_uitdagen', soort: 'toespraak', botst: ['duelverbod'], duurMinuten: 120, omvang: { geven: 3 },
    voorwaarde: (s) => basis(s).length >= 3,
    reden: (s) => `${rang(s)[0].id} staat bovenaan`,
    opdracht: 'Daag de koploper uit om de hekkensluiter tot een duel uit te dagen; wint de hekkensluiter, dan 3 punten.' }),
  ingreep({ id: 'extra_aanvalsdag', soort: 'weekvijand', afkoelUren: 24,
    voorwaarde: (s) => (s.weekdag === 3 || s.weekdag === 4) && !!s.raid.actief && !s.raid.extraAanvalVandaag
      && s.raid.maxHp > 0 && s.raid.hp / s.raid.maxHp > 0.6 && s.raid.strijders * 2 < s.raid.leden,
    reden: (s) => `de vijand staat nog op ${Math.round((s.raid.hp / s.raid.maxHp) * 100)}%`,
    opdracht: 'Er komt een extra aanvalsdag op de weekvijand.' }),

  // ── Verrassingen (zeldzaam) ──
  verrassing({ id: 'hete_kroket', omvang: { geven: 1, nemen: 3 }, duurMinuten: 90,
    voorwaarde: (s) => actief(s).length >= 3,
    kiesDoel: (s, rng) => kies(actief(s), rng).id,
    reden: () => 'de frituur is te heet', opdracht: 'Een gloeiende kroket met een knop "Geef door"; na 90 minuten ontploft hij.' }),
  verrassing({ id: 'flitsopdracht', omvang: { geven: 3 }, duurMinuten: 10,
    voorwaarde: (s) => actief(s).length >= 2,
    reden: () => 'hij verveelt zich', opdracht: 'Wie binnen tien minuten iets doet dat de bot kan controleren, krijgt 3 punten.' }),
  verrassing({ id: 'raadsel', omvang: { geven: 5 }, duurMinuten: 60,
    voorwaarde: () => true,
    reden: () => 'hij verstopte een schat', opdracht: 'Een raadsel met een vast antwoord; de eerste goede antwoorder krijgt 5 punten.' }),
  verrassing({ id: 'stadhouder', duurMinuten: 60,
    voorwaarde: (s) => actief(s).length >= 1,
    kiesDoel: (s, rng) => kies(actief(s), rng).id,
    reden: () => 'de Kroket God leent zijn macht', opdracht: 'Een actief lid krijgt een uur lang een deel van zijn macht.' }),
  verrassing({ id: 'herverdeling', omvang: { geven: 8, nemen: 8 },
    voorwaarde: (s) => { const r = rang(s); return r.length >= 4 && r[0].score - r[r.length - 1].score > 40; },
    reden: (s) => { const r = rang(s); return `${r[0].score - r[r.length - 1].score} punten verschil tussen eerste en laatste`; },
    opdracht: 'Van de twee hoogste weekscores elk 10% (hoogstens 4), verdeeld onder de twee laagsten.' }),
  verrassing({ id: 'archief_spreekt', omvang: { geven: 1 },
    voorwaarde: (s) => !!s.archiefKandidaat,
    reden: () => 'het Archief onthoudt alles', opdracht: 'Een bericht van precies een maand geleden, met een oordeel: zegen of berisping.' }),
  verrassing({ id: 'bliksem', soort: 'verrassing',
    voorwaarde: (s) => !!s.raid.actief && s.raid.hp > 0,
    reden: () => 'hij mengt zich in de strijd', opdracht: 'Een bliksemschicht op de weekvijand, of juist een heling als hij te snel valt.' }),
  verrassing({ id: 'omgekeerd_uur', effect: 'omgekeerdUur', duurMinuten: 60, omvang: { geven: 5, nemen: 5 },
    voorwaarde: () => true,
    reden: () => 'de wereld staat op zijn kop', opdracht: 'Een uur lang krijgt de verliezer van een duel of casinospel de punten van de winnaar.' }),
  verrassing({ id: 'puntenregen', gewicht: 2, afkoelUren: 72, omvang: { geven: 3 },
    voorwaarde: () => true,
    reden: () => 'het regent punten', opdracht: 'De volgende drie leden die iets zeggen, krijgen elk 1 punt.' }),
  verrassing({ id: 'woede_bij_stilte', gewicht: 2, afkoelUren: 72, duurMinuten: 15,
    omvang: (s) => ({ geven: 1, nemen: Math.min(basis(s).length, PLAFOND.nemen) }), // de uitvoerder kapt de echte uitbetaling af
    voorwaarde: (s) => s.weekdag <= 5 && s.kanaal.laatsteLidBerichtMs != null && s.nu - s.kanaal.laatsteLidBerichtMs >= 3 * UUR,
    reden: () => 'het kanaal is drie uur stil', opdracht: 'Zegt niemand binnen 15 minuten iets, dan verliest iedereen 1 punt; wie wel iets zegt, krijgt 1 punt.' }),

  // ── Praatjes (eigen baan: max 1 per dag, tellen niet voor het dagbudget) ──
  praatje({ id: 'casinoroddel', voorwaarde: (s) => open(s) && spellen(s) >= 1, reden: () => 'het casino praat', opdracht: 'Een roddel uit het casino.' }),
  praatje({ id: 'kroketfeitje', voorwaarde: () => true, reden: () => 'kennis is macht', opdracht: 'Een kroketfeitje.' }),
  praatje({ id: 'gedachte', voorwaarde: () => true, reden: () => 'hij dacht na', opdracht: 'Een spontane gedachte van de Kroket God.' }),
];

// ── Staat ──
const nieuweStaat = () => ({ schatkist: 0, effecten: [], log: [], verrassing: null });
const norm = (staat) => ({ ...nieuweStaat(), ...staat });

// Wat er vandaag nog mag (plafonds per dag, Amsterdamse dag).
function ruimte(staat, nu) {
  const dag = amsMoment(nu).dag;
  const rijen = (staat?.log || []).filter((r) => amsMoment(r.ts).dag === dag);
  const som = (f) => rijen.reduce((a, r) => a + f(r), 0);
  const genomen = (r) => Math.max(-(r.punten || 0), 0);
  return {
    geven: Math.max(0, PLAFOND.geven - som((r) => Math.max(r.punten || 0, 0))),
    nemen: Math.max(0, PLAFOND.nemen - som(genomen)),
    nemenVan: (id) => Math.max(0, PLAFOND.nemenPerLid - som((r) => (r.doel === id ? genomen(r) : 0))),
    schorsing: Math.max(0, PLAFOND.schorsing - rijen.filter((r) => r.schorsing).length),
  };
}

const effectActief = (staat, soort, nu) => (staat?.effecten || []).filter((e) => e.soort === soort && e.tot > nu).sort((a, b) => b.tot - a.tot)[0] || null;
const voegEffectToe = (staat, effect) => ({ ...norm(staat), effecten: [...norm(staat).effecten, effect] });
const ruimOp = (staat, nu) => ({
  ...norm(staat),
  effecten: norm(staat).effecten.filter((e) => e.tot > nu),
  log: norm(staat).log.filter((r) => r.ts >= nu - LOG_DAGEN * DAG),
});

// Punten uit de Schatkist; wat daar niet in zit, wordt geschapen (zoals het zakgeld).
function betaal(staat, punten) {
  const s = norm(staat);
  const uitSchatkist = Math.min(s.schatkist, Math.max(0, punten));
  return { staat: { ...s, schatkist: s.schatkist - uitSchatkist }, uitSchatkist, geschapen: Math.max(0, punten) - uitSchatkist };
}
const stort = (staat, punten) => ({ ...norm(staat), schatkist: norm(staat).schatkist + punten });

function boek(staat, keuze, { nu, punten = keuze.punten ?? 0 }) {
  const s = norm(staat);
  const { id, laag, soort, schorsing } = keuze.ingreep;
  const rij = { ts: nu, id, laag, doel: keuze.doel ?? null, punten, soort, ...(schorsing ? { schorsing: true } : {}) };
  return { ...s, log: [...s.log, rij] };
}
// Een uitbetaling achteraf (knop, uitkomst van een verrassing, terugdraaiing): telt voor ruimte(), niet voor het budget.
function boekNawerking(staat, { nu, id, doel = null, punten = 0, schorsing = false }) {
  const s = norm(staat);
  const rij = { ts: nu, id, laag: 'nawerking', doel, punten, soort: punten < 0 ? 'nemen' : 'geven', ...(schorsing ? { schorsing: true } : {}) };
  return { ...s, log: [...s.log, rij] };
}

// ── De kiezer ──
function gewogen(kandidaten, rng) {
  const totaal = kandidaten.reduce((a, k) => a + k.gewicht, 0);
  let r = rng() * totaal;
  for (const k of kandidaten) if ((r -= k.gewicht) < 0) return k;
  return kandidaten[kandidaten.length - 1];
}

function kiesIngreep(stand, staat, { nu, rng, niveau = 'normaal', forceer = false, beschikbaar } = {}) {
  const st = norm(staat);
  const t = amsMoment(nu);
  const cfg = NIVEAUS[niveau] || NIVEAUS.normaal;
  if (!forceer) {
    if (niveau === 'uit') return null;
    if (t.weekdag > 5 || t.minuut < VENSTER.van || t.minuut >= VENSTER.tot) return null;
  }
  // Vaste volgorde van trekkingen, zodat een testrng voorspelbaar is: verrassing, ingreep, praatje.
  const [rV, rI, rP] = forceer ? [0, 0, 0] : [rng(), rng(), rng()];

  const rijen = st.log.map((r) => ({ ...r, ...amsMoment(r.ts) }));
  const vandaag = rijen.filter((r) => r.dag === t.dag);
  const echt = (r) => r.laag !== 'nawerking';
  const ingrepenVandaag = vandaag.filter((r) => r.laag === 'ingreep');
  const laatsteTempo = Math.max(0, ...rijen.filter((r) => r.laag === 'ingreep' || r.laag === 'verrassing').map((r) => r.ts));
  const tempoOk = nu - laatsteTempo >= TEMPO_MINUTEN * 60_000;
  const laatsteIngreep = [...ingrepenVandaag].sort((a, b) => b.ts - a.ts)[0];
  const ruim = ruimte(st, nu);

  const doelenVandaag = new Set(vandaag.filter((r) => echt(r) && r.doel).map((r) => r.doel));
  const gisteren = gisterenVan(t.dag);
  const gestraftGisteren = new Set(rijen.filter((r) => r.dag === gisteren && (echt(r) || r.schorsing) && (r.soort === 'nemen' || r.schorsing) && r.doel).map((r) => r.doel));
  const effectOp = (soort) => !!effectActief(st, soort, nu);

  function maak(i) {
    if (beschikbaar && !(beschikbaar instanceof Set ? beschikbaar : new Set(beschikbaar)).has(i.id)) return null;
    const eigen = rijen.filter((r) => r.id === i.id && echt(r));
    if (eigen.some((r) => nu - r.ts < i.afkoelUren * UUR)) return null;
    if (eigen.filter((r) => r.dag === t.dag).length >= i.maxPerDag) return null;
    if ((i.effect && effectOp(i.effect)) || (i.botst || []).some(effectOp)) return null;
    if (i.schorsing && ruim.schorsing < 1) return null;

    const mag = (id) => !doelenVandaag.has(id) && !(i.soort === 'nemen' && gestraftGisteren.has(id));
    const s = { casino: {}, raid: {}, kanaal: {}, leden: [], ...stand, nu, weekdag: t.weekdag, minuutVanDag: t.minuut, mag };
    if (!i.voorwaarde(s)) return null;

    const doel = i.kiesDoel(s, rng) ?? null;
    let punten = typeof i.punten === 'function' ? i.punten(s, doel) : i.punten;
    if (punten < 0) { // nooit onder nul, en binnen de plafonds per dag en per lid
      punten = -Math.min(-punten, doel ? scoreVan(s, doel) : Infinity, ruim.nemen, doel ? ruim.nemenVan(doel) : Infinity);
      if (punten === 0) return null;
    }
    const o = typeof i.omvang === 'function' ? i.omvang(s) : i.omvang || {};
    if ((o.geven ?? Math.max(punten, 0)) > ruim.geven || (o.nemen ?? Math.max(-punten, 0)) > ruim.nemen) return null;

    const nuNemen = laatsteIngreep?.soort === 'nemen' && i.laag === 'ingreep' && i.soort === 'geven';
    return { i, s, doel, punten, gewicht: i.gewicht * (nuNemen ? 2 : 1) };
  }

  const uit = (k) => {
    const d = k.i.duurMinuten;
    const duurMinuten = Array.isArray(d) ? d[0] + Math.floor(rng() * (d[1] - d[0] + 1)) : d;
    return { ingreep: k.i, doel: k.doel, punten: k.punten, duurMinuten, reden: k.i.reden?.(k.s, k.doel) };
  };
  const probeer = (laag) => {
    const kandidaten = REGIEBOEK.filter((i) => i.laag === laag).map(maak).filter(Boolean);
    return kandidaten.length ? uit(gewogen(kandidaten, rng)) : null;
  };

  if (!forceer && tempoOk && rV < VERRASSING_KANS
    && !vandaag.some((r) => r.laag === 'verrassing')
    && rijen.filter((r) => r.laag === 'verrassing' && r.week === t.week).length < VERRASSINGEN_PER_WEEK) {
    const v = probeer('verrassing');
    if (v) return v;
  }
  if ((forceer || (tempoOk && rI < cfg.kans && ingrepenVandaag.length < cfg.perDag))) {
    const g = probeer('ingreep');
    if (g) return g;
  }
  if ((forceer || rP < PRAATJE_KANS) && !vandaag.some((r) => r.laag === 'praatje')) return probeer('praatje');
  return null;
}

module.exports = {
  REGIEBOEK, NIVEAUS, PLAFOND, VERRASSING_KANS, PRAATJE_KANS, TEMPO_MINUTEN,
  amsMoment, nieuweStaat, kiesIngreep, ruimte, effectActief, voegEffectToe, ruimOp, betaal, stort, boek, boekNawerking,
};
