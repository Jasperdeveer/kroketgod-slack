// ── De Vijf Ambten van het Vetgeschrift ────────────────────────────────────────
// Pure functies zonder projectstate: de aanspraakberekening, de stichtingsbezetting en de
// wekelijkse hertelling. Bewust hier en niet in index.js, want dit is het gevaarlijkste stuk
// logica van de release (het bepaalt elke maandag wie er macht over de anderen heeft) en het
// enige dat volledig te testen valt. Zie lib/ambten.test.js.
//
// Een ambt is GEEN rang. Rang is een getal dat stijgt; een ambt is een bevoegdheid die precies
// één houder heeft en die van hand wisselt zodra een ander meer doet in die richting.
// De wet uit vetgeschrift.txt: een zegel landt nooit op de houder zelf.

'use strict';

// Hoeveel dagen de aanspraak terugkijkt. Veertien: kort genoeg dat een actieve week telt,
// lang genoeg dat één drukke week op het werk je ambt niet kost.
const VENSTER_DAGEN = 14;

// Minimaal aantal daden in het venster om een ambt te mógen dragen. Zonder deze poort valt een
// ambt elke week erfelijk terug op iemand die niet meer inlogt, en dan is de bevoegdheid die de
// anderen nodig hebben permanent onbereikbaar. Liever een lege zetel dan een dode.
const LEVENSTEKEN_DADEN = 2;

// Een ambt wisselt niet binnen zoveel dagen na de vorige wissel. Voorkomt dat het houderschap
// elke maandag heen en weer klappert bij twee leden die dicht bij elkaar liggen.
const AMBTSCLIFF_DAGEN = 7;

// De vijf ambten. `zegelNorm` is het weekbudget aan handelingen op ándere leden; `aanspraak` is
// de formule over de venstertellers; `rolAanspraak` matcht op het `rol`-veld uit members.json —
// de titels die het Bureau voor Rijkstitels in 1936 uitdeelde. Die rol BREEKT een gelijkstand
// boven nul en bepaalt de stichtingsbezetting, maar verdient nooit een ambt op zichzelf.
const AMBTEN = {
  muntmeester: {
    naam: 'De Muntmeester van de Aflatenhandel', icoon: '🪙', kort: 'Muntmeester',
    zegelNorm: 3,
    bevoegdheid: 'schenkt per zegel één medelid een gratis artikel uit de Heilige Aflatenhandel',
    zegelNaam: 'aflaat',
    aanspraak: { winkel_koop: 2, beurs_koop: 1, veiling_bod: 1 },
    rolAanspraak: /marketeer|economie/i,
  },
  heraut: {
    naam: 'De Heraut der Frituur', icoon: '📜', kort: 'Heraut',
    zegelNorm: 5,
    bevoegdheid: 'schrijft per zegel één medelid een extra dagopdracht uit, met dubbele beloning',
    zegelNaam: 'plicht',
    aanspraak: { opdracht_klaar: 1, bingo_claim: 2 },
    rolAanspraak: /campagne|propaganda/i,
  },
  opperpaneerder: {
    naam: 'De Opperpaneerder van het Vetbad', icoon: '🐉', kort: 'Opperpaneerder',
    zegelNorm: 1,
    bevoegdheid: 'kiest met zijn ene zegel de vijand waar het hele Rijk deze week tegen vecht',
    zegelNaam: 'vijandkeuze',
    aanspraak: { raid_aanval: 2, raid_overwonnen: 3, offer: 1 },
    rolAanspraak: /opperpaneerder|ontwerper/i,
  },
  rekenmeester: {
    naam: 'De Rekenmeester der Frituur', icoon: '⚖️', kort: 'Rekenmeester',
    zegelNorm: 2,
    bevoegdheid: 'onthult per zegel openbaar één verborgen feit over één medelid',
    zegelNaam: 'boekenzegel',
    aanspraak: { beurs_koop: 2, verhoor_juist: 2, visioen: 1 },
    rolAanspraak: /intelligentie|data/i,
  },
  voorspraak: {
    naam: 'De Voorspraak der Zachte Korst', icoon: '🕊️', kort: 'Voorspraak',
    zegelNorm: 2,
    bevoegdheid: 'haalt per zegel een vloek weg, schrapt een gele kaart of staat een eigen punt af',
    zegelNaam: 'zachte hand',
    aanspraak: { eer_gegeven: 2, capsule_stem: 1, kroketje_gegeven: 1 },
    rolAanspraak: /diplomaat|smaak/i,
  },
};

const AMBT_KEYS = Object.keys(AMBTEN);

// ── Venstertellers ────────────────────────────────────────────────────────────
// Vorm: { userId: { 'YYYY-MM-DD': { actie: aantal } } }. Bewust gewone JSON en geen NDJSON:
// lib/state.js geeft alleen JSON de mtime-cache en de atomaire write, en de backupdekking in
// lib/backup.js globt op `.json` — een `.ndjson` zou nooit als vergeten gemeld worden.

// De dagsleutels van de laatste `dagen` dagen, inclusief vandaag. Zuiver op UTC-datumrekening
// vanaf een meegegeven sleutel, zodat de functie testbaar is zonder klok.
function vensterSleutels(vandaagSleutel, dagen = VENSTER_DAGEN) {
  const basis = Date.parse(`${vandaagSleutel}T00:00:00Z`);
  if (!Number.isFinite(basis)) return [];
  const uit = [];
  for (let i = 0; i < dagen; i++) {
    uit.push(new Date(basis - i * 86_400_000).toISOString().slice(0, 10));
  }
  return uit;
}

// Snoeit alles buiten het venster. Wordt bij elke write aangeroepen, zodat het bestand niet
// eindeloos groeit; een marge van een week erbij zodat een verschoven venster niets mist.
function snoeiVenster(alles, vandaagSleutel, dagen = VENSTER_DAGEN + 7) {
  const houden = new Set(vensterSleutels(vandaagSleutel, dagen));
  const uit = {};
  for (const [userId, dagenVanLid] of Object.entries(alles || {})) {
    const bewaard = {};
    for (const [dag, acties] of Object.entries(dagenVanLid || {})) {
      if (houden.has(dag)) bewaard[dag] = acties;
    }
    if (Object.keys(bewaard).length) uit[userId] = bewaard;
  }
  return uit;
}

// Totaal aantal daden van een lid in het venster — de maatstaf voor de levensteken-poort.
function dadenInVenster(vensterVanLid, sleutels) {
  let totaal = 0;
  for (const dag of sleutels) {
    for (const aantal of Object.values(vensterVanLid?.[dag] || {})) totaal += aantal || 0;
  }
  return totaal;
}

// Gewogen aanspraak op één ambt.
function aanspraakVan(vensterVanLid, formule, sleutels) {
  let som = 0;
  for (const dag of sleutels) {
    const acties = vensterVanLid?.[dag] || {};
    for (const [actie, gewicht] of Object.entries(formule)) {
      som += (acties[actie] || 0) * gewicht;
    }
  }
  return som;
}

// ── Stichtingsbezetting ───────────────────────────────────────────────────────
// De eerste bezetting kan niet uit de tellers komen: bij de openbaring is het venster leeg en
// zou de levensteken-poort alle vijf de zetels vacant verklaren. Daarom eenmalig uit `rol` —
// precies de dode promptruimte die het Vetgeschrift met terugwerkende kracht betekenis geeft.
// Leden zonder passende rol vullen de resterende ambten aan, alfabetisch op bijnaam zodat de
// uitkomst deterministisch is.
function stichtingsBezetting(members) {
  const bezet = {};
  const gebruikt = new Set();
  const ids = Object.keys(members || {}).sort((a, b) =>
    String(members[a]?.bijnaam || a).localeCompare(String(members[b]?.bijnaam || b), 'nl'));

  for (const key of AMBT_KEYS) {
    const patroon = AMBTEN[key].rolAanspraak;
    const match = ids.find(id => !gebruikt.has(id) && patroon.test(String(members[id]?.rol || '')));
    if (match) { bezet[key] = match; gebruikt.add(match); }
  }
  for (const key of AMBT_KEYS) {
    if (bezet[key]) continue;
    const vrij = ids.find(id => !gebruikt.has(id));
    if (!vrij) break;
    bezet[key] = vrij; gebruikt.add(vrij);
  }
  return bezet;
}

// ── De wekelijkse hertelling ──────────────────────────────────────────────────
// Geeft per ambt { houderId, aanspraak, reden, wissel } terug. `houderId: null` = vacant.
//
// `huidig` = { ambtKey: { houderId, sinds } }. `laatsteAmbt` = { userId: ts } voor de tiebreak
// "wie het langst geen ambt had". `nuTs` maakt de ambtscliff testbaar zonder klok.
function bepaalAmbten({ venster = {}, members = {}, huidig = {}, laatsteAmbt = {}, vandaagSleutel, nuTs = 0, uitgesloten = [] }) {
  const sleutels = vensterSleutels(vandaagSleutel);
  const uitSet = new Set(uitgesloten); // ballingen en vertrokken leden
  const kandidaten = Object.keys(members).filter(id => !uitSet.has(id));

  // Levensteken-poort: wie in veertien dagen minder dan twee daden deed, draagt niets.
  const levend = new Set(kandidaten.filter(id =>
    dadenInVenster(venster[id], sleutels) >= LEVENSTEKEN_DADEN));

  const uitkomst = {};
  const vergevenAan = new Set();
  const vasteAmbten = new Set();

  // Stap 1 — de ambtscliff. Een ambt dat pas net van hand wisselde, blijft staan zolang de
  // houder nog een levensteken heeft. Anders klappert het houderschap elke maandag.
  for (const key of AMBT_KEYS) {
    const rec = huidig[key];
    if (!rec?.houderId || !members[rec.houderId] || uitSet.has(rec.houderId)) continue;
    // Draagt dit lid in deze ronde al een ambt, dan beschermt de cliff het tweede NIET. Dat
    // geval bestaat echt: bij een ontheffing neemt een zittende houder een vrijgekomen zetel
    // waar, en dan staat hij tijdelijk op twee stoelen met beide een verse `sinds`. Zonder deze
    // regel zou de cliff hem beide laten houden en werd de waarneming stilzwijgend bezit —
    // in strijd met "één ambt per lid".
    if (vergevenAan.has(rec.houderId)) continue;
    const versGewisseld = rec.sinds && (nuTs - rec.sinds) < AMBTSCLIFF_DAGEN * 86_400_000;
    if (versGewisseld && levend.has(rec.houderId)) {
      uitkomst[key] = {
        houderId: rec.houderId,
        aanspraak: aanspraakVan(venster[rec.houderId], AMBTEN[key].aanspraak, sleutels),
        reden: 'ambtscliff', wissel: false,
        vorige: rec.houderId,
      };
      vergevenAan.add(rec.houderId);
      vasteAmbten.add(key);
    }
  }

  // Stap 2 — alle (lid, ambt)-paren met hun aanspraak, gesorteerd. Één sortering over álle
  // paren in plaats van per ambt greedy: zo krijgt de sterkste aanspraak van het hele veld
  // als eerste zijn ambt, ongeacht in welke volgorde de ambten in de tabel staan.
  //
  // Gevolg dat we bewust accepteren: wie op twee ambten de sterkste is, krijgt het hoogste, en
  // een lid dat alléén op dát ambt aanspraak had houdt niets over — de andere zetel kan dan
  // vacant blijven. Een optimale toewijzing zou meer zetels vullen, maar zou het houderschap
  // van iemand wegnemen die er de meeste daden voor deed, en dat is precies de belofte die
  // Artikel I van het Vetgeschrift doet. Bij vijf leden die van alles wat doen is het geval
  // zeldzaam; zie de twee tests hierover.
  const paren = [];
  for (const key of AMBT_KEYS) {
    if (vasteAmbten.has(key)) continue;
    for (const id of levend) {
      const aanspraak = aanspraakVan(venster[id], AMBTEN[key].aanspraak, sleutels);
      if (aanspraak <= 0) continue; // geen aanspraak is geen kandidaat
      paren.push({ key, id, aanspraak });
    }
  }

  paren.sort((a, b) =>
    // 1. hoogste aanspraak
    b.aanspraak - a.aanspraak
    // 2. de rol uit de eerste codex breekt een gelijkstand — maar alleen bóven nul, nooit een
    //    gelijkspel op niets. Dat is precies het verschil tussen erkenning en benoeming.
    || rolScore(members, b.id, b.key) - rolScore(members, a.id, a.key)
    // 3. wie het langst geen ambt had
    || (laatsteAmbt[a.id] || 0) - (laatsteAmbt[b.id] || 0)
    // 4. alfabetisch op bijnaam — puur om de uitkomst deterministisch te maken
    || String(members[a.id]?.bijnaam || a.id).localeCompare(String(members[b.id]?.bijnaam || b.id), 'nl'));

  for (const paar of paren) {
    if (uitkomst[paar.key] || vergevenAan.has(paar.id)) continue; // één ambt per lid
    const vorige = huidig[paar.key]?.houderId || null;
    uitkomst[paar.key] = {
      houderId: paar.id,
      aanspraak: paar.aanspraak,
      reden: vorige === paar.id ? 'behouden' : 'veroverd',
      wissel: vorige !== paar.id,
      vorige,
    };
    vergevenAan.add(paar.id);
  }

  // Stap 3 — wat over is, is vacant. Een vacant ambt geeft niemand zegels; het eerste lid dat
  // een levensteken én aanspraak opbouwt, claimt het bij de volgende hertelling.
  for (const key of AMBT_KEYS) {
    if (uitkomst[key]) continue;
    const vorige = huidig[key]?.houderId || null;
    uitkomst[key] = { houderId: null, aanspraak: 0, reden: 'vacant', wissel: !!vorige, vorige };
  }
  return uitkomst;
}

function rolScore(members, userId, ambtKey) {
  return AMBTEN[ambtKey].rolAanspraak.test(String(members[userId]?.rol || '')) ? 1 : 0;
}

// Het zegelbudget van een houder: de norm van het ambt plus wat zijn rang erbij geeft.
function zegelBudget(ambtKey, zegelExtra = 0) {
  const norm = AMBTEN[ambtKey]?.zegelNorm || 0;
  return Math.max(1, norm + zegelExtra);
}

module.exports = {
  AMBTEN,
  AMBT_KEYS,
  VENSTER_DAGEN,
  LEVENSTEKEN_DADEN,
  AMBTSCLIFF_DAGEN,
  vensterSleutels,
  snoeiVenster,
  dadenInVenster,
  aanspraakVan,
  stichtingsBezetting,
  bepaalAmbten,
  zegelBudget,
};
