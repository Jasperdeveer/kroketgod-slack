// ── Daglimieten: de goedkope puntenbronnen aan banden ────────────────────────
//
// Een paar bronnen in het spel kosten de speler niets en leveren toch punten op, of kosten een
// ander punten: de zondebok, de lofzang en het organische eerbewijs dat de Kroket God zelf in een
// reactie hangt. Zonder plafond is elk van die drie een knop die je net zo vaak indrukt als je
// wilt. De zondebok stond voor iedereen open, ook voor wie geen lid was, zonder wachttijd — elke
// aanroep kostte een willekeurig lid een punt en een LLM-call. De lofzang gaf bij elk prijzend
// bericht een munt op een punt, met roem en verbondszegen erbij.
//
// Eén tabel met alle grenzen, zodat er één plek is om te zien wat waar mag. Het bijhouden gaat
// per soort en per sleutel (meestal een lid, soms '*' voor de hele Raad), met de Amsterdamse
// dagsleutel erbij: een telling van gisteren telt vandaag als nul, zonder dat er een cron hoeft
// te vegen.
//
// Puur: geen I/O en geen klok — de aanroeper geeft de dag mee. Zie limieten.test.js.

'use strict';

const DAGLIMIETEN = {
  // Eén zondebok per lid per dag. Het is een grap ten koste van een ander, geen wapen.
  zondebok: 1,
  // Twee lofzangpunten per lid per dag. Meer prijzen mag altijd; het levert dan alleen een
  // zegen op, geen punt.
  lofzang: 2,
  // Het organische eerbewijs komt uit het budget van de Kroket God zelf, niet uit dat van de
  // spreker: twee per dag voor de hele Raad, en hoogstens één per ontvanger.
  organische_eer: 2,
  organische_eer_ontvanger: 1,
  // Tien casinospellen per lid per dag, blackjack en roulette samen. Geen gratis bron, maar wel
  // een knop die je anders eindeloos indrukt.
  casino: 10,
};

// Sleutel voor een limiet die voor de hele Raad samen geldt.
const IEDEREEN = '*';

function telling(boek, soort, sleutel, dag) {
  const r = boek?.[soort]?.[sleutel];
  return r && r.dag === dag ? Math.max(0, Number(r.aantal) || 0) : 0;
}

function limietVan(soort) {
  const max = DAGLIMIETEN[soort];
  if (!Number.isFinite(max)) throw new Error(`Onbekende daglimiet: ${soort}`);
  return max;
}

// Hoeveel er vandaag nog mag (nooit onder nul).
function resterend(boek, soort, sleutel, dag) {
  return Math.max(0, limietVan(soort) - telling(boek, soort, sleutel, dag));
}

function magNog(boek, soort, sleutel, dag) {
  return resterend(boek, soort, sleutel, dag) > 0;
}

// Boekt één (of `aantal`) gebruik. Geeft een NIEUW boek terug; de aanroeper schrijft zelf weg.
// Een telling van een eerdere dag wordt overschreven, zo blijft het boek per sleutel één regel.
function boekIn(boek, soort, sleutel, dag, aantal = 1) {
  const nieuw = telling(boek, soort, sleutel, dag) + Math.max(0, Number(aantal) || 0);
  return {
    ...(boek || {}),
    [soort]: { ...((boek || {})[soort] || {}), [sleutel]: { dag, aantal: nieuw } },
  };
}

// Wat de zondebok kost. Wie al op nul staat verliest niets meer: een zondebok die iemand onder
// nul duwt, straft het lid dat toch al niets had.
function zondebokStraf(stand) {
  return (Number(stand) || 0) > 0 ? 1 : 0;
}

module.exports = {
  DAGLIMIETEN, IEDEREEN,
  telling, resterend, magNog, boekIn, zondebokStraf,
};
