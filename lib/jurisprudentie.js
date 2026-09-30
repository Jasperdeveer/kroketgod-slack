// ── De Hoge Frituurraad: zaaknummers en het ontleden van een zaak ─────────────
// Pure functies rondom de jurisprudentie: het nummeren van zaken en het uit elkaar halen van
// "A vs B over grond". Geen state, geen Slack, geen LLM.
//
// WAAROM ZAAKNUMMERS. Een vonnis dat een nummer heeft, kan geciteerd worden — en daarmee wordt een
// losse grap een precedent. Dat is het hele verschil tussen het oude `rechtbank`-commando (eenmalig
// theater, daarna weg) en een rechtsstelsel dat zichzelf opbouwt: het volgende vonnis moet zich
// verhouden tot het vorige.
//
// FORMAAT: jaar/romeins, dus 2026/VII is de zevende zaak van 2026. Romeins omdat het gewicht geeft
// dat "zaak 7" niet heeft, en de teller loopt per jaar zodat hij nooit onleesbaar lang wordt.

const ROMEINSE_PAREN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

// Romeins cijfer voor een positief geheel getal. Buiten bereik (0, negatief, geen getal) geeft
// dit een lege string terug: liever geen nummer dan een onzinnig nummer.
function romeins(n) {
  let rest = Math.floor(Number(n));
  if (!Number.isFinite(rest) || rest < 1 || rest > 3999) return '';
  let uit = '';
  for (const [waarde, teken] of ROMEINSE_PAREN) {
    while (rest >= waarde) { uit += teken; rest -= waarde; }
  }
  return uit;
}

// Zaaknummer uit jaar en teller. Valt terug op het Arabische getal als romeins niet kan — een zaak
// zonder nummer is onciteerbaar en dat is erger dan een lelijk nummer.
function zaakNummer(jaar, teller) {
  const r = romeins(teller);
  return `${jaar}/${r || teller}`;
}

// Hoeveelste zaak van dit jaar is dit? Telt de bestaande zaken van hetzelfde jaar.
function volgendeTeller(zaken, jaar) {
  return (zaken || []).filter(z => z.jaar === jaar).length + 1;
}

// Ontleedt "A vs B" en "A vs B over [grond]". De grond is optioneel; `vs` mag ook `versus` of
// een liggend streepje zijn, want zo typt een mens het.
// Geeft { partij1, partij2, grond } of { fout }.
function parseerZaak(invoer) {
  const schoon = String(invoer || '').trim().replace(/\s+/g, ' ');
  if (!schoon) return { fout: 'Geen zaak opgegeven.' };
  const splitsing = schoon.match(/^(.+?)\s+(?:vs\.?|versus|tegen)\s+(.+)$/i);
  if (!splitsing) {
    return { fout: 'Gebruik: [naam1] vs [naam2] — eventueel met "over [grond]" erachter.' };
  }
  const partij1 = splitsing[1].trim();
  let rest = splitsing[2].trim();
  let grond = '';
  // "over" splitst partij 2 van de grond. Op het LAATSTE voorkomen splitsen, zodat een naam die
  // zelf "over" bevat (Mr. Overjas) niet halveert.
  let overIdx = rest.toLowerCase().lastIndexOf(' over ');
  let grondVanaf = overIdx + ' over '.length;
  // Staat "over" direct achter "vs", dan is er helemaal geen tweede partij ("Jasper vs over de
  // kroket"). Dat wordt hieronder een nette fout in plaats van een partij die "over de kroket" heet.
  const kopOver = rest.match(/^over\s+/i);
  if (overIdx === -1 && kopOver) { overIdx = 0; grondVanaf = kopOver[0].length; }
  if (overIdx !== -1) {
    grond = rest.slice(grondVanaf).trim();
    rest = rest.slice(0, overIdx).trim();
  }
  if (!partij1 || !rest) return { fout: 'Beide partijen moeten een naam hebben.' };
  return { partij1, partij2: rest, grond };
}

module.exports = {
  romeins,
  zaakNummer,
  volgendeTeller,
  parseerZaak,
};
