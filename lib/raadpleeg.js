// Pure kern van `raadpleeg`: rituelen, daglimieten, trekkingen en controles. Geen fs, geen Slack,
// geen klok of toeval: `rng` en datums komen van buiten. `staat` is al door `dagStaat` gegaan.

'use strict';

const RITUELEN = ['horoscoop', 'biecht', 'orakel', 'canoniseer'];
const RAADPLEEG_SJABLOON = 'raadpleeg horoscoop|biecht|orakel|canoniseer ([vraag, zonde of naam])';

const HOROSCOOP = { kansGunstig: 0.6, delta: 0.1 };
const BIECHT = { kansVrijspraak: 0.4, beloning: 1 };
const ORAKEL = { beloning: 1 };
const HEILIG = { emoji: 'innocent', drempel: 2, openMs: 7_200_000 };

const BOETES = [
  { actie: 'eer_gegeven', tekst: 'Eer vandaag een medelid' },
  { actie: 'kroketje_gegeven', tekst: 'Geef vandaag een :lekker_kroketje: aan een medelid' },
  { actie: 'gunst', tekst: 'Gun vandaag een medelid een punt' },
  { actie: 'raid_aanval', tekst: 'Val vandaag de weekvijand aan', raid: true },
];

const VOORSPELLINGEN = [
  { actie: 'duel_gewonnen', tekst: '{naam} wint vandaag een duel' },
  { actie: 'offer', tekst: '{naam} offert vandaag aan het Grote Vetbad' },
  { actie: 'eer_gegeven', tekst: '{naam} eert vandaag een medelid' },
  { actie: 'winkel_koop', tekst: '{naam} doet vandaag een aankoop in de Aflatenhandel' },
  { actie: 'raid_aanval', tekst: '{naam} valt vandaag de weekvijand aan', raid: true },
];

// Cryptische openingszin van het orakel, voor het vangnet zonder taalmodel.
const ORAKEL_ANTWOORDEN = [
  'Wat u zoekt, ligt onder de korst',
  'Het vet zwijgt, maar zijn bellen knikken',
  'Het antwoord is warm en nog niet gaar',
  'Wie de frituur vraagt, krijgt een schaduw terug',
  'De rook wijst naar ja, maar ruikt naar nee',
];

const kopie = (x) => JSON.parse(JSON.stringify(x));
const kies = (lijst, rng) => lijst[Math.min(Math.floor(rng() * lijst.length), lijst.length - 1)];

// Bij een andere datum een verse dag; anders dezelfde staat (zelfde object).
function dagStaat(staat, datum) {
  if (staat && staat.datum === datum) return staat.leden && 'heilige' in staat ? staat : { leden: {}, heilige: null, ...staat };
  return { datum, leden: {}, heilige: null };
}

function parseRaadpleeg(tekst) {
  const m = String(tekst || '').trim().match(/^raadpleeg(?:\s+(\S+))?\s*(.*)$/i);
  if (!m) return { ritueel: null, rest: '' };
  const woord = (m[1] || '').toLowerCase();
  if (RITUELEN.includes(woord)) return { ritueel: woord, rest: m[2].trim() };
  return { ritueel: null, rest: [m[1], m[2]].filter(Boolean).join(' ').trim() };
}

function oudRitueel(tekst) {
  const woord = String(tekst || '').trim().split(/\s+/)[0].toLowerCase();
  return RITUELEN.includes(woord) ? woord : null;
}

const orakelAntwoord = (rng) => kies(ORAKEL_ANTWOORDEN, rng);

const heiligeBestaat = (staat) => !!(staat.heilige && staat.heilige.heilig);

function openRituelen(staat, userId) {
  const l = staat.leden[userId] || {};
  return RITUELEN.filter((r) => {
    if (r === 'canoniseer') return !l.voordracht && !heiligeBestaat(staat);
    return !l[r];
  });
}

// Geeft een nieuwe staat met `wijzig` toegepast op het lid.
function metLid(staat, userId, wijzig) {
  const s = kopie(staat);
  s.leden[userId] = s.leden[userId] || {};
  wijzig(s.leden[userId]);
  return s;
}

function trekHoroscoop(staat, userId, rng) {
  if ((staat.leden[userId] || {}).horoscoop) return { fout: 'al_gedaan' };
  const teken = rng() < HOROSCOOP.kansGunstig ? 'gunstig' : 'ongunstig';
  return { staat: metLid(staat, userId, (l) => { l.horoscoop = { teken, verbruikt: false }; }), teken };
}

// Verschuiving voor de uitdager: eigen teken min dat van het doel. Beide worden verbruikt.
function pakSterren(staat, uitdagerId, doelId) {
  const s = kopie(staat);
  const tekens = [];
  let delta = 0;
  for (const [id, richting] of [[uitdagerId, 1], [doelId, -1]]) {
    const h = (s.leden[id] || {}).horoscoop;
    if (!h || h.verbruikt) continue;
    h.verbruikt = true;
    tekens.push({ id, teken: h.teken });
    delta += richting * (h.teken === 'gunstig' ? HOROSCOOP.delta : -HOROSCOOP.delta);
  }
  return { staat: tekens.length ? s : staat, delta, tekens };
}

function biecht(staat, userId, rng, { raidActief } = {}) {
  if ((staat.leden[userId] || {}).biecht) return { fout: 'al_gedaan' };
  const vrij = rng() < BIECHT.kansVrijspraak;
  const gekozen = vrij ? null : kies(BOETES.filter((b) => raidActief || !b.raid), rng);
  const boete = gekozen && { actie: gekozen.actie, tekst: gekozen.tekst };
  const uitkomst = vrij ? 'vrijspraak' : 'boete';
  return { staat: metLid(staat, userId, (l) => { l.biecht = { uitkomst, boete, voldaan: false }; }), uitkomst, boete };
}

function orakel(staat, userId, rng, { kandidaten = [], raidActief } = {}) {
  if ((staat.leden[userId] || {}).orakel) return { fout: 'al_gedaan' };
  const anderen = kandidaten.filter((k) => k !== userId);
  let voorspelling = null;
  if (anderen.length) {
    const doel = kies(anderen, rng);
    const v = kies(VOORSPELLINGEN.filter((x) => raidActief || !x.raid), rng);
    voorspelling = { doel, actie: v.actie, tekst: v.tekst };
  }
  const nieuw = metLid(staat, userId, (l) => {
    l.orakel = { ...(voorspelling || { doel: null, actie: null, tekst: null }), uitgekomen: false };
  });
  return { staat: nieuw, voorspelling };
}

// Betaalt elke voorspelling en boete die bij deze daad hoort, één keer.
function verwerkActie(staat, userId, actie) {
  const s = kopie(staat);
  const uitbetalingen = [];
  for (const [vragerId, l] of Object.entries(s.leden)) {
    const o = l.orakel;
    if (o && !o.uitgekomen && o.doel === userId && o.actie === actie) {
      o.uitgekomen = true;
      uitbetalingen.push({ soort: 'orakel', aan: vragerId, tekst: o.tekst });
    }
  }
  const b = (s.leden[userId] || {}).biecht;
  if (b && b.boete && !b.voldaan && b.boete.actie === actie) {
    b.voldaan = true;
    uitbetalingen.push({ soort: 'boete', aan: userId, tekst: b.boete.tekst });
  }
  return { staat: uitbetalingen.length ? s : staat, uitbetalingen };
}

function draagVoor(staat, { voorsteller, kandidaat, nu, ts, kanaal }) {
  if (voorsteller === kandidaat) return { fout: 'zelf' };
  if (heiligeBestaat(staat)) return { fout: 'al_heilige' };
  if ((staat.leden[voorsteller] || {}).voordracht) return { fout: 'al_gedaan' };
  if (staat.heilige && nu < staat.heilige.tot) return { fout: 'open_voordracht' };
  const s = metLid(staat, voorsteller, (l) => { l.voordracht = true; });
  s.heilige = { kandidaat, voorsteller, ts, kanaal, tot: nu + HEILIG.openMs, bevestigers: [], heilig: false };
  return { staat: s };
}

// Een voordracht wordt eerst gereserveerd (ts null) en krijgt de ts van de post erbij; bij een mislukte post gaat hij weer weg.
function zetTs(staat, ts) {
  const s = kopie(staat);
  if (s.heilige) s.heilige.ts = ts;
  return s;
}

function geefVrij(staat, voorsteller) {
  const s = kopie(staat);
  s.heilige = null;
  if (s.leden[voorsteller]) delete s.leden[voorsteller].voordracht;
  return s;
}

function bevestig(staat, { userId, ts, nu }) {
  const h = staat.heilige;
  if (!h || h.heilig || h.ts == null || h.ts !== ts || nu >= h.tot) return { staat, nieuwHeilig: false };
  if ([h.voorsteller, h.kandidaat, ...h.bevestigers].includes(userId)) return { staat, nieuwHeilig: false };
  const s = kopie(staat);
  s.heilige.bevestigers.push(userId);
  const nieuwHeilig = s.heilige.bevestigers.length >= HEILIG.drempel;
  if (nieuwHeilig) s.heilige.heilig = true;
  return { staat: s, nieuwHeilig };
}

const heiligeVandaag = (staat) => (heiligeBestaat(staat) ? staat.heilige.kandidaat : null);

module.exports = {
  RITUELEN, RAADPLEEG_SJABLOON, HOROSCOOP, BIECHT, ORAKEL, HEILIG, BOETES, VOORSPELLINGEN,
  dagStaat, parseRaadpleeg, oudRitueel, openRituelen, trekHoroscoop, pakSterren, biecht, orakel,
  verwerkActie, draagVoor, zetTs, geefVrij, bevestig, ORAKEL_ANTWOORDEN, orakelAntwoord, heiligeVandaag,
};
