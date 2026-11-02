// ── De weekvijand slaat terug: rekenregels ────────────────────────────────────
//
// Aanleiding (2 nov 2026): alle tien vijanden sinds augustus vielen, meestal op woensdag, door drie
// à vier strijders. Er stond nooit iets op het spel, en de vijand deed zelf niets. Nu:
//
//   STERKER. 7 HP per actief lid (was 4). Geijkt met een simulatie van het echte gedrag (4 vaste
//     strijders van de 6, 85% kans per dag, de helft offert): een gemiddelde vijand valt dan in
//     ~70% van de weken, op vrijdag; een milde (×0,8) bijna altijd op donderdag; een zware (×1,3)
//     alleen als vijf à zes leden meedoen. Met drie strijders ontsnapt hij meestal.
//   TERUGSLAG. Na elke aanval die hem niet velt slaat hij met kans terug: de aanvaller verliest
//     1 kroketpunt aan zijn BUIT. Wordt hij verslagen, dan krijgt iedereen terug wat hij verloor;
//     ontsnapt hij, dan is de buit weg. Zo is een aanval een inzet en is het vellen urgent.
//   RAZEND. Onder de helft van zijn HP slaat hij vaker terug.
//   ZIJN BEURT. Elke middag (di–vr) doet hij zelf iets: vochten er sinds zijn vorige beurt minder
//     dan de helft van de leden, dan HERSTELT hij (wie niet vecht, voedt hem); anders neemt hij
//     WRAAK op wie hem het zwaarst toetakelde.
//   WROK MET EEN EIND. Een ontsnapte vijand kwam elke week sterker terug, zonder plafond. Nu het
//     ontsnappen echt gebeurt zou dat een vijand opleveren die nooit meer valt; na twee keer terug
//     verdwijnt hij in de frituur. Hij blijft in de trekking (hij is nooit verslagen) en kan dus
//     ooit opnieuw opduiken, als nieuwe vijand zonder wrok.
//
// Puur: geen I/O, geen klok — toeval komt als argument binnen. Zie weekvijand.test.js.

'use strict';

const HP_PER_LID = 7;
const MIN_HP = 12;
const WROK_STAP = 0.2;      // +20% HP per week dat hij ongestraft terugkeert
const WROK_MAX = 2;         // hooguit twee keer terug, dan is hij weg
const TERUGSLAG_KANS = 0.25;
const TERUGSLAG_RAZEND = 0.4;
const HERSTEL_FRACTIE = 0.1;

function maxHpVoor(ledental, hpFactor = 1, wrok = 0) {
  return Math.max(MIN_HP, Math.round(ledental * HP_PER_LID * hpFactor * (1 + WROK_STAP * wrok)));
}

function isRazend(raid) {
  return raid.hp > 0 && raid.hp <= raid.maxHp / 2;
}

function slaatTerug(raid, worp) {
  return raid.hp > 0 && worp < (isRazend(raid) ? TERUGSLAG_RAZEND : TERUGSLAG_KANS);
}

// Leeft de vorige vijand nog en mag hij nog een week terugkomen?
function komtTerug(raid) {
  return !!raid.vijand && !raid.verslagen && (raid.hp ?? 0) > 0 && (raid.wrok || 0) < WROK_MAX;
}

// Zijn dagelijkse zet. `ledental`: leden die mee kunnen vechten (geen balling, niet afwezig);
// `scores`: de huidige kroketpunten, want wraak op een lege buidel is geen wraak.
function vijandBeurt(raid, ledental, scores) {
  const vochten = (raid.sindsBeurt || []).length;
  if (vochten < ledental / 2) {
    const herstel = Math.min(raid.maxHp - raid.hp, Math.max(1, Math.round(raid.maxHp * HERSTEL_FRACTIE)));
    return { soort: 'herstel', herstel, vochten };
  }
  const doelwit = Object.entries(raid.strijders || {})
    .filter(([uid]) => (scores[uid] || 0) >= 1)
    .sort((a, b) => (b[1].schade || 0) - (a[1].schade || 0))[0]?.[0] || null;
  return { soort: 'wraak', doelwit, vochten };
}

module.exports = {
  HP_PER_LID, WROK_MAX, TERUGSLAG_KANS, TERUGSLAG_RAZEND,
  maxHpVoor, isRazend, slaatTerug, komtTerug, vijandBeurt,
};
