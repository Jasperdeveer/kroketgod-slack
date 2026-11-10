// ── Het Casino: de plaatjes ──────────────────────────────────────────────────
//
// Elke tafel als SVG (pure functies, zie casinobeeld.test.js), en naarPng maakt er een PNG van
// met resvg. Hosten en tonen gebeurt in index.js. Kleursymbolen zijn paden, geen tekens: zo hangt
// een kaart niet af van een lettertype. Tekst gebruikt DejaVu Sans uit fonts/ (zie naarPng).
// Er komt nooit een naam van een lid op een plaatje: ze staan openbaar op imgbb.

'use strict';

const { handWaarde, kleurVan, hlFactor, GOKKAST, SK_BREEDTE, SK_DIEPTE, SK_MUNT, SK_GAT } = require('./casino.js');

const B = 800; // breedte van elk plaatje
const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif';
const GOUD = '#f2c14e';
const ROOD = '#c8102e';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tekst = (x, y, inhoud, { maat = 28, kleur = '#fff', anker = 'middle', gewicht = 'bold', extra = '' } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${maat}" font-weight="${gewicht}" fill="${kleur}" text-anchor="${anker}" xml:space="preserve" ${extra}>${esc(inhoud)}</text>`;

// Het groene laken met gouden rand en een titel bovenaan.
function laken(hoogte, titel, inhoud) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${B}" height="${hoogte}" viewBox="0 0 ${B} ${hoogte}">
<defs><radialGradient id="vilt" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1f8a5b"/><stop offset="1" stop-color="#0a4a30"/></radialGradient></defs>
<rect width="${B}" height="${hoogte}" fill="#3b2412"/>
<rect x="10" y="10" width="${B - 20}" height="${hoogte - 20}" rx="28" fill="url(#vilt)" stroke="${GOUD}" stroke-width="4"/>
${tekst(B / 2, 58, titel, { maat: 30, kleur: GOUD, extra: 'letter-spacing="6"' })}
${inhoud}
</svg>`;
}

// De uitslagbalk onderaan: goud bij winst, rood bij verlies, grijs bij gelijk.
function uitslagBalk(hoogte, uitslag) {
  if (!uitslag) return '';
  const { kop, netto } = uitslag;
  const [vul, kleur] = netto > 0 ? [GOUD, '#2b1a05'] : netto < 0 ? ['#7a0f1f', '#fff'] : ['#5b6470', '#fff'];
  const bedrag = netto > 0 ? `+${netto}` : netto < 0 ? `−${-netto}` : '±0';
  const y = hoogte - 84;
  return `<rect x="150" y="${y}" width="${B - 300}" height="56" rx="28" fill="${vul}" stroke="${GOUD}" stroke-width="2"/>` +
    tekst(B / 2, y + 38, `${kop}   ${bedrag}`, { maat: 28, kleur });
}

// ── Kaarten ──────────────────────────────────────────────────────────────────

// Kleursymbolen in een vak van 100 × 100.
const KLEURPAD = {
  '♥': '<path d="M50 90C22 68 6 50 6 32 6 16 18 6 31 6c9 0 16 5 19 12 3-7 10-12 19-12 13 0 25 10 25 26 0 18-16 36-44 58z"/>',
  '♦': '<path d="M50 4 86 50 50 96 14 50z"/>',
  '♠': '<path d="M50 4C78 28 94 44 94 60c0 14-10 23-22 23-9 0-15-4-19-10 1 9 5 17 12 23H35c7-6 11-14 12-23-4 6-10 10-19 10C16 83 6 74 6 60 6 44 22 28 50 4z"/>',
  '♣': '<circle cx="50" cy="28" r="21"/><circle cx="27" cy="58" r="21"/><circle cx="73" cy="58" r="21"/><path d="M43 50h14l6 46H37z"/>',
};
const kleurSymbool = (k, x, y, maat) => `<g transform="translate(${x} ${y}) scale(${maat / 100})">${KLEURPAD[k]}</g>`;

// `schaalX` < 1: de kaart staat half gedraaid (de films laten hem zo omdraaien).
function kaartSvg(kaart, x, y, { b = 96, dicht = false, schaalX = 1 } = {}) {
  const vlak = kaartVlak(kaart, x, y, b, dicht);
  if (schaalX === 1) return vlak;
  const cx = x + b / 2;
  return `<g transform="translate(${cx} 0) scale(${Math.max(0.02, schaalX).toFixed(3)} 1) translate(${-cx} 0)">${vlak}</g>`;
}

function kaartVlak(kaart, x, y, b, dicht) {
  const h = Math.round(b * 1.4);
  if (dicht) {
    return `<g><rect x="${x}" y="${y}" width="${b}" height="${h}" rx="${b / 9}" fill="#fff"/>` +
      `<rect x="${x + 6}" y="${y + 6}" width="${b - 12}" height="${h - 12}" rx="${b / 12}" fill="#7d1424" stroke="${GOUD}" stroke-width="2"/>` +
      `<rect x="${x + 14}" y="${y + 14}" width="${b - 28}" height="${h - 28}" rx="${b / 16}" fill="none" stroke="${GOUD}" stroke-width="1.5" stroke-dasharray="4 4"/>` +
      tekst(x + b / 2, y + h / 2 + b / 8, 'KG', { maat: b / 3, kleur: GOUD }) + '</g>';
  }
  const rang = kaart.slice(0, -1);
  const k = kaart.slice(-1);
  const kleur = k === '♥' || k === '♦' ? ROOD : '#111';
  const m = b / 96;
  return `<g fill="${kleur}"><rect x="${x}" y="${y}" width="${b}" height="${h}" rx="${10 * m}" fill="#fffdf7" stroke="#b9b3a3" stroke-width="2"/>` +
    tekst(x + 8 * m, y + 30 * m, rang, { maat: 28 * m, kleur, anker: 'start' }) +
    kleurSymbool(k, x + 9 * m, y + 38 * m, 22 * m) +
    kleurSymbool(k, x + b / 2 - 26 * m, y + h / 2 - 18 * m, 52 * m) +
    `<g transform="rotate(180 ${x + b / 2} ${y + h / 2})">` +
    tekst(x + 8 * m, y + 30 * m, rang, { maat: 28 * m, kleur, anker: 'start' }) + '</g></g>';
}

// Een rij kaarten, gecentreerd rond `midden`; schuift in elkaar als het er veel zijn. `flip`:
// { index, schaalX, dicht } voor de kaart die in een film net omdraait.
function kaartRij(kaarten, midden, y, { b = 96, dichtVanaf = Infinity, flip = null } = {}) {
  const stap = Math.min(b + 14, 520 / Math.max(1, kaarten.length));
  const start = midden - (stap * (kaarten.length - 1) + b) / 2;
  return kaarten.map((k, i) => kaartSvg(k, start + i * stap, y,
    flip?.index === i ? { b, dicht: flip.dicht, schaalX: flip.schaalX } : { b, dicht: i >= dichtVanaf })).join('');
}

const totaalBadge = (x, y, waarde) =>
  `<circle cx="${x}" cy="${y}" r="30" fill="#0b2e1f" stroke="${GOUD}" stroke-width="3"/>` + tekst(x, y + 10, waarde, { maat: 28 });

// `open`: de dichte kaart van de bank omgedraaid (de hand is klaar). `flip`: { rij, index, schaalX,
// dicht } voor een film (blackjackFilm).
function blackjackBeeld(hand, { open = false, uitslag = null, flip = null } = {}) {
  const H = uitslag ? 560 : 480;
  const rij = (label, kaarten, y, dicht, waarde, rijFlip) =>
    tekst(70, y + 75, label, { maat: 22, kleur: GOUD, anker: 'start' }) +
    kaartRij(kaarten, B / 2, y, { dichtVanaf: dicht, flip: rijFlip }) +
    (kaarten.length ? totaalBadge(B - 90, y + 67, waarde) : '');
  const bank = handWaarde(open ? hand.bank : hand.bank.slice(0, 1)).totaal;
  return laken(H, 'BLACKJACK',
    rij('BANK', hand.bank, 85, open ? Infinity : 1, bank, flip?.rij === 'bank' ? flip : null) +
    rij('U', hand.speler, 255, Infinity, handWaarde(hand.speler).totaal, flip?.rij === 'speler' ? flip : null) +
    tekst(B / 2, 440, `inzet ${hand.inzet}${hand.verdubbeld ? ' · verdubbeld' : ''}`, { maat: 20, kleur: '#cfe9dc', gewicht: 'normal' }) +
    uitslagBalk(H, uitslag));
}

// ── De films ─────────────────────────────────────────────────────────────────
// Elke film is een lijst { svg, ms } die naarGif tot een GIF maakt. Het laatste beeld is de tafel
// zónder uitslag: die komt pas daarna, als gewoon plaatje (index.js).

// Een kaart die omdraait: eerst de rug die smaller wordt, dan de voorkant die breder wordt.
const OMDRAAI = [1, 0.55, 0.12, 0.12, 0.55, 1];
const KAART_MS = 70, SLOT_MS = 400;

// Wat er tussen `voor` (null bij het delen) en `na` bij kwam, kaart voor kaart. Bij het delen om en
// om, de tweede bankkaart dicht. Is de hand klaar, dan draait daarna de dichte bankkaart om, en
// komen de kaarten die de bank nog pakte.
function blackjackFilm(voor, na) {
  const film = [];
  let s = voor ? voor.speler.length : 0, bk = voor ? voor.bank.length : 0, open = false;
  const beeld = (flip = null) => blackjackBeeld({ ...na, speler: na.speler.slice(0, s), bank: na.bank.slice(0, bk) }, { open, flip });
  const draaiOm = (rij, index) => OMDRAAI.forEach((schaalX, i) => film.push({ svg: beeld({ rij, index, schaalX, dicht: i < 3 }), ms: KAART_MS }));
  if (!voor) {
    s = 1; draaiOm('speler', 0);
    bk = 1; draaiOm('bank', 0);
    s = 2; draaiOm('speler', 1);
    bk = 2; film.push({ svg: beeld(), ms: 200 });
  }
  while (s < na.speler.length) { s++; draaiOm('speler', s - 1); }
  if (na.klaar) {
    draaiOm('bank', 1);
    open = true;
    while (bk < na.bank.length) { bk++; draaiOm('bank', bk - 1); }
  }
  film.push({ svg: beeld(), ms: SLOT_MS });
  return film;
}

// ── Roulette ─────────────────────────────────────────────────────────────────

const WIEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const VAKKLEUR = { rood: '#b3121f', zwart: '#151515', groen: '#0f7a3d' };
const punt = (cx, cy, r, graden) => {
  const a = (graden * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)].map(n => n.toFixed(2));
};

// Het wiel, zo gedraaid dat het winnende vak bovenaan onder het balletje staat. Voor de film:
// `wielExtra` graden verder gedraaid, het balletje op `bal` ({ hoek, r }), en zonder `onthuld` een
// vraagteken in plaats van het getal.
function rouletteBeeld(uitkomst, { inzetTekst = '', uitslag = null, wielExtra = 0, bal = null, onthuld = true } = {}) {
  const H = 560;
  const cx = 245, cy = 285, rUit = 172, rIn = 118;
  const vak = 360 / WIEL.length;
  const draai = -90 - WIEL.indexOf(uitkomst) * vak + wielExtra;
  const [bx, by] = punt(cx, cy, bal ? bal.r : rIn - 14, bal ? bal.hoek : -90);
  const vakken = WIEL.map((n, i) => {
    const a0 = draai + i * vak - vak / 2, a1 = a0 + vak;
    const [x0, y0] = punt(cx, cy, rUit, a0), [x1, y1] = punt(cx, cy, rUit, a1);
    const [x2, y2] = punt(cx, cy, rIn, a1), [x3, y3] = punt(cx, cy, rIn, a0);
    const [tx, ty] = punt(cx, cy, 152, a0 + vak / 2);
    return `<path d="M${x0} ${y0}A${rUit} ${rUit} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${rIn} ${rIn} 0 0 0 ${x3} ${y3}Z" fill="${VAKKLEUR[kleurVan(n)]}" stroke="${GOUD}" stroke-width="1"/>` +
      tekst(tx, ty, n, { maat: 13, extra: `transform="rotate(${(a0 + vak / 2 + 90).toFixed(2)} ${tx} ${ty})" dominant-baseline="middle"` });
  }).join('');
  const kleur = kleurVan(uitkomst);
  return laken(H, 'ROULETTE',
    `<circle cx="${cx}" cy="${cy}" r="${rUit + 14}" fill="#5a3416" stroke="${GOUD}" stroke-width="4"/>${vakken}` +
    `<circle cx="${cx}" cy="${cy}" r="${rIn}" fill="#6b3f1d" stroke="${GOUD}" stroke-width="3"/>` +
    `<circle cx="${cx}" cy="${cy}" r="48" fill="#8a5a2b" stroke="${GOUD}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="14" fill="${GOUD}"/>` +
    `<circle cx="${bx}" cy="${by}" r="10" fill="#fff" stroke="#999" stroke-width="1.5"/>` +
    `<path d="M${cx - 14} ${cy - rUit - 28}h28l-14 22z" fill="${GOUD}"/>` +
    `<circle cx="600" cy="230" r="92" fill="${onthuld ? VAKKLEUR[kleur] : '#0b2e1f'}" stroke="${GOUD}" stroke-width="5"/>` +
    tekst(600, 262, onthuld ? uitkomst : '?', { maat: 92 }) +
    (onthuld ? tekst(600, 360, kleur.toUpperCase(), { maat: 26, kleur: GOUD, extra: 'letter-spacing="4"' }) : '') +
    (inzetTekst ? tekst(600, 400, inzetTekst, { maat: 20, kleur: '#cfe9dc', gewicht: 'normal' }) : '') +
    uitslagBalk(H, uitslag));
}

// Het wiel draait linksom uit, het balletje rechtsom, en zakt aan het eind naar binnen, in het vak
// onder de pijl.
function rouletteFilm(uitkomst, { inzetTekst = '' } = {}) {
  const N = 26;
  return Array.from({ length: N }, (_, i) => {
    const rest = 1 - i / (N - 1);
    const bal = { hoek: -90 - 1080 * rest ** 2, r: 104 + 58 * Math.min(1, rest / 0.3) };
    return { svg: rouletteBeeld(uitkomst, { inzetTekst, wielExtra: 540 * rest ** 3, bal, onthuld: false }), ms: i === N - 1 ? SLOT_MS : 60 };
  });
}

// ── Gokkast ──────────────────────────────────────────────────────────────────

// `plaatjes`: emoji-naam → data-URL. Ontbreekt er een, dan staat de naam op de rol. Voor de film:
// `draaiend[i]` = [boven, onder] voor een rol die nog draait (twee halve symbolen in het venster),
// en `hendelOmlaag` voor de getrokken hendel.
function gokkastBeeld(rollen, plaatjes = {}, { uitslag = null, draaiend = [], hendelOmlaag = false } = {}) {
  const H = 560;
  const rolB = 150, gat = 26, x0 = (B - 3 * rolB - 2 * gat) / 2 - 20, y0 = 150;
  const symbool = (r, x, dy = 0) => plaatjes[r]
    ? `<image x="${x + 15}" y="${y0 + 15 + dy}" width="${rolB - 30}" height="${rolB - 30}" preserveAspectRatio="xMidYMid meet" xlink:href="${plaatjes[r]}"/>`
    : tekst(x + rolB / 2, y0 + rolB / 2 + 8 + dy, r.slice(0, 10), { maat: 18, kleur: '#333' });
  const vensters = rollen.map((r, i) => {
    const x = x0 + i * (rolB + gat);
    const d = draaiend[i];
    const beeld = d
      ? `<clipPath id="rol${i}"><rect x="${x}" y="${y0}" width="${rolB}" height="${rolB}" rx="14"/></clipPath>` +
        `<g clip-path="url(#rol${i})" opacity="0.85">${symbool(d[0], x, -rolB / 2)}${symbool(d[1], x, rolB / 2)}</g>`
      : symbool(r, x);
    return `<rect x="${x}" y="${y0}" width="${rolB}" height="${rolB}" rx="14" fill="#fffdf7" stroke="${GOUD}" stroke-width="4"/>${beeld}`;
  }).join('');
  const hendelX = x0 + 3 * rolB + 2 * gat + 48;
  const knopY = hendelOmlaag ? y0 + rolB * 0.55 : y0 - 18;
  return laken(H, 'KROKET-O-MAAT',
    `<rect x="${x0 - 30}" y="${y0 - 40}" width="${3 * rolB + 2 * gat + 60}" height="${rolB + 80}" rx="24" fill="#7d1424" stroke="${GOUD}" stroke-width="4"/>` +
    vensters +
    `<line x1="${x0 - 18}" y1="${y0 + rolB / 2}" x2="${x0 + 3 * rolB + 2 * gat + 18}" y2="${y0 + rolB / 2}" stroke="${ROOD}" stroke-width="3" stroke-dasharray="10 6" opacity="0.8"/>` +
    `<rect x="${hendelX - 6}" y="${knopY + 8}" width="12" height="${y0 + rolB - 10 - knopY - 8}" rx="6" fill="#9aa0a6"/><circle cx="${hendelX}" cy="${knopY}" r="20" fill="${ROOD}" stroke="${GOUD}" stroke-width="3"/>` +
    uitbetaalRij(plaatjes, y0 + rolB + 62) +
    uitslagBalk(H, uitslag));
}

// De hendel gaat omlaag, de rollen draaien en stoppen van links naar rechts.
function gokkastFilm(rollen, plaatjes = {}) {
  const symbolen = GOKKAST.map(s => s.emoji);
  const stop = [9, 14, 19], N = 21;
  return Array.from({ length: N }, (_, f) => {
    const draaiend = rollen.map((_, i) => f < stop[i] ? [symbolen[(f + 2 * i) % symbolen.length], symbolen[(f + 2 * i + 1) % symbolen.length]] : null);
    return { svg: gokkastBeeld(rollen, plaatjes, { draaiend, hendelOmlaag: f < 3 }), ms: f === N - 1 ? SLOT_MS : 70 };
  });
}

// Wat elk symbool betaalt, met het symbool zelf: drie gelijk, en tussen haakjes twee gelijk.
function uitbetaalRij(plaatjes, y) {
  const stap = 140, x0 = (B - stap * GOKKAST.length) / 2 + 10;
  return GOKKAST.map((s, i) => {
    const x = x0 + i * stap;
    const icoon = plaatjes[s.emoji]
      ? `<image x="${x}" y="${y}" width="40" height="40" preserveAspectRatio="xMidYMid meet" xlink:href="${plaatjes[s.emoji]}"/>`
      : `<rect x="${x}" y="${y}" width="40" height="40" rx="8" fill="#fffdf7"/>`;
    return icoon + tekst(x + 48, y + 28, `${s.drie}× (${s.twee}×)`, { maat: 18, kleur: '#cfe9dc', anker: 'start', gewicht: 'normal' });
  }).join('') + tekst(B / 2, y + 74, 'drie gelijk · (twee gelijk)', { maat: 15, kleur: '#9cc9b3', gewicht: 'normal' });
}

// ── Hoger/Lager ──────────────────────────────────────────────────────────────

const getal = (n) => n.toFixed(2).replace('.', ',');

// Voor de film: `flip` ({ schaalX, dicht }) voor de grote kaart, en `potVerborgen` zolang hij draait.
function hogerLagerBeeld(hand, { uitslag = null, flip = null, potVerborgen = false } = {}) {
  const H = 560;
  const eerder = hand.kaarten.slice(-6, -1);
  const open = hand.kaarten.at(-1);
  const kleintjes = eerder.map((k, i) => kaartSvg(k, 60 + i * 68, 100, { b: 56 })).join('');
  const kansen = hand.klaar ? '' :
    ['hoger', 'lager'].map((keuze, i) => {
      const f = hlFactor(open, keuze);
      return tekst(560, 335 + i * 40, `${keuze === 'hoger' ? '▲ hoger' : '▼ lager'}  ${f ? `×${getal(f)}` : '—'}`, { maat: 24, kleur: '#cfe9dc', anker: 'start', gewicht: 'normal' });
    }).join('');
  return laken(H, 'HOGER / LAGER',
    kleintjes + kaartSvg(open, 230, 205, { b: 130, ...(flip || {}) }) +
    `<rect x="540" y="150" width="220" height="130" rx="18" fill="#0b2e1f" stroke="${GOUD}" stroke-width="3"/>` +
    tekst(650, 195, 'POT', { maat: 22, kleur: GOUD, extra: 'letter-spacing="4"' }) +
    tekst(650, 255, potVerborgen ? '…' : getal(hand.pot), { maat: 52 }) + kansen +
    tekst(560, 430, `inzet ${hand.inzet}`, { maat: 20, kleur: '#cfe9dc', anker: 'start', gewicht: 'normal' }) +
    uitslagBalk(H, uitslag));
}

// De nieuwe kaart draait om; de kansen en de pot verschijnen pas als hij open ligt.
function hogerLagerFilm(na) {
  const draaiend = { ...na, klaar: true };
  return [
    ...OMDRAAI.map((schaalX, i) => ({ svg: hogerLagerBeeld(draaiend, { flip: { schaalX, dicht: i < 3 }, potVerborgen: true }), ms: 80 })),
    { svg: hogerLagerBeeld(na), ms: SLOT_MS },
  ];
}

// ── Dobbelen ─────────────────────────────────────────────────────────────────

const OGEN = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };

function steen(waarde, x, y, hoek) {
  const z = 170;
  const ogen = OGEN[waarde].map(([i, j]) => `<circle cx="${x + 38 + i * 47}" cy="${y + 38 + j * 47}" r="15" fill="${waarde === 1 ? ROOD : '#111'}"/>`).join('');
  return `<g transform="rotate(${hoek} ${x + z / 2} ${y + z / 2})"><rect x="${x + 6}" y="${y + 8}" width="${z}" height="${z}" rx="30" fill="#000" opacity="0.25"/>` +
    `<rect x="${x}" y="${y}" width="${z}" height="${z}" rx="30" fill="#fffdf7" stroke="#b9b3a3" stroke-width="3"/>${ogen}</g>`;
}

// Waar de stenen stil liggen. Voor de film: `worp` = per steen { w, x, y, hoek } onderweg, en zonder
// `onthuld` een vraagteken achter het isgelijkteken.
const RUST = [{ x: 150, y: 140, hoek: -8 }, { x: 380, y: 150, hoek: 7 }];
function dobbelBeeld([a, b], { inzetTekst = '', uitslag = null, worp = null, onthuld = true } = {}) {
  const H = 560;
  const stenen = worp || [{ w: a, ...RUST[0] }, { w: b, ...RUST[1] }];
  return laken(H, 'DOBBELEN',
    stenen.map(s => steen(s.w, s.x, s.y, s.hoek)).join('') +
    tekst(650, 265, `= ${onthuld ? a + b : '?'}`, { maat: 64 }) +
    (inzetTekst ? tekst(B / 2, 420, inzetTekst, { maat: 20, kleur: '#cfe9dc', gewicht: 'normal' }) : '') +
    uitslagBalk(H, uitslag));
}

// De stenen komen van rechts, stuiteren steeds lager en tollen uit; de laatste drie beelden tonen
// al de echte ogen.
function dobbelFilm([a, b], { inzetTekst = '', rng = Math.random } = {}) {
  const N = 16;
  return Array.from({ length: N }, (_, f) => {
    const t = f / (N - 1), rest = 1 - t;
    const worp = [a, b].map((w, i) => ({
      w: f >= N - 3 ? w : 1 + Math.floor(rng() * 6) % 6,
      x: RUST[i].x + 330 * rest ** 2 * (i ? 0.8 : 1),
      y: RUST[i].y - Math.abs(Math.sin(t * Math.PI * 3)) * 70 * rest,
      hoek: RUST[i].hoek + 720 * rest ** 2 * (i ? -1 : 1),
    }));
    return { svg: dobbelBeeld([a, b], { inzetTekst, worp, onthuld: false }), ms: f === N - 1 ? SLOT_MS : 65 };
  });
}

// ── Schuifkast ───────────────────────────────────────────────────────────────
// Van bovenaf: de schuif achterin, de voorrand onderaan, daaronder de bak. Een munt met d = 0 ligt
// half over de rand. De zijgaten zitten in de voorhoeken (lib/casino.js: skInGat).

const SK_X = 50, SK_RAND = 440;                  // linkerkant van de tafel, y van de voorrand
const SK_GATB = SK_MUNT + SK_GAT;                 // breedte van een zijgat
const skY = (d) => SK_RAND - d;
const MUNT_DEF = '<defs><g id="munt"><circle r="18" fill="#a8740f"/><circle r="15" fill="#f2c14e"/>' +
  '<circle r="11" fill="none" stroke="#c9952a" stroke-width="2"/><rect x="-8" y="-3.5" width="16" height="7" rx="3.5" fill="#a0521d"/></g></defs>';
const munt = (x, y, schaal = 1, dekking = 1) =>
  `<use xlink:href="#munt" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${schaal === 1 ? '' : ` scale(${schaal.toFixed(2)})`}"${dekking === 1 ? '' : ` opacity="${dekking.toFixed(2)}"`}/>`;
// Plek van de i-de munt in de bak: rijen van veertien, daarna over de eerste heen.
const bakPlek = (i) => [SK_X + SK_GATB + 22 + (i % 14) * 26 + (Math.floor(i / 28) % 2) * 9, SK_RAND + 30 + (Math.floor(i / 14) % 2) * 26];

// `munten`: { x, d } op de tafel. `bak`: zoveel munten in de bak; `huis`: zoveel in de zijgaten.
// Voor de film: `schuif` (hoe ver de schuif uitsteekt), `extra` (svg bovenop: munten onderweg) en
// `bakZichtbaar` (hoeveel bakmunten er al liggen).
function schuifkastBeeld(munten, { bak = null, huis = 0, inzet = null, uitslag = null, schuif = 0, extra = '', bakZichtbaar = bak || 0 } = {}) {
  const H = 640;
  const rechts = SK_X + SK_BREEDTE;
  const opTafel = [...munten].sort((a, b) => b.d - a.d).map(m => munt(SK_X + m.x, skY(m.d))).join('');
  const inBak = Array.from({ length: bakZichtbaar }, (_, i) => munt(...bakPlek(i), 0.72)).join('');
  const gat = (x) => `<rect x="${x}" y="${SK_RAND - 34}" width="${SK_GATB}" height="64" rx="10" fill="#050505" stroke="${GOUD}" stroke-width="2"/>`;
  const regel = (y, label, waarde, kleur = '#fff') => tekst(645, y, label, { maat: 18, kleur: GOUD, extra: 'letter-spacing="3"' }) + tekst(645, y + 46, waarde, { maat: 44, kleur });
  return laken(H, 'SCHUIFKAST', MUNT_DEF +
    `<rect x="${SK_X}" y="100" width="${SK_BREEDTE}" height="${SK_RAND - 100}" fill="#4a2a12" stroke="${GOUD}" stroke-width="3"/>` +
    gat(SK_X) + gat(rechts - SK_GATB) +
    tekst(SK_X + SK_GATB / 2, SK_RAND + 50, 'HUIS', { maat: 11, kleur: GOUD }) + tekst(rechts - SK_GATB / 2, SK_RAND + 50, 'HUIS', { maat: 11, kleur: GOUD }) +
    `<rect x="${SK_X + SK_GATB + 4}" y="${SK_RAND + 6}" width="${SK_BREEDTE - 2 * SK_GATB - 8}" height="64" rx="12" fill="#1c1006" stroke="${GOUD}" stroke-width="2"/>` +
    opTafel + inBak +
    `<rect x="${SK_X}" y="80" width="${SK_BREEDTE}" height="${70 + schuif}" fill="#7d1424" stroke="${GOUD}" stroke-width="3"/>` +
    tekst(SK_X + SK_BREEDTE / 2, 122 + schuif, 'K R O K E T   G O D', { maat: 18, kleur: GOUD }) + extra +
    `<line x1="${SK_X + SK_GATB}" y1="${SK_RAND}" x2="${rechts - SK_GATB}" y2="${SK_RAND}" stroke="${GOUD}" stroke-width="4"/>` +
    `<rect x="530" y="110" width="230" height="${bak === null ? 120 : 250}" rx="18" fill="#0b2e1f" stroke="${GOUD}" stroke-width="3"/>` +
    regel(145, 'OP DE TAFEL', munten.length) +
    (bak === null ? '' : regel(255, 'IN DE BAK', bak, GOUD) + (huis ? tekst(645, 340, `${huis} in de zijgaten`, { maat: 17, kleur: '#cfe9dc', gewicht: 'normal' }) : '')) +
    (inzet ? tekst(645, bak === null ? 270 : 400, `inzet ${inzet}`, { maat: 20, kleur: '#cfe9dc', gewicht: 'normal' }) : '') +
    uitslagBalk(H, uitslag));
}

// De munten vallen van boven op de tafel, de schuif duwt alles naar voren en trekt zich terug; wat
// over de rand gaat, rolt naar de bak of verdwijnt in een zijgat. `worp` komt van skGooi.
function schuifkastFilm(worp, { inzet = null } = {}) {
  const film = [];
  const alle = [...worp.voor, ...worp.erbij];
  const eruit = new Set(worp.gevallen.map(m => `${m.x}|${m.d}`));
  const blijft = alle.filter(m => !eruit.has(`${m.x}|${m.d}`));
  const voorBak = worp.gevallen.filter(m => !m.huis), voorGat = worp.gevallen.filter(m => m.huis);
  const glad = (t) => t * t * (3 - 2 * t);
  // 1. De nieuwe munten vallen erin: groot (dichtbij) en hoog, dan op hun plek.
  for (let f = 1; f <= 6; f++) {
    const t = f / 6;
    film.push({ svg: schuifkastBeeld(worp.voor, { inzet, extra: worp.erbij.map(m => munt(SK_X + m.x, skY(m.d) - 70 * (1 - t), 1 + 0.7 * (1 - t))).join('') }), ms: 60 });
  }
  // 2. De schuif duwt: alles schuift `duw` naar voren; wat over de rand gaat, blijft op de rand hangen.
  const N = 9, uitsteek = Math.min(worp.duw, 46);
  for (let f = 1; f <= N; f++) {
    const p = glad(f / N), dw = worp.duw * p;
    const verschoven = alle.map(m => ({ x: m.x, d: Math.max(m.d - dw, -SK_MUNT * 0.6) }));
    film.push({ svg: schuifkastBeeld(verschoven, { inzet, schuif: uitsteek * p }), ms: 70 });
  }
  // 3. De schuif gaat terug; de munten over de rand rollen naar de bak of vallen in een gat.
  const M = 6;
  for (let f = 1; f <= M; f++) {
    const t = glad(f / M);
    const naarBak = voorBak.map((m, i) => {
      const [bx, by] = bakPlek(i);
      return munt(SK_X + m.x + (bx - SK_X - m.x) * t, skY(-SK_MUNT * 0.6) + (by - skY(-SK_MUNT * 0.6)) * t, 1 - 0.28 * t);
    }).join('');
    const inGat = voorGat.map(m => munt(SK_X + m.x, skY(-SK_MUNT * 0.6) + 12 * t, 1 - 0.8 * t, 1 - t)).join('');
    film.push({ svg: schuifkastBeeld(blijft.map(m => ({ x: m.x, d: m.d - worp.duw })), { inzet, schuif: uitsteek * (1 - t), extra: naarBak + inGat }), ms: 70 });
  }
  film.push({ svg: schuifkastBeeld(worp.tafel.munten, { bak: worp.winst, huis: worp.huis, inzet }), ms: SLOT_MS });
  return film;
}

// ── De lobby ─────────────────────────────────────────────────────────────────

function lobbyBeeld() {
  const fiche = (x, y, kleur, n) => `<circle cx="${x}" cy="${y}" r="44" fill="${kleur}" stroke="#fff" stroke-width="6" stroke-dasharray="14 10"/>` +
    `<circle cx="${x}" cy="${y}" r="30" fill="${kleur}" stroke="#fff" stroke-width="2"/>` + tekst(x, y + 10, n, { maat: 28 });
  return laken(300, 'HET CASINO VAN DE KROKET GOD',
    fiche(170, 170, '#b3121f', 1) + fiche(285, 185, '#1d4ed8', 2) + fiche(400, 170, '#151515', 3) + fiche(515, 185, '#0f7a3d', 4) + fiche(630, 170, '#7c3aed', 5) +
    tekst(B / 2, 268, 'het huis wint altijd · behalve als het even niet oplet', { maat: 20, kleur: '#cfe9dc', gewicht: 'normal' }));
}

// ── Naar PNG ─────────────────────────────────────────────────────────────────

// DejaVu Sans zit in de repo (fonts/): de Docker-image op de server heeft geen enkel lettertype, en
// dan kwam er geen letter op de plaatjes. Alleen deze twee laden is ook sneller dan alle
// systeemlettertypen. Ontbreekt de map toch, dan zoekt resvg zelf.
const DEJAVU = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map(f => require('path').join(__dirname, '..', 'fonts', f));
let _lettertypen = null;
const lettertypen = () => (_lettertypen ||= DEJAVU.every(f => require('fs').existsSync(f))
  ? { fontFiles: DEJAVU, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' }
  : { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' });

function naarPng(svg) {
  const { Resvg } = require('@resvg/resvg-js');
  return new Resvg(svg, { font: lettertypen(), fitTo: { mode: 'width', value: 1000 } }).render().asPng();
}

// Een film als GIF die één keer afspeelt. Eén palet voor alle beelden (uit het eerste en het
// laatste), en elk volgend beeld schrijft alleen de pixels die veranderden; de rest is transparant
// en laat het vorige beeld staan. Zo kost een draaiend rad geen megabytes. renderAsync tekent buiten
// de hoofdthread, dus de bot blijft tussen de beelden door bereikbaar. Geeft { buf, duurMs }.
async function naarGif(film, { breedte = 600 } = {}) {
  const { renderAsync } = require('@resvg/resvg-js');
  const { GIFEncoder, quantize, applyPalette } = require('gifenc');
  const teken = (svg) => renderAsync(svg, { font: lettertypen(), fitTo: { mode: 'width', value: breedte } });
  const [eerste, laatste] = await Promise.all([teken(film[0].svg), teken(film.at(-1).svg)]);
  const samen = new Uint8Array(eerste.pixels.length + laatste.pixels.length);
  samen.set(eerste.pixels);
  samen.set(laatste.pixels, eerste.pixels.length);
  const kleuren = quantize(samen, 255);
  const LEEG = kleuren.length; // het extra vak dat "zelfde als hiervoor" betekent
  const palet = [...kleuren, [0, 0, 0]];
  const gif = GIFEncoder();
  let vorige = null;
  for (let i = 0; i < film.length; i++) {
    const beeld = i === 0 ? eerste : i === film.length - 1 ? laatste : await teken(film[i].svg);
    const index = applyPalette(beeld.pixels, kleuren);
    let schrijf = index;
    if (vorige) {
      schrijf = new Uint8Array(index.length);
      for (let p = 0; p < index.length; p++) schrijf[p] = index[p] === vorige[p] ? LEEG : index[p];
    }
    gif.writeFrame(schrijf, eerste.width, eerste.height, {
      ...(i === 0 ? { palette: palet, repeat: -1 } : { transparent: true, transparentIndex: LEEG }),
      delay: film[i].ms, dispose: 1,
    });
    vorige = index;
  }
  gif.finish();
  return { buf: Buffer.from(gif.bytes()), duurMs: film.reduce((som, b) => som + b.ms, 0) };
}

module.exports = {
  blackjackBeeld, rouletteBeeld, gokkastBeeld, hogerLagerBeeld, dobbelBeeld, schuifkastBeeld, lobbyBeeld, naarPng, kaartSvg, WIEL, DEJAVU,
  blackjackFilm, rouletteFilm, gokkastFilm, hogerLagerFilm, dobbelFilm, schuifkastFilm, naarGif,
};
