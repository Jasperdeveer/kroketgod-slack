// ── Het Sociale Weefsel: de rekenregels ───────────────────────────────────────
// Wie eert wie, wie bevecht wie, wie negeert wie. Deze module bevat uitsluitend de graafrekenkunde
// over een verzameling randen — geen state, geen Slack, geen ledendata. Het vastleggen van randen
// en het weergeven ervan staat in index.js.
//
// WAAROM DIT ER NIET AL WAS. Het spel hield relaties nergens duurzaam bij. `eerGegeven.json` telt
// alleen hoeveel eer je vandaag hebt WEGGEGEVEN, niet aan wie; `weekgebeurtenissen.json` weet het
// wel maar wordt elke vrijdag gewist. Er bestond dus geen enkele plek waar stond dat A en B elkaar
// al maanden eren, of dat C nooit door iemand geëerd wordt. Dat is precies de informatie waardoor
// de Kroket God de groep lijkt te doorgronden, en hij kost geen enkele LLM-call.
//
// EEN RAND IS GERICHT EN CUMULATIEF: `van>naar` met een teller per soort. Richting is essentieel —
// A die B eert is iets anders dan B die A eert, en juist het VERSCHIL daartussen is interessant.
//
// WARM VERSUS WRIJVING. Eer is het enige zuiver warme signaal. Een duelwinst en een roof zijn
// wrijving, maar van verschillend gewicht: een duel is een sport (beide partijen kozen ervoor), een
// roof is eenzijdig. Zonder die weging zou een groep die veel duelleert er vijandiger uitzien dan
// een groep die elkaar besteelt.
//
// ⚠️ DE VLOEK STAAT HIER BEWUST NIET IN, en hoort er ook niet bij te komen. Een Vloek der Slappe
// Korst is anoniem: het kanaal ziet dát er een vloek ligt, nooit door wie. Het weefsel rapporteert
// vetes als PAAR ("de grootste vete: X en Y"), dus zou een vloek meewegen, dan kon het doelwit uit
// dat rapport aflezen wie hem gelegd had — en dan is de anonimiteit stuk. Wie hier ooit 'vloek'
// aan toevoegt, sloopt daarmee een ontwerpkeuze die elders in het spel met zorg is beschermd.
const SOORTEN = {
  eer:      { warm: 1,   wrijving: 0,   label: 'eerbewijzen' },
  duel_win: { warm: 0,   wrijving: 0.5, label: 'gewonnen duels' },
  roof:     { warm: 0,   wrijving: 1.5, label: 'roofpogingen' },
};

function randSleutel(van, naar) {
  return `${van}>${naar}`;
}

function telRand(randen, van, naar, soort) {
  return Number(randen?.[randSleutel(van, naar)]?.[soort]) || 0;
}

// Warmte van A naar B: hoeveel A in B heeft geïnvesteerd.
function warmte(randen, van, naar) {
  const r = randen?.[randSleutel(van, naar)] || {};
  let som = 0;
  for (const [soort, def] of Object.entries(SOORTEN)) som += (Number(r[soort]) || 0) * def.warm;
  return som;
}

function wrijving(randen, van, naar) {
  const r = randen?.[randSleutel(van, naar)] || {};
  let som = 0;
  for (const [soort, def] of Object.entries(SOORTEN)) som += (Number(r[soort]) || 0) * def.wrijving;
  return som;
}

// Per lid: wat het gaf en wat het kreeg. `stilte` is het aantal medeleden dat dit lid nooit heeft
// geëerd — de maat die laat zien of iemand breed kijkt of altijd dezelfde twee eert.
function graadPerLid(randen, leden) {
  const uit = {};
  for (const id of leden) {
    let warmGegeven = 0, warmOntvangen = 0, wrijvingGegeven = 0, wrijvingOntvangen = 0, geeerd = new Set();
    for (const ander of leden) {
      if (ander === id) continue;
      const w = warmte(randen, id, ander);
      warmGegeven += w;
      if (w > 0) geeerd.add(ander);
      warmOntvangen += warmte(randen, ander, id);
      wrijvingGegeven += wrijving(randen, id, ander);
      wrijvingOntvangen += wrijving(randen, ander, id);
    }
    uit[id] = {
      warmGegeven, warmOntvangen, wrijvingGegeven, wrijvingOntvangen,
      totaal: warmGegeven + warmOntvangen + wrijvingGegeven + wrijvingOntvangen,
      stilte: Math.max(0, leden.length - 1 - geeerd.size),
    };
  }
  return uit;
}

// Alle paren, met hun onderlinge balans. Eén regel per PAAR (niet per richting), want een band is
// iets tussen twee mensen. `scheef` is het verschil in warmte: hoog betekent eenzijdige bewondering.
function paren(randen, leden) {
  const uit = [];
  for (let i = 0; i < leden.length; i++) {
    for (let j = i + 1; j < leden.length; j++) {
      const a = leden[i], b = leden[j];
      const warmAB = warmte(randen, a, b), warmBA = warmte(randen, b, a);
      const wrijvingAB = wrijving(randen, a, b), wrijvingBA = wrijving(randen, b, a);
      uit.push({
        a, b,
        warmAB, warmBA, wrijvingAB, wrijvingBA,
        // Een BAND vraagt wederkerigheid: het minimum van beide kanten. Eenzijdige bewondering
        // is geen band, en met een som zou één lid dat de ander tien keer eert de ranglijst
        // domineren zonder dat er iets terugkomt.
        band: Math.min(warmAB, warmBA),
        scheef: Math.abs(warmAB - warmBA),
        vete: wrijvingAB + wrijvingBA,
        contact: warmAB + warmBA + wrijvingAB + wrijvingBA,
      });
    }
  }
  return uit;
}

// De sterkste wederkerige band. Null als niemand elkaar over en weer heeft geëerd.
function sterksteBand(randen, leden) {
  const kandidaten = paren(randen, leden).filter(p => p.band > 0);
  if (!kandidaten.length) return null;
  kandidaten.sort((x, y) => y.band - x.band || y.contact - x.contact);
  return kandidaten[0];
}

// De grootste vete. Null als er nergens wrijving is.
function grootsteVete(randen, leden) {
  const kandidaten = paren(randen, leden).filter(p => p.vete > 0);
  if (!kandidaten.length) return null;
  kandidaten.sort((x, y) => y.vete - x.vete || y.contact - x.contact);
  return kandidaten[0];
}

// Het meest eenzijdige paar: veel bewondering in één richting, weinig terug. Alleen als er een
// echte scheefte is (drempel), anders zou elk paar met één eerbewijs verschil "eenzijdig" heten.
function meestScheef(randen, leden, drempel = 2) {
  const kandidaten = paren(randen, leden).filter(p => p.scheef >= drempel);
  if (!kandidaten.length) return null;
  kandidaten.sort((x, y) => y.scheef - x.scheef);
  const p = kandidaten[0];
  // Wie het meest geeft staat vooraan, zodat de aanroeper de richting niet hoeft uit te zoeken.
  return p.warmAB >= p.warmBA ? p : { ...p, a: p.b, b: p.a, warmAB: p.warmBA, warmBA: p.warmAB };
}

// De spil: het lid met het meeste contact in beide richtingen. Bewust degree-centraliteit en geen
// betweenness — bij een handvol leden is een graaf zo dicht dat betweenness ruis meet.
function spil(randen, leden) {
  const graden = graadPerLid(randen, leden);
  const gesorteerd = Object.entries(graden).sort((a, b) => b[1].totaal - a[1].totaal);
  if (!gesorteerd.length || gesorteerd[0][1].totaal === 0) return null;
  return { id: gesorteerd[0][0], ...gesorteerd[0][1] };
}

// Leden die door niemand geëerd zijn. Dit is de enige meting hier met een sociale scherpte, dus de
// aanroeper moet er voorzichtig mee omgaan — het is bedoeld als duw om iemand te eren, niet als
// schandpaal.
function eenlingen(randen, leden) {
  return leden.filter(id => leden.every(ander => ander === id || warmte(randen, ander, id) === 0));
}

// De relaties van één lid, gesorteerd op hoeveel er tussen hen omgaat. Voedt het dossier en de
// App Home: "wie eert u, wie eert u terug, met wie botst u".
function relatiesVan(randen, leden, id) {
  return leden
    .filter(ander => ander !== id)
    .map(ander => ({
      id: ander,
      gegeven: warmte(randen, id, ander),
      ontvangen: warmte(randen, ander, id),
      wrijvingGegeven: wrijving(randen, id, ander),
      wrijvingOntvangen: wrijving(randen, ander, id),
      contact: warmte(randen, id, ander) + warmte(randen, ander, id) +
               wrijving(randen, id, ander) + wrijving(randen, ander, id),
    }))
    .filter(r => r.contact > 0)
    .sort((a, b) => b.contact - a.contact);
}

module.exports = {
  SOORTEN,
  randSleutel,
  telRand,
  warmte,
  wrijving,
  graadPerLid,
  paren,
  sterksteBand,
  grootsteVete,
  meestScheef,
  spil,
  eenlingen,
  relatiesVan,
};
