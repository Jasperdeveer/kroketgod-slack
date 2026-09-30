// ── De Dubbele Korst ──────────────────────────────────────────────────────────
// Doen twee VERSCHILLENDE leden dezelfde daad binnen negentig minuten in het donker — na 16:00
// of in het weekend — dan telt de Raad dat als één korst en beloont beiden, zonder er op dat
// moment iets over te zeggen.
//
// Het enige onderdeel dat COÖRDINATIE afdwingt in plaats van een handeling op een ander lid, en
// het enige dat in het weekend werkt: de weekendrust-guard staat niet op `reaction_added`, en
// deze mechaniek post op het moment zelf niets.
//
// Pure functies; de opslag en de verkondiging staan in index.js. Zie lib/dubbelekorst.test.js.

'use strict';

// Het stille venster: op een werkdag vanaf 16:00 tot 09:00 de volgende ochtend, plus het hele
// weekend. Afgeleid uit het Amsterdamse uur en de weekdag, dus niets persistent en
// downtime-proof.
function inStilVenster({ uur, weekend }) {
  if (weekend) return true;
  return uur >= 16 || uur < 9;
}

// Hoe lang twee daden uit elkaar mogen liggen om nog één korst te vormen.
const KORST_VENSTER_MS = 90 * 60_000;

// ALLEEN daden die telActie per aanroep voor precies ÉÉN userId boekt. Dit is de reparatie van
// het fatale bezwaar: een duel boekt `duel` voor beide partijen in dezelfde tel (index.js roept
// telActie twee keer aan), en een gesneuvelde raid deelt `raid_overwonnen` in één keer aan alle
// strijders uit. Zulke daden zouden met zichzelf matchen en gratis een korst opleveren zonder
// dat er iets gecoördineerd is.
const SOLO_DADEN = new Set([
  'offer', 'eer_gegeven', 'kroketje_gegeven', 'visioen',
  'winkel_koop', 'beurs_koop', 'veiling_bod', 'bingo_claim', 'raid_aanval',
]);

// Beoordeelt of een nieuwe daad een korst sluit. `open` is de lijst openstaande daden:
// [{ userId, actie, ts }]. Geeft de bijgewerkte lijst terug, plus het paar als er een korst valt.
function weegDaad(open, { userId, actie, ts }) {
  if (!SOLO_DADEN.has(actie)) return { open, korst: null };
  const vers = (open || []).filter(e => ts - e.ts <= KORST_VENSTER_MS);
  const match = vers.find(e => e.actie === actie && e.userId !== userId);
  if (match) {
    // De korst sluit: beide daden verdwijnen, zodat een derde deelnemer niet nóg een korst
    // op dezelfde twee kan stapelen.
    return {
      open: vers.filter(e => e !== match),
      korst: { actie, leden: [match.userId, userId], ts },
    };
  }
  // Eén openstaande daad per lid per actie: twee offers van dezelfde persoon binnen het venster
  // mogen niet twee kansen op een match geven.
  return {
    open: [...vers.filter(e => !(e.userId === userId && e.actie === actie)), { userId, actie, ts }],
    korst: null,
  };
}

// Wat een korst oplevert. Klein en gelijk voor beiden: dit is een bonus voor toeval met een
// vleugje opzet, geen inkomstenbron.
const KORST_PUNTEN = 1;

// Hoeveel korsten er per lid per weekvenster meetellen. Zonder plafond kunnen twee leden
// afspreken om elke avond om 20:00 te offeren en is het een abonnement.
const KORST_MAX_PER_WEEK = 3;

function korstenDezeWeek(geschiedenis, userId, weekStart) {
  return (geschiedenis || []).filter(k => k.weekStart === weekStart && k.leden.includes(userId)).length;
}

module.exports = {
  inStilVenster, KORST_VENSTER_MS, SOLO_DADEN,
  weegDaad, KORST_PUNTEN, KORST_MAX_PER_WEEK, korstenDezeWeek,
};
