// ── Een geheime code die ook via een tikfout niet uitlekt ─────────────────────
//
// Het Gefluisterde Voorrecht (zie pakFortuin in index.js) hangt aan een code die alleen de
// beheerder kent. De exacte code wordt bovenaan de commando-afhandeling stil opgevangen. Maar een
// tikfout viel daar doorheen: geen enkele tak herkende hem, dus belandde hij als vrije tekst bij
// de LLM, en die zette hem in een PUBLIEK antwoord in het kanaal. Eén letter verkeerd en de hele
// Illuminati kon de code lezen.
//
// Deze module zegt alleen of een invoer verdacht veel op de code LIJKT. De aanroeper geeft dan
// een kaal "onbekend commando" terug, alleen aan de beheerder zelf. De code verlaat deze module
// nooit: er komt alleen ja of nee uit.
//
// Wat telt als "lijkt op":
//   · een kleine bewerkingsafstand (een letter verkeerd, erbij, eraf of twee omgewisseld), of
//   · hetzelfde begin: de eerste vier tekens van de code, met iets erachter ("code3" voor "code 3").
// Behalve als het eerste woord een bestaand commando is: als de code toevallig met "beur" begint,
// moet `beurs` gewoon blijven werken.
//
// Puur: geen I/O. Zie geheim.test.js.

'use strict';

const PREFIX_LENGTE = 4;

// Bewerkingsafstand met omwisseling van twee buren (optimal string alignment). Stopt vroeg zodra
// de afstand boven `max` uitkomt — meer hoeven we nooit te weten.
function afstand(a, b, max = Infinity) {
  a = String(a); b = String(b);
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rijMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const kost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + kost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rijMin = Math.min(rijMin, d[i][j]);
    }
    if (rijMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

const normaliseer = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');

// Lijkt `invoer` op `code` zonder hem precies te zijn? `bekendeWoorden` = de eerste woorden van
// de bestaande commando's (een Set of array), zodat die nooit als bijna-code gelden. Mag ook een
// functie zijn die de set pas oplevert als hij nodig is.
function lijktOpCode(invoer, code, { bekendeWoorden = [] } = {}) {
  const c = normaliseer(code);
  const t = normaliseer(invoer);
  if (!c || !t) return false;
  // De exacte code (met of zonder staart) is geen bijna-treffer: die vangt de aanroeper al op.
  if (t === c || t.startsWith(`${c} `)) return false;
  const woorden = t.split(' ');
  const kandidaat = woorden.slice(0, c.split(' ').length).join(' ');
  const drempel = c.length <= PREFIX_LENGTE ? 1 : 2;
  const dichtbij = afstand(kandidaat, c, drempel) <= drempel;
  const zelfdeBegin = c.length >= PREFIX_LENGTE && kandidaat.startsWith(c.slice(0, PREFIX_LENGTE));
  if (!dichtbij && !zelfdeBegin) return false;
  const bekend = typeof bekendeWoorden === 'function' ? bekendeWoorden() : bekendeWoorden;
  const set = bekend instanceof Set ? bekend : new Set((bekend || []).map(normaliseer));
  return !set.has(woorden[0]);
}

module.exports = { afstand, lijktOpCode, PREFIX_LENGTE };
