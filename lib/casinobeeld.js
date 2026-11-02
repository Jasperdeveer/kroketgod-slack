// ── Het Casino: de plaatjes ──────────────────────────────────────────────────
//
// Elke tafel als SVG (pure functies, zie casinobeeld.test.js), en naarPng maakt er een PNG van
// met resvg. Hosten en tonen gebeurt in index.js. Kleursymbolen zijn paden, geen tekens: zo hangt
// een kaart niet af van een lettertype. Tekst gebruikt DejaVu Sans uit fonts/ (zie naarPng).
// Er komt nooit een naam van een lid op een plaatje: ze staan openbaar op imgbb.

'use strict';

const { handWaarde, kleurVan, hlFactor, GOKKAST } = require('./casino.js');

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

function kaartSvg(kaart, x, y, { b = 96, dicht = false } = {}) {
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

// Een rij kaarten, gecentreerd rond `midden`; schuift in elkaar als het er veel zijn.
function kaartRij(kaarten, midden, y, { b = 96, dichtVanaf = Infinity } = {}) {
  const stap = Math.min(b + 14, 520 / Math.max(1, kaarten.length));
  const start = midden - (stap * (kaarten.length - 1) + b) / 2;
  return kaarten.map((k, i) => kaartSvg(k, start + i * stap, y, { b, dicht: i >= dichtVanaf })).join('');
}

const totaalBadge = (x, y, waarde) =>
  `<circle cx="${x}" cy="${y}" r="30" fill="#0b2e1f" stroke="${GOUD}" stroke-width="3"/>` + tekst(x, y + 10, waarde, { maat: 28 });

// `open`: de dichte kaart van de bank omgedraaid (de hand is klaar).
function blackjackBeeld(hand, { open = false, uitslag = null } = {}) {
  const H = uitslag ? 560 : 480;
  const rij = (label, kaarten, y, dicht, waarde) =>
    tekst(70, y + 75, label, { maat: 22, kleur: GOUD, anker: 'start' }) +
    kaartRij(kaarten, B / 2, y, { dichtVanaf: dicht }) +
    totaalBadge(B - 90, y + 67, waarde);
  const bank = handWaarde(open ? hand.bank : hand.bank.slice(0, 1)).totaal;
  return laken(H, 'BLACKJACK',
    rij('BANK', hand.bank, 85, open ? Infinity : 1, bank) +
    rij('U', hand.speler, 255, Infinity, handWaarde(hand.speler).totaal) +
    tekst(B / 2, 440, `inzet ${hand.inzet}${hand.verdubbeld ? ' · verdubbeld' : ''}`, { maat: 20, kleur: '#cfe9dc', gewicht: 'normal' }) +
    uitslagBalk(H, uitslag));
}

// ── Roulette ─────────────────────────────────────────────────────────────────

const WIEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const VAKKLEUR = { rood: '#b3121f', zwart: '#151515', groen: '#0f7a3d' };
const punt = (cx, cy, r, graden) => {
  const a = (graden * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)].map(n => n.toFixed(2));
};

// Het wiel, zo gedraaid dat het winnende vak bovenaan onder het balletje staat.
function rouletteBeeld(uitkomst, { inzetTekst = '', uitslag = null } = {}) {
  const H = 560;
  const cx = 245, cy = 285, rUit = 172, rIn = 118;
  const vak = 360 / WIEL.length;
  const draai = -90 - WIEL.indexOf(uitkomst) * vak;
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
    `<circle cx="${cx}" cy="${cy - rIn + 14}" r="10" fill="#fff" stroke="#999" stroke-width="1.5"/>` +
    `<path d="M${cx - 14} ${cy - rUit - 28}h28l-14 22z" fill="${GOUD}"/>` +
    `<circle cx="600" cy="230" r="92" fill="${VAKKLEUR[kleur]}" stroke="${GOUD}" stroke-width="5"/>` +
    tekst(600, 262, uitkomst, { maat: 92 }) +
    tekst(600, 360, kleur.toUpperCase(), { maat: 26, kleur: GOUD, extra: 'letter-spacing="4"' }) +
    (inzetTekst ? tekst(600, 400, inzetTekst, { maat: 20, kleur: '#cfe9dc', gewicht: 'normal' }) : '') +
    uitslagBalk(H, uitslag));
}

// ── Gokkast ──────────────────────────────────────────────────────────────────

// `plaatjes`: emoji-naam → data-URL. Ontbreekt er een, dan staat de naam op de rol.
function gokkastBeeld(rollen, plaatjes = {}, { uitslag = null } = {}) {
  const H = 560;
  const rolB = 150, gat = 26, x0 = (B - 3 * rolB - 2 * gat) / 2 - 20, y0 = 150;
  const vensters = rollen.map((r, i) => {
    const x = x0 + i * (rolB + gat);
    const beeld = plaatjes[r]
      ? `<image x="${x + 15}" y="${y0 + 15}" width="${rolB - 30}" height="${rolB - 30}" preserveAspectRatio="xMidYMid meet" xlink:href="${plaatjes[r]}"/>`
      : tekst(x + rolB / 2, y0 + rolB / 2 + 8, r.slice(0, 10), { maat: 18, kleur: '#333' });
    return `<rect x="${x}" y="${y0}" width="${rolB}" height="${rolB}" rx="14" fill="#fffdf7" stroke="${GOUD}" stroke-width="4"/>${beeld}`;
  }).join('');
  const hendelX = x0 + 3 * rolB + 2 * gat + 48;
  return laken(H, 'KROKET-O-MAAT',
    `<rect x="${x0 - 30}" y="${y0 - 40}" width="${3 * rolB + 2 * gat + 60}" height="${rolB + 80}" rx="24" fill="#7d1424" stroke="${GOUD}" stroke-width="4"/>` +
    vensters +
    `<line x1="${x0 - 18}" y1="${y0 + rolB / 2}" x2="${x0 + 3 * rolB + 2 * gat + 18}" y2="${y0 + rolB / 2}" stroke="${ROOD}" stroke-width="3" stroke-dasharray="10 6" opacity="0.8"/>` +
    `<rect x="${hendelX - 6}" y="${y0 - 10}" width="12" height="${rolB}" rx="6" fill="#9aa0a6"/><circle cx="${hendelX}" cy="${y0 - 18}" r="20" fill="${ROOD}" stroke="${GOUD}" stroke-width="3"/>` +
    uitbetaalRij(plaatjes, y0 + rolB + 62) +
    uitslagBalk(H, uitslag));
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

function hogerLagerBeeld(hand, { uitslag = null } = {}) {
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
    kleintjes + kaartSvg(open, 230, 205, { b: 130 }) +
    `<rect x="540" y="150" width="220" height="130" rx="18" fill="#0b2e1f" stroke="${GOUD}" stroke-width="3"/>` +
    tekst(650, 195, 'POT', { maat: 22, kleur: GOUD, extra: 'letter-spacing="4"' }) +
    tekst(650, 255, getal(hand.pot), { maat: 52 }) + kansen +
    tekst(560, 430, `inzet ${hand.inzet}`, { maat: 20, kleur: '#cfe9dc', anker: 'start', gewicht: 'normal' }) +
    uitslagBalk(H, uitslag));
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

function dobbelBeeld([a, b], { inzetTekst = '', uitslag = null } = {}) {
  const H = 560;
  return laken(H, 'DOBBELEN',
    steen(a, 150, 140, -8) + steen(b, 380, 150, 7) +
    tekst(650, 265, `= ${a + b}`, { maat: 64 }) +
    (inzetTekst ? tekst(B / 2, 420, inzetTekst, { maat: 20, kleur: '#cfe9dc', gewicht: 'normal' }) : '') +
    uitslagBalk(H, uitslag));
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
let _Resvg = null, _lettertypen = null;
function naarPng(svg) {
  _Resvg ||= require('@resvg/resvg-js').Resvg;
  _lettertypen ||= DEJAVU.every(f => require('fs').existsSync(f))
    ? { fontFiles: DEJAVU, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' }
    : { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' };
  return new _Resvg(svg, { font: _lettertypen, fitTo: { mode: 'width', value: 1000 } }).render().asPng();
}

module.exports = { blackjackBeeld, rouletteBeeld, gokkastBeeld, hogerLagerBeeld, dobbelBeeld, lobbyBeeld, naarPng, kaartSvg, WIEL, DEJAVU };
