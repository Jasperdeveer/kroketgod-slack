// ── Anoniem blijft anoniem, ook achteraf ──────────────────────────────────────
//
// Een Vloek der Slappe Korst wordt anoniem gelegd: het kanaal hoort alleen dat "een anonieme
// volgeling" hem legde. Maar koopWinkelItem schreef de NAAM van de koper in de gebeurtenis
// ("Piet kocht een Vloek der Slappe Korst en legde die op Jan (−4)"), en die tekst ging het
// blijvende archief in. Daarmee onthulden `/kroketgod archief vloek`, het weekoverzicht en de
// Kroketkroniek wie de vloek legde. Zelfs de prijs verraadde iets: die hangt af van de rang.
//
// Deze module levert de neutrale tekst voor nieuwe vloeken en de herschrijving voor wat er al
// lag. Het `actorId`-veld in weekgebeurtenissen.json mag blijven: dat is structureel en komt
// alleen op het dashboard achter Tailscale en een token.
//
// Puur: geen I/O. De migratie die de bestanden herschrijft staat in index.js.
// Zie anoniem.test.js.

'use strict';

const ANONIEM = 'een anonieme volgeling';

// De gebeurtenistekst voor een nieuwe vloek: geen koper, geen prijs.
function vloekGelegdTekst(doelNaam) {
  return `Een anonieme volgeling legde een Vloek der Slappe Korst op ${doelNaam}`;
}

// Het oude formaat, met of zonder prijs erachter. De koper is groep 1, het doelwit groep 2.
const VLOEK_OUD = /^(.+?) kocht een Vloek der Slappe Korst en legde die op (.+?)(?:\s*\(\s*[−-]\s*\d+\s*\))?\s*$/;

// Herschrijft één regel in het oude formaat. Geeft { tekst, koper } of null als de regel niet
// in het oude formaat staat — dus ook null voor een regel die al herschreven is, en daarmee is
// de migratie idempotent op inhoud.
function anonimiseerVloekRegel(tekst) {
  const m = typeof tekst === 'string' ? tekst.match(VLOEK_OUD) : null;
  if (!m) return null;
  return { tekst: vloekGelegdTekst(m[2].trim()), koper: m[1].trim() };
}

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// De Kroketkroniek is proza van het model, dus daar staat de oude regel niet letterlijk in. Best
// effort: in elke zin die over een vloek gaat, wordt de naam van een bekende koper vervangen
// door "een anonieme volgeling". Alleen zinnen over een vloek, zodat de rest van de aflevering
// (waarin dezelfde persoon iets heel anders deed) intact blijft.
//
// De namen gaan er eerst uit als placeholder: bijnamen als "Mr. KroketPet" bevatten zelf een
// punt, en die zou anders de zin halverwege de naam afbreken.
function anonimiseerKroniek(tekst, koperNamen) {
  const namen = [...new Set((koperNamen || []).filter(n => typeof n === 'string' && n.trim()))]
    .sort((a, b) => b.length - a.length);                // langste eerst: "Piet Jan" vóór "Piet"
  if (typeof tekst !== 'string' || !namen.length) return { tekst, gewijzigd: false };
  const gevonden = [];
  let werk = tekst;
  for (const naam of namen) {
    werk = werk.replace(new RegExp(escapeRe(naam), 'gi'), (m) => `\u0000${gevonden.push(m) - 1}\u0000`);
  }
  if (!gevonden.length) return { tekst, gewijzigd: false };
  let gewijzigd = false;
  // Zinnen, inclusief hun scheidingsteken, zodat samenvoegen de tekst exact teruggeeft.
  const zinnen = werk.match(/[^.!?…\n]*(?:[.!?…]+|\n+|$)/g) || [werk];
  const uit = zinnen.map((zin) => {
    if (!/vloek|vervloek/i.test(zin)) return zin;
    return zin.replace(/\u0000(\d+)\u0000/g, (_, i, offset) => {
      gewijzigd = true;
      // Aan het begin van de zin (eventueel na opmaak als *, _ of >) met een hoofdletter.
      const ervoor = zin.slice(0, offset);
      return /^[\s*_>~"'“‘(-]*$/.test(ervoor) ? 'Een anonieme volgeling' : ANONIEM;
    });
  });
  const hersteld = uit.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => gevonden[Number(i)]);
  return { tekst: hersteld, gewijzigd };
}

module.exports = {
  ANONIEM, VLOEK_OUD, vloekGelegdTekst, anonimiseerVloekRegel, anonimiseerKroniek,
};
