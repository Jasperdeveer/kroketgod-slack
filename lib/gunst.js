// ── De Gunst: iets geven dat jóú iets kost ────────────────────────────────────
//
// Je kunt een medelid beroven, uitdagen, aanklagen, een gele kaart geven en vervloeken. Er was
// geen enkel werkwoord waarmee je hem iets kon GEVEN dat jou zelf iets kostte. Eren kost niets
// (de punten komen uit de lucht), uitlenen krijg je terug. Bij vier vrienden is dat de verkeerde
// kant op geoptimaliseerd: het spel beloont elkaar bevechten en kent geen gebaar.
//
// De Gunst is dat gebaar. Eén kroketpunt uit JOUW beurs naar die van een ander. Geen dobbel,
// geen jury, geen LLM — je drukt op een knop en je bent een punt kwijt.
//
// DE DRIE GRENZEN, en waarom ze er zijn:
//   · Hoogstens twee per week. Meer maakt het een transportmiddel in plaats van een gebaar.
//   · Hoogstens één per persoon per week. Anders is het een vaste pijplijn naar je bondgenoot.
//   · Je moet er zelf genoeg overhouden. Wie zichzelf leegschenkt kan niet meer meespelen, en
//     een gebaar dat je uit het spel duwt is geen gebaar maar een afscheid.
//
// Puur: geen I/O, geen klok zonder dat de aanroeper hem meegeeft. Zie gunst.test.js.

'use strict';

const GUNST_PER_WEEK = 2;
const GUNST_PER_PERSOON_PER_WEEK = 1;

// Wat je zelf moet overhouden ná het geven. Drie punten is genoeg om nog een duel aan te gaan
// en iets kleins te kopen; daaronder sta je buitenspel.
const GUNST_BODEM = 3;

// Roem voor netto gulheid, zondagnacht. NETTO: wat je gaf minus wat je kreeg, zodat twee leden
// die elkaar heen en weer een punt toeschuiven er per constructie niets aan overhouden.
const ROEM_PER_PUNTEN = 2;
const ROEM_MAX_PER_WEEK = 1;

function weekVan(boek, weekSleutel) {
  return (boek || {})[weekSleutel] || { gaven: [] };
}

// Alle gunsten die userId deze week GAF.
function gegevenDezeWeek(boek, userId, weekSleutel) {
  return weekVan(boek, weekSleutel).gaven.filter(g => g && g.van === userId);
}

// Mag deze gunst? Geeft { ok: true } of { ok: false, reden } met een reden die je kunt tonen.
// Bewust één functie die álle grenzen kent: verspreid over de aanroepers raakt er altijd één
// vergeten, en dan is het verschil tussen het commando en de knop een bug die niemand ziet.
function mag(boek, vanId, naarId, standVan, weekSleutel) {
  if (!vanId || !naarId) return { ok: false, reden: 'onbekend lid' };
  if (vanId === naarId) return { ok: false, reden: 'U kunt uzelf niets gunnen. Dat heet sparen.' };
  const eigen = gegevenDezeWeek(boek, vanId, weekSleutel);
  if (eigen.length >= GUNST_PER_WEEK) {
    return { ok: false, reden: `U heeft uw ${GUNST_PER_WEEK} gunsten van deze week al vergeven. Maandag mag u weer.` };
  }
  if (eigen.some(g => g.naar === naarId)) {
    return { ok: false, reden: 'U heeft deze volgeling deze week al iets gegund. Spreid uw gulheid.' };
  }
  if ((Number(standVan) || 0) - 1 < GUNST_BODEM) {
    return { ok: false, reden: `U moet er zelf ${GUNST_BODEM} overhouden. Wie zich leegschenkt speelt niet meer mee.` };
  }
  return { ok: true };
}

// Boekt de gunst in het register. Geeft een NIEUW boek terug; de aanroeper schrijft zelf weg.
// Dit verplaatst de PUNTEN niet — dat doet de aanroeper, want alleen die heeft de scores.
function boekGunst(boek, vanId, naarId, weekSleutel, nu) {
  const week = weekVan(boek, weekSleutel);
  return {
    boek: { ...boek, [weekSleutel]: { ...week, gaven: [...week.gaven, { van: vanId, naar: naarId, ts: nu }] } },
    gewijzigd: true,
  };
}

// Netto gulheid: gegeven minus ontvangen. Twee leden die elkaar om beurten een punt toeschuiven
// komen hier allebei op nul uit, en dat is precies de bedoeling — rondpompen is geen gulheid.
function nettoGulheid(boek, userId, weekSleutel) {
  const gaven = weekVan(boek, weekSleutel).gaven;
  const gegeven = gaven.filter(g => g.van === userId).length;
  const gekregen = gaven.filter(g => g.naar === userId).length;
  return gegeven - gekregen;
}

// Hoeveel roem levert die netto gulheid op. Naar beneden afgerond en hard geplafonneerd, zodat
// de Gunst nooit een roem-machine wordt naast de rangen.
function roemVoorGulheid(netto) {
  if (!Number.isFinite(netto) || netto <= 0) return 0;
  return Math.min(ROEM_MAX_PER_WEEK, Math.floor(netto / ROEM_PER_PUNTEN));
}

// De uitkering van zondagnacht: per lid de netto gulheid en de roem die dat oplevert.
// Alleen leden die werkelijk iets overhielden komen in de lijst.
function uitkering(boek, ledenIds, weekSleutel) {
  return ledenIds
    .map(id => ({ id, netto: nettoGulheid(boek, id, weekSleutel) }))
    .map(r => ({ ...r, roem: roemVoorGulheid(r.netto) }))
    .filter(r => r.roem > 0)
    .sort((a, b) => b.netto - a.netto);
}

// Houdt het register klein: alleen de laatste weken bewaren. De uitkering is dan allang gedaan.
function ruimOudeWeken(boek, bewaarWeken = 4) {
  const sleutels = Object.keys(boek || {}).sort();
  if (sleutels.length <= bewaarWeken) return { boek, gewijzigd: false };
  const houden = new Set(sleutels.slice(-bewaarWeken));
  const uit = {};
  for (const k of sleutels) if (houden.has(k)) uit[k] = boek[k];
  return { boek: uit, gewijzigd: true };
}

module.exports = {
  GUNST_PER_WEEK, GUNST_PER_PERSOON_PER_WEEK, GUNST_BODEM,
  ROEM_PER_PUNTEN, ROEM_MAX_PER_WEEK,
  gegevenDezeWeek, mag, boekGunst, nettoGulheid, roemVoorGulheid, uitkering, ruimOudeWeken,
};
