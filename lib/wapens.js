// ── Het Frituurarsenaal: wapens tegen de weekvijand ────────────────────────────
//
// Aanleiding (16 nov 2026): de eigenaar wil in de winkel wapens kopen om de weekvijand aan te
// vallen, interactiever en spannender, zonder dat de balans omvalt. Ontwerp en simulatie:
// docs/superpowers/specs/2026-11-16-wapens-weekvijand-design.md.
//
// Punten gaan elke zondag op nul: maandag heeft iedereen er ~5, vrijdag 50 tot 145. Een prijs
// remt alleen als hij echt kost; wat de wapens in toom houdt:
//   REK. Hoogstens WAPENREK_MAX wapens per lid per vijand, één tegelijk in de hand. Het wapen gaat
//     op bij de volgende aanval, en aanvallen blijft één keer per dag.
//   ECHTE KOSTEN. Wat je aan wapens en het kanon uitgeeft, ben je kwijt, ook als hij valt. Eerst ging
//     het naar een oorlogskas die bij winst terugkwam, en toen kostte een wapen de winnaars niets: de
//     Gehaktstaaf viel op dinsdag. Op 17 nov 2026 koos de eigenaar voor prijzen ×2 en geen teruggave.
//   KANON. Alleen samen: KANON_DOEL punten van minstens KANON_MIN_LEDEN leden.
// Met wapens zou hij al op woensdag vallen; daarom ging HP_PER_LID in weekvijand.js van 7 naar 8,5.
//
// Puur: geen I/O, geen klok — toeval komt als argument binnen. Zie wapens.test.js.

'use strict';

const WAPENREK_MAX = 2;
const KANON_DOEL = 24;
const KANON_MIN_LEDEN = 3;
const KANON_FRACTIE = 0.15;
const VETBOM_KETST = 1 / 6;
const VETBOM_KETST_BUIT = 2;
const PEKEL_AANVALLEN = 2;

const WAPENS = {
  frietvork:     { naam: 'Frietvork',     icoon: '🍴', prijs: 2, uitleg: '+1 schade' },
  kroketmes:     { naam: 'Kroketmes',     icoon: '🔪', prijs: 6, uitleg: '+2 schade, gaat door pantser' },
  vliegenmepper: { naam: 'Vliegenmepper', icoon: '🪰', prijs: 4, uitleg: '+1 schade, mist nooit' },
  ovenwant:      { naam: 'Ovenwant',      icoon: '🧤', prijs: 4, uitleg: '+1 schade, geen terugslag en geen knal' },
  vershoudfolie: { naam: 'Vershoudfolie', icoon: '🎞️', prijs: 4, uitleg: 'geen extra schade, maar bij zijn volgende beurt herstelt hij niet' },
  pekelspuit:    { naam: 'Pekelspuit',    icoon: '🧂', prijs: 6, uitleg: '+1 schade, en de volgende twee aanvallen van anderen vandaag ook +1' },
  vetbom:        { naam: 'Vetbom',        icoon: '💣', prijs: 10, uitleg: '+2 tot +6 schade, maar 1 op 6 ketst terug: geen schade en 2 punten naar zijn buit. Eén per vijand' },
};

// Welk wapen de gave van deze snack breekt (tip op het raidbord). Tegen offerdoof werkt elk wapen;
// tegen de rest helpt geen enkel wapen in het bijzonder.
const ZWAK_TEGEN = {
  pantser: 'kroketmes', ontwijk: 'vliegenmepper', taai: 'vershoudfolie', hongerig: 'vershoudfolie',
  samen: 'pekelspuit', stekels: 'ovenwant', hebzucht: 'ovenwant', kortlontje: 'ovenwant', explosief: 'ovenwant',
};
const zwakTegen = (soort) => ZWAK_TEGEN[soort] || null;

// Waarom `eigen` (zijn regel in raid.arsenaal: { inHand, gekocht, vetbom }) dit wapen niet mag
// kopen, of null.
function koopWeigering(eigen = {}, key, saldo) {
  const w = WAPENS[key];
  if (!w) return 'Het arsenaal kent dat wapen niet.';
  if (eigen.inHand) return `U heeft al een ${WAPENS[eigen.inHand]?.naam || 'wapen'} in de hand. Gebruik het eerst bij uw volgende aanval.`;
  if ((eigen.gekocht || 0) >= WAPENREK_MAX) return `Uw wapenrek is vol: ${WAPENREK_MAX} wapens per vijand.`;
  if (key === 'vetbom' && eigen.vetbom) return 'Eén Vetbom per vijand. Meer vet laat de Hoge Frituurraad niet toe.';
  if (saldo < w.prijs) return `${w.naam} kost ${w.prijs} kroketpunten; u heeft er ${saldo}.`;
  return null;
}

// Wat een wapen met een aanval doet. `basis`: de schade vóór de gave (inclusief offer en titel).
// Geeft de nieuwe basis en de gave waarmee schadeNaGave daarna rekent (null als het wapen die
// gave breekt), plus de bijwerkingen voor de aanroeper.
function wapenUithaal(basis, key, gave = null, rng = Math.random) {
  const uit = { basis, gave, terugslag: true, knal: true, folie: false, pekel: false, ketst: false };
  switch (key) {
    case 'frietvork': return { ...uit, basis: basis + 1 };
    case 'kroketmes': return { ...uit, basis: basis + 2, gave: gave?.soort === 'pantser' ? null : gave };
    case 'vliegenmepper': return { ...uit, basis: basis + 1, gave: gave?.soort === 'ontwijk' ? null : gave };
    case 'ovenwant': return { ...uit, basis: basis + 1, terugslag: false, knal: false };
    case 'vershoudfolie': return { ...uit, folie: true };
    case 'pekelspuit': return { ...uit, basis: basis + 1, pekel: true };
    case 'vetbom':
      // De ketsende bom is zelf de terugslag, en een gave telt er niet bij op.
      if (rng() < VETBOM_KETST) return { ...uit, basis: 0, gave: null, terugslag: false, ketst: true };
      return { ...uit, basis: basis + 2 + Math.floor(rng() * 5) };
    default: return uit;
  }
}

// Pekel van een ander lid geeft de volgende PEKEL_AANVALLEN aanvallen van die dag +1.
function pekelBonus(pekel, userId, dag) {
  if (!pekel || pekel.dag !== dag || pekel.door === userId || !(pekel.over > 0)) return { bonus: 0, pekel };
  return { bonus: 1, pekel: { ...pekel, over: pekel.over - 1 } };
}

const kanonTotaal = (kanon = {}) => Object.values(kanon.inleg || {}).reduce((a, n) => a + n, 0);
const kanonLeden = (kanon = {}) => Object.values(kanon.inleg || {}).filter(n => n > 0).length;

function kanonVuurt(kanon = {}) {
  return !kanon.gevuurd && kanonTotaal(kanon) >= KANON_DOEL && kanonLeden(kanon) >= KANON_MIN_LEDEN;
}

const kanonSchade = (maxHp) => Math.max(1, Math.round(maxHp * KANON_FRACTIE));

// Hoeveel `userId` van de gevraagde `n` inlegt: nooit meer dan het kanon nog nodig heeft, maar een
// nieuw lid kan altijd met 1 aanhaken (anders blijft een kanon dat vol zit met twee leden steken).
function kanonInleg(kanon = {}, userId, n, saldo) {
  if (!(n >= 1)) return { weigering: 'Leg minstens 1 punt in.' };
  if (kanon.gevuurd) return { weigering: 'Het kanon is al gevuurd. Eén schot per vijand.' };
  const totaal = kanonTotaal(kanon);
  const nieuw = !(kanon.inleg?.[userId] > 0);
  if (totaal >= KANON_DOEL && !nieuw) return { weigering: `Het kanon is geladen, maar er moet nog een ander lid bij (minstens ${KANON_MIN_LEDEN}).` };
  const bedrag = Math.max(1, Math.min(n, KANON_DOEL - totaal));
  if (saldo < bedrag) return { weigering: `U heeft ${saldo} kroketpunt${saldo === 1 ? '' : 'en'}; het kanon vraagt er ${bedrag}.` };
  return { bedrag };
}

module.exports = {
  WAPENS, WAPENREK_MAX, KANON_DOEL, KANON_MIN_LEDEN, VETBOM_KETST_BUIT, PEKEL_AANVALLEN,
  zwakTegen, koopWeigering, wapenUithaal, pekelBonus, kanonInleg, kanonTotaal, kanonLeden, kanonVuurt, kanonSchade,
};
