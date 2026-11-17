// ── De weekvijand in beeld: een GIF van elke klap ────────────────────────────────
//
// Aanleiding (17 nov 2026): de eigenaar wilde het Frituurarsenaal zien werken. Bij elke aanval
// stuurt de weekvijand een zelfgetekende GIF waarin hij geraakt wordt. Ontwerp:
// docs/superpowers/specs/2026-11-17-weekvijand-gif-design.md.
//
// Puur: geen I/O, geen klok, geen Math.random. aanvalFilm en kanonFilm geven een film, een lijst
// { svg, ms }; naarGif (casinobeeld.js) maakt er een GIF van, index.js zet hem op R2. Er komt nooit
// een naam van een lid op een plaatje: R2 is openbaar.
//
// Opbouw: 52 snacks (UITERLIJK) delen 14 vormen (VORMEN), elk met eigen kleuren, binnenkant en
// beleg (BELEG). Een lijf tekent zichzelf met een toestand (squash, kleur, ogen, gaten, folie…).
// Elk wapen (WAPENBEELD) heeft een pose per fase (intro, aanloop, slag, na) en een effect op het lijf.

'use strict';

const W = 480, H = 400, GROND = 332;
const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif';
const GOUD = '#f2c14e';
const LIJN = '#2b0d03';

// ── Gereedschap ──────────────────────────────────────────────────────────────

const klem = (t) => Math.max(0, Math.min(1, t));
const uit = (t) => 1 - (1 - klem(t)) ** 3;
const in3 = (t) => klem(t) ** 3;
const inUit = (t) => { t = klem(t); return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2; };
const terug = (t) => { t = klem(t); const a = 1.70158; return 1 + (a + 1) * (t - 1) ** 3 + a * (t - 1) ** 2; };
const veer = (t) => { t = klem(t); return t === 0 ? 0 : t === 1 ? 1 : 2 ** (-9 * t) * Math.sin((t * 10 - 0.75) * 2 * Math.PI / 3) + 1; };
const lerp = (a, b, t) => a + (b - a) * t;
const f = (n) => Math.round(n * 10) / 10;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Vast toeval: dezelfde vijand en hetzelfde wapen geven dezelfde kruimels (testbaar, en rustig).
function zaad(tekst) {
  let s = 2166136261;
  for (const c of String(tekst)) s = Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

const tekst = (x, y, inhoud, { maat = 22, kleur = '#fff', anker = 'middle', rand = null, randB = 0, extra = '' } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${f(maat)}" font-weight="bold" fill="${kleur}" text-anchor="${anker}"` +
  (rand ? ` stroke="${rand}" stroke-width="${randB}" stroke-linejoin="round" paint-order="stroke"` : '') + ` ${extra}>${esc(inhoud)}</text>`;

function ster(x, y, r, kleur, punten = 4, binnen = 0.3, extra = '') {
  const p = [];
  for (let i = 0; i < punten * 2; i++) {
    const a = Math.PI * i / punten - Math.PI / 2, rr = i % 2 ? r * binnen : r;
    p.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${kleur}" ${extra}/>`;
}

const plaats = (svg, x, y, hoek = 0, s = 1) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(hoek)}) scale(${f(s * 100) / 100})">${svg}</g>`;

// Paden rond (0,0).
const rond = (x, y, b, h, r) =>
  `M${x + r},${y}H${x + b - r}A${r},${r} 0 0 1 ${x + b},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + b - r},${y + h}` +
  `H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
const ovaal = (x, y, rx, ry) => `M${x - rx},${y}A${rx},${ry} 0 1 0 ${x + rx},${y}A${rx},${ry} 0 1 0 ${x - rx},${y}Z`;

// ── Kleuren en snacks ────────────────────────────────────────────────────────
// [licht, basis, donker] voor het verloop van het lijf.

const P = {
  paneer: ['#f6c46c', '#d98c35', '#8f4a14'],
  donkerpaneer: ['#d9954a', '#a8601f', '#5c2e0b'],
  goud: ['#ffd88a', '#e8a33e', '#9a5a14'],
  frikandel: ['#b0714a', '#7a3b1c', '#3f1a08'],
  worst: ['#e8957a', '#b85a3a', '#6a2a14'],
  gehakt: ['#a5694a', '#6e3a20', '#3a1a0a'],
  duister: ['#6e5236', '#3d2a18', '#170c05'],
  nasi: ['#f0a35a', '#c8662a', '#7a3010'],
  kroepoek: ['#fffbea', '#f1e2bc', '#c4ae80'],
  brood: ['#f8c983', '#d48a3a', '#8a4f17'],
  volkoren: ['#e8c48e', '#b9834a', '#6e4318'],
  pita: ['#f9e2b6', '#e2b878', '#a07a3a'],
  bapao: ['#ffffff', '#f3ede3', '#c9bfae'],
  oliebol: ['#c98f50', '#8a5420', '#4a2808'],
  ui: ['#ffe39a', '#e8b04a', '#9a6a1a'],
  vis: ['#ffd98e', '#e3a445', '#9a5a14'],
  haring: ['#eef4fa', '#9fb3c8', '#4f6478'],
  mars: ['#ecb878', '#b06a2a', '#5a2a0a'],
  pikanto: ['#ff9a6a', '#d9542a', '#7a1f08'],
  mexicano: ['#e89a6a', '#b0502a', '#5a1a08'],
  kipcorn: ['#ffc46a', '#f08a24', '#9a4a0a'],
  bleek: ['#f8e6b4', '#e3c483', '#a8874a'],
  slap: ['#efe2bf', '#d4c08e', '#958461'],
  vals: ['#e9d77e', '#bfa43c', '#6a5a14'],
  bladerdeeg: ['#fff2c4', '#efc66e', '#b07a2a'],
  friet: ['#fff0a0', '#f2c84a', '#b88a1a'],
  mayo: ['#fffef6', '#f7efcf', '#cfc39a'],
  joppie: ['#ffe68e', '#f2c037', '#b8860b'],
};
const B = {
  ragout: '#f0d39a', vlees: '#b8705a', kaas: '#ffd84a', deeg: '#fff3dc', mie: '#e8c060', rijst: '#f4cf7a',
  appel: '#f6e7b0', choco: '#5a2f17', vis: '#fffaf0', kip: '#fbefd8', groente: '#b9c97a', ui: '#fbf6e6', vals: '#c8c0b0',
};

// Elke weekvijand-sleutel uit index.js (WEEKVIJANDEN). Een onbekende sleutel wordt een bal (zie uiterlijkVan).
const UITERLIJK = {
  bamischijf:            { vorm: 'schijf', kleur: P.duister, binnen: B.mie, beleg: ['mie'], korrel: true },
  hamburger:             { vorm: 'broodje', kleur: P.brood, binnen: B.vlees, beleg: ['sesam'], vulling: ['sla', 'burger'] },
  kaassouffle:           { vorm: 'kussen', kleur: P.goud, binnen: B.kaas, beleg: ['kaasdruip'], korrel: true },
  frikandel_speciaal:    { vorm: 'staaf', kleur: P.frikandel, binnen: B.vlees, beleg: ['mayo', 'curry', 'ui'] },
  bitterbal:             { vorm: 'bal', kleur: P.donkerpaneer, binnen: B.ragout, beleg: ['mosterd'], korrel: true, klein: true },
  kipcorn:               { vorm: 'staaf', kleur: P.kipcorn, binnen: B.kip, beleg: ['korrelgrof'], korrel: true },
  berenklauw:            { vorm: 'spies', kleur: P.gehakt, binnen: B.vlees, beleg: ['uien', 'satesaus'] },
  mexicano:              { vorm: 'staaf', kleur: P.mexicano, binnen: B.vlees, beleg: ['chili', 'groeven'] },
  nasischijf:            { vorm: 'schijf', kleur: P.nasi, binnen: B.rijst, beleg: ['rijst'], korrel: true },
  patatje_oorlog:        { vorm: 'bakje', kleur: P.friet, binnen: B.ui, beleg: ['mayo', 'satesaus', 'ui'] },
  loempia:               { vorm: 'staaf', kleur: P.goud, binnen: B.groente, beleg: ['groeven'] },
  gehaktstaaf:           { vorm: 'staaf', kleur: P.donkerpaneer, binnen: B.vlees, korrel: true },
  kroepoek:              { vorm: 'schijf', kleur: P.kroepoek, binnen: B.deeg, beleg: ['golf'] },
  viandel:               { vorm: 'staaf', kleur: P.donkerpaneer, binnen: B.vlees, beleg: ['korrelgrof'], korrel: true },
  vlammetjes:            { vorm: 'rollen', kleur: P.goud, binnen: B.vlees, beleg: ['chili'] },
  eierbal:               { vorm: 'bal', kleur: P.paneer, binnen: B.ragout, korrel: true, ei: true },
  kipnuggets:            { vorm: 'stapel', kleur: P.goud, binnen: B.kip, korrel: true },
  patat_met:             { vorm: 'bakje', kleur: P.friet, binnen: B.ui, beleg: ['mayo'] },
  joppiesaus:            { vorm: 'saus', kleur: P.joppie, binnen: '#ffe27a', beleg: ['spikkels'] },
  curryworst:            { vorm: 'staaf', kleur: P.worst, binnen: B.vlees, beleg: ['curry'] },
  shoarma:               { vorm: 'broodje', kleur: P.pita, binnen: B.vlees, vulling: ['shoarma', 'knoflooksaus'] },
  kapsalon:              { vorm: 'bakje', kleur: P.friet, binnen: B.kaas, bak: 'folie', beleg: ['shoarmavlees', 'kaaslaag', 'sla'] },
  broodje_bal:           { vorm: 'broodje', kleur: P.brood, binnen: B.vlees, vulling: ['bal'] },
  slavink:               { vorm: 'staaf', kleur: P.gehakt, binnen: B.vlees, beleg: ['spek'] },
  saucijzenbroodje:      { vorm: 'staaf', kleur: P.bladerdeeg, binnen: B.vlees, beleg: ['bladerdeeg'] },
  pikanto:               { vorm: 'staaf', kleur: P.pikanto, binnen: B.vlees, beleg: ['chili'], korrel: true },
  bapao:                 { vorm: 'bal', kleur: P.bapao, binnen: B.vlees, beleg: ['rodestip'] },
  ui_ringen:             { vorm: 'ring', kleur: P.ui, binnen: B.ui, korrel: true },
  frietsaus:             { vorm: 'saus', kleur: P.mayo, binnen: '#fff8dc' },
  gefrituurde_mars:      { vorm: 'staaf', kleur: P.mars, binnen: B.choco, beleg: ['karamel'] },
  oliebol:               { vorm: 'bal', kleur: P.oliebol, binnen: '#f0d9a8', beleg: ['poedersuiker', 'rozijnen'] },
  appelbeignet:          { vorm: 'ring', kleur: P.goud, binnen: B.appel, beleg: ['poedersuiker'] },
  kibbeling:             { vorm: 'stapel', kleur: P.vis, binnen: B.vis, korrel: true },
  lekkerbekje:           { vorm: 'vis', kleur: P.vis, binnen: B.vis, korrel: true },
  kaastengel:            { vorm: 'staaf', kleur: P.goud, binnen: B.kaas, beleg: ['kaasdruip'], korrel: true },
  patat_speciaal:        { vorm: 'bakje', kleur: P.friet, binnen: B.ui, beleg: ['mayo', 'curry', 'ui'] },
  broodje_gezond:        { vorm: 'broodje', kleur: P.volkoren, binnen: B.kaas, beleg: ['zaden'], vulling: ['sla', 'tomaat', 'ei', 'kaas'] },
  valse_kroket:          { vorm: 'staaf', kleur: P.vals, binnen: B.vals, beleg: ['snor'], korrel: true },
  airfryer_kroket:       { vorm: 'staaf', kleur: P.bleek, binnen: B.ragout, beleg: ['lucht'], korrel: true },
  magnetron_kroket:      { vorm: 'staaf', kleur: P.slap, binnen: '#e8d8b0', beleg: ['zweet'] },
  hotdog:                { vorm: 'staaf', kleur: P.worst, binnen: B.vlees, beleg: ['hotdogbrood', 'mosterd'], gezicht: { y: -14 } },
  cheeseburger:          { vorm: 'broodje', kleur: P.brood, binnen: B.vlees, beleg: ['sesam'], vulling: ['kaas', 'burger'] },
  frikandel_xxl:         { vorm: 'langstaaf', kleur: P.frikandel, binnen: B.vlees, beleg: ['mayo'] },
  zure_haring:           { vorm: 'vis', kleur: P.haring, binnen: '#f4f0ea', beleg: ['uitjes'] },
  bamiblok:              { vorm: 'blok', kleur: P.donkerpaneer, binnen: B.mie, korrel: true },
  mini_loempia:          { vorm: 'rollen', kleur: P.goud, binnen: B.groente, beleg: ['groeven'] },
  gehaktbal:             { vorm: 'bal', kleur: P.gehakt, binnen: B.vlees, beleg: ['spikkels'] },
  tosti:                 { vorm: 'blok', kleur: P.brood, binnen: B.kaas, beleg: ['grill', 'kaasdruip'] },
  kaasstengel_xl:        { vorm: 'langstaaf', kleur: P.goud, binnen: B.kaas, beleg: ['kaasdruip'], korrel: true },
  friet_speciaal_oorlog: { vorm: 'bakje', kleur: P.friet, binnen: B.ui, beleg: ['mayo', 'curry', 'satesaus', 'ui'] },
  sitostick:             { vorm: 'langstaaf', kleur: P.paneer, binnen: B.vlees, korrel: true },
  krokante_ui:           { vorm: 'stapel', kleur: P.ui, binnen: B.ui, beleg: ['krullen'] },
};
const STANDAARD = { vorm: 'bal', kleur: P.paneer, binnen: B.ragout, korrel: true };
const uiterlijkVan = (key) => UITERLIJK[key] || STANDAARD;

// ── Vormen ───────────────────────────────────────────────────────────────────
// h: van het midden naar de grond; bw: halve breedte; top: de bovenkant (negatief); pad: het
// silhouet rond (0,0); gezicht: plek en schaal; stukken: losse delen die elk een eigen rand krijgen.

const STAPEL = [[0, -30, 60, 52], [-58, 20, 60, 50], [60, 22, 58, 48]];
const ROLLEN = [[0, -40, 160, 64], [-76, 22, 160, 64], [76, 24, 160, 64]];
const SPIES = [[-84, 0, 52, 52], [84, 0, 52, 52], [0, 0, 56, 56]];

const VORMEN = {
  bal:       { h: 90, bw: 90, top: -90, pad: ovaal(0, 0, 90, 90), gezicht: { x: 0, y: -2, s: 1 } },
  staaf:     { h: 50, bw: 132, top: -50, pad: rond(-132, -50, 264, 100, 50), gezicht: { x: 0, y: 2, s: 0.85 } },
  langstaaf: { h: 44, bw: 162, top: -44, pad: rond(-162, -44, 324, 88, 44), gezicht: { x: -14, y: 2, s: 0.78 } },
  schijf:    { h: 62, bw: 118, top: -62, pad: 'M-118,-30A118,32 0 0 1 118,-30V30A118,32 0 0 1 -118,30Z', gezicht: { x: 0, y: 18, s: 0.8 } },
  ring:      { h: 86, bw: 86, top: -86, pad: ovaal(0, 0, 86, 86) + ovaal(0, 0, 30, 30), regel: 'evenodd', gezicht: { x: 0, y: -55, s: 0.5 } },
  blok:      { h: 72, bw: 100, top: -72, pad: rond(-100, -72, 200, 144, 22), gezicht: { x: 0, y: 0, s: 1 } },
  kussen:    { h: 46, bw: 130, top: -80, pad: 'M-130,46C-130,-34 -72,-80 0,-80C72,-80 130,-34 130,46Z', gezicht: { x: 0, y: -8, s: 0.88 } },
  bakje:     { h: 78, bw: 106, top: -122, pad: 'M-106,-4L-98,-104L-62,-122L-14,-112L30,-124L70,-110L98,-102L106,-4L90,78L-90,78Z', gezicht: { x: 0, y: 36, s: 0.66 } },
  broodje:   { h: 76, bw: 114, top: -98, pad: 'M-114,8C-114,-72 -62,-98 0,-98C62,-98 114,-72 114,8V58Q114,76 96,76H-96Q-114,76 -114,58Z', gezicht: { x: 0, y: -46, s: 0.76 } },
  vis:       { h: 60, bw: 134, top: -62, pad: 'M-134,0C-114,-60 36,-68 92,-14L134,-54L124,0L134,54L92,14C36,68 -114,60 -134,0Z', gezicht: { x: -58, y: -2, s: 0.72 } },
  saus:      { h: 88, bw: 96, top: -114, pad: 'M0,-114C30,-72 96,-32 96,20C96,66 54,88 0,88C-54,88 -96,66 -96,20C-96,-32 -30,-72 0,-114Z', gezicht: { x: 0, y: 22, s: 0.9 } },
  stapel:    { h: 72, bw: 118, top: -82, pad: STAPEL.map(([x, y, rx, ry]) => ovaal(x, y, rx, ry)).join(''), stukken: STAPEL, gezicht: { x: 0, y: -38, s: 0.6 } },
  rollen:    { h: 56, bw: 156, top: -72, pad: ROLLEN.map(([x, y, b, h]) => rond(x - b / 2, y - h / 2, b, h, h / 2)).join(''), stukken: ROLLEN, rol: true, gezicht: { x: 0, y: -40, s: 0.64 } },
  spies:     { h: 56, bw: 136, top: -56, pad: SPIES.map(([x, y, rx, ry]) => ovaal(x, y, rx, ry)).join(''), stukken: SPIES, gezicht: { x: 0, y: -2, s: 0.66 } },
};
const vormVan = (u) => {
  const v = VORMEN[u.vorm] || VORMEN.bal;
  return u.gezicht ? { ...v, gezicht: { ...v.gezicht, ...u.gezicht } } : v;
};

// Wat bij een vorm hoort, binnen het silhouet: het bovenvlak van een schijf, friet en bakje, de
// lagen van een broodje, vinnen van een vis.
function vormDetail(u, v, r) {
  const [licht, , donker] = u.kleur;
  switch (u.vorm) {
    case 'schijf':
      return `<ellipse cx="0" cy="-30" rx="118" ry="32" fill="${licht}" fill-opacity="0.45"/>` +
        `<path d="M-118,-30A118,32 0 0 0 118,-30" fill="none" stroke="${donker}" stroke-opacity="0.55" stroke-width="3"/>`;
    case 'blok':
      return `<rect x="-100" y="-72" width="200" height="20" fill="${licht}" fill-opacity="0.35"/>`;
    case 'kussen':
      return Array.from({ length: 12 }, (_, i) => `<path d="M${-121 + i * 22},46q11,-12 22,0" fill="none" stroke="${donker}" stroke-opacity="0.6" stroke-width="3"/>`).join('');
    case 'bakje': {
      const friet = Array.from({ length: 11 }, (_, i) => {
        const x = -92 + i * 18 + (r() - 0.5) * 6, top = -104 - r() * 18, hoek = (r() - 0.5) * 16;
        return `<rect x="${f(x)}" y="${f(top)}" width="15" height="${f(-top + 6)}" rx="3" fill="${i % 2 ? '#f6d25a' : '#fbe27a'}" stroke="#b88a1a" stroke-width="2.5" transform="rotate(${f(hoek)} ${f(x + 7)} 0)"/>`;
      }).join('');
      const folie = u.bak === 'folie';
      const bak = `<path d="M-108,-6L108,-6L92,80L-92,80Z" fill="${folie ? '#c9d1d9' : '#fbfaf6'}" stroke="${folie ? '#6b7682' : '#9a948a'}" stroke-width="3"/>` +
        (folie
          ? [-60, -20, 25, 64].map(x => `<path d="M${x},-4l-8,82" stroke="#fff" stroke-opacity="0.6" stroke-width="5"/>`).join('')
          : [-72, -40, -8, 24, 56].map(x => `<path d="M${x},-6l${f(-x * 0.1)},86" stroke="#d62828" stroke-width="9" stroke-opacity="0.85"/>`).join(''));
      return friet + bak;
    }
    case 'broodje': return vulling(u);
    case 'vis':
      return `<path d="M-40,-50Q0,-80 40,-48" fill="${donker}" fill-opacity="0.5"/>` +
        [-70, -40, -10, 20, 50].map(x => `<path d="M${x},-24q12,24 0,48" fill="none" stroke="${donker}" stroke-opacity="0.35" stroke-width="3"/>`).join('') +
        `<path d="M100,-10L126,-40M100,10L126,40" stroke="${donker}" stroke-opacity="0.5" stroke-width="3"/>` +
        (u.kleur === P.haring ? `<path d="M-130,6C-60,24 40,22 92,8" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="10"/>` : '');
    default: return '';
  }
}

// De lagen tussen de broodjeshelften, van boven naar beneden vanaf y = -4.
function vulling(u) {
  let y = -4, lagen = '';
  const golf = (y0, kleur, dik, rand) => {
    let d = `M-118,${y0}`;
    for (let x = -118; x < 118; x += 24) d += `q12,${-6} 24,0`;
    return `<path d="${d}V${y0 + dik}H-118Z" fill="${kleur}" stroke="${rand}" stroke-width="2.5"/>`;
  };
  for (const laag of u.vulling || []) {
    if (laag === 'sla') { lagen += golf(y, '#5dbb46', 10, '#2f7a24'); y += 10; }
    if (laag === 'burger') { lagen += `<rect x="-118" y="${y}" width="236" height="22" rx="8" fill="#6a3418" stroke="#3a1a0a" stroke-width="2.5"/>` + [-80, -30, 20, 70].map(x => `<rect x="${x}" y="${y + 9}" width="22" height="4" rx="2" fill="#3a1a0a"/>`).join(''); y += 22; }
    if (laag === 'kaas') { lagen += `<path d="M-118,${y}H118L104,${y + 8}L84,${y + 22}L66,${y + 8}H-60L-80,${y + 22}L-96,${y + 8}Z" fill="#ffd23f" stroke="#c89a0a" stroke-width="2.5"/>`; y += 8; }
    if (laag === 'tomaat') { lagen += `<rect x="-118" y="${y}" width="236" height="10" rx="5" fill="#e0402a" stroke="#8a1a0a" stroke-width="2"/>`; y += 10; }
    if (laag === 'ei') { lagen += `<rect x="-118" y="${y}" width="236" height="12" rx="6" fill="#fffdf4" stroke="#cfc6b0" stroke-width="2"/>` + [-60, 0, 60].map(x => `<ellipse cx="${x}" cy="${y + 6}" rx="12" ry="5" fill="#ffc21a"/>`).join(''); y += 12; }
    if (laag === 'shoarma') { lagen += `<rect x="-118" y="${y}" width="236" height="22" fill="#9a5a2a"/>` + [-90, -50, -10, 30, 70].map((x, i) => `<path d="M${x},${y + 4}q10,${i % 2 ? 8 : -2} 26,4" stroke="#5a2a0a" stroke-width="4" fill="none"/>`).join(''); y += 22; }
    if (laag === 'knoflooksaus') { lagen += golf(y, '#fffdf2', 7, '#d8d0b8'); y += 7; }
    if (laag === 'bal') { lagen += `<ellipse cx="0" cy="${y + 18}" rx="98" ry="30" fill="#6e3a20" stroke="#3a1a0a" stroke-width="3"/><ellipse cx="-30" cy="${y + 8}" rx="24" ry="7" fill="#fff" fill-opacity="0.2"/>`; y += 34; }
  }
  // Tussen boven- en onderhelft een donkere naad, zodat het broodje ook zonder beleg een broodje is.
  return lagen + `<path d="M-114,-4H114" stroke="#000" stroke-opacity="0.25" stroke-width="3"/><path d="M-114,${y}H114" stroke="#000" stroke-opacity="0.25" stroke-width="3"/>`;
}

// ── Beleg ────────────────────────────────────────────────────────────────────
// laag: 'achter' (achter het lijf), 'op' (binnen het silhouet, onder het gezicht), 'boven' (erop,
// buiten het silhouet), 'gezicht' (over het gezicht heen). r: vast toeval per snack.

const LIJNVORMEN = new Set(['staaf', 'langstaaf', 'schijf', 'kussen', 'blok']);

// Een saus over de bovenkant: een golvende lijn bij staven en schijven, klodders bij de rest.
function sausOp(v, kleur, rand, verschuif = 0) {
  if (LIJNVORMEN.has(v.naam)) {
    const y = v.top + 12 + verschuif, b = v.bw * 0.72;
    let d = `M${f(-b)},${y}`;
    for (let x = -b; x < b; x += 26) d += `q13,${verschuif % 2 ? 9 : -9} 26,0`;
    return `<path d="${d}" fill="none" stroke="${rand}" stroke-width="15" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${kleur}" stroke-width="10" stroke-linecap="round"/>`;
  }
  const x = verschuif * 5, y = v.naam === 'bakje' ? -108 + verschuif : v.top + 12;
  return `<path d="M${x - 34},${y + 4}q4,-16 34,-16q30,0 34,16q-4,10 -14,8q-2,14 -8,14q-6,0 -8,-12q-22,6 -38,-10z" fill="${kleur}" stroke="${rand}" stroke-width="3"/>`;
}
const stippen = (r, v, n, kleur, { min = 1.5, max = 3.5, rand = '' } = {}) =>
  Array.from({ length: n }, () => `<circle cx="${f((r() * 2 - 1) * v.bw * 0.85)}" cy="${f(v.top + 8 + r() * (v.h - v.top - 16))}" r="${f(min + r() * (max - min))}" fill="${kleur}"${rand}/>`).join('');
const blokjes = (r, v, n, kleur, rand) =>
  Array.from({ length: n }, () => {
    const x = (r() * 2 - 1) * v.bw * 0.55, y = (v.naam === 'bakje' ? -112 : v.top + 6) + r() * 12;
    return `<rect x="${f(x)}" y="${f(y)}" width="8" height="8" rx="1.5" fill="${kleur}" stroke="${rand}" stroke-width="1.5" transform="rotate(${f(r() * 90)} ${f(x + 4)} ${f(y + 4)})"/>`;
  }).join('');

const BELEG = {
  mayo:          { laag: 'boven', teken: (v) => sausOp(v, '#fffaf0', '#cfc39a', 0) },
  curry:         { laag: 'boven', teken: (v) => sausOp(v, '#d81e2c', '#7a0a12', 3) },
  satesaus:      { laag: 'boven', teken: (v) => sausOp(v, '#8a4a16', '#4a2208', -6) },
  mosterd:       { laag: 'boven', teken: (v) => (LIJNVORMEN.has(v.naam) ? sausOp(v, '#f2c81a', '#9a7a0a', 1).replace(/stroke-width="10"/, 'stroke-width="6"').replace(/stroke-width="15"/, 'stroke-width="10"') : `<ellipse cx="0" cy="${v.top + 8}" rx="16" ry="8" fill="#f2c81a" stroke="#9a7a0a" stroke-width="3"/>`) },
  ui:            { laag: 'boven', teken: (v, r) => blokjes(r, v, 9, '#f6efe0', '#a89a7a') },
  uitjes:        { laag: 'boven', teken: (v, r) => blokjes(r, v, 12, '#fbf8f0', '#9aa8b8') },
  chili:         { laag: 'op', teken: (v, r) => stippen(r, v, 16, '#c8102e', { min: 2, max: 4 }) },
  poedersuiker:  { laag: 'op', teken: (v, r) => Array.from({ length: 60 }, () => `<circle cx="${f((r() * 2 - 1) * v.bw)}" cy="${f(v.top + r() * v.bw * 0.9)}" r="${f(1.2 + r() * 2)}" fill="#fff"/>`).join('') },
  rozijnen:      { laag: 'op', teken: (v, r) => stippen(r, v, 8, '#3a1606', { min: 4, max: 6 }) },
  spikkels:      { laag: 'op', teken: (v, r) => stippen(r, v, 22, '#7a4a1a', { min: 1, max: 2.4 }) },
  korrelgrof:    { laag: 'op', teken: (v, r) => stippen(r, v, 26, '#6a3410', { min: 3, max: 5.5 }) },
  sesam:         { laag: 'op', teken: (v, r) => Array.from({ length: 14 }, () => { const x = (r() * 2 - 1) * 80, y = -90 + r() * 40; return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4.5" ry="2.6" fill="#fff6dc" stroke="#c8a870" stroke-width="1" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`; }).join('') },
  zaden:         { laag: 'op', teken: (v, r) => stippen(r, { ...v, h: -40 }, 24, '#7a5a2a', { min: 1.5, max: 3 }) },
  rodestip:      { laag: 'boven', teken: (v) => `<circle cx="0" cy="${v.top + 14}" r="7" fill="#e0302a"/>` },
  groeven:       { laag: 'op', teken: (v) => Array.from({ length: 9 }, (_, i) => `<path d="M${-v.bw + 20 + i * v.bw / 4.5},${v.top}l-30,${v.h - v.top}" stroke="#000" stroke-opacity="0.18" stroke-width="5"/>`).join('') },
  spek:          { laag: 'op', teken: (v) => [-70, 0, 70].map(x => `<path d="M${x - 14},${v.top}q18,${(v.h - v.top) / 2} 0,${v.h - v.top}h22q18,-${(v.h - v.top) / 2} 0,-${v.h - v.top}z" fill="#f0a898" stroke="#fff" stroke-width="3"/>`).join('') },
  bladerdeeg:    { laag: 'op', teken: (v) => [-30, -15, 0, 15, 30].map(y => `<path d="M${-v.bw},${y}H${v.bw}" stroke="#b07a2a" stroke-opacity="0.45" stroke-width="2.5"/>`).join('') },
  karamel:       { laag: 'boven', teken: (v) => { let d = `M${-v.bw * 0.7},${v.top + 8}`; for (let i = 0; i < 8; i++) d += `l${f(v.bw * 0.175)},${i % 2 ? -10 : 10}`; return `<path d="${d}" fill="none" stroke="#5a2f17" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`; } },
  grill:         { laag: 'op', teken: (v) => [-60, -20, 20, 60].map(x => `<path d="M${x - 40},${v.top}l80,${v.h - v.top}" stroke="#6a3a10" stroke-opacity="0.55" stroke-width="8"/>`).join('') },
  kaasdruip:     { laag: 'boven', teken: (v, r) => Array.from({ length: 4 }, (_, i) => { const x = -v.bw * 0.6 + i * v.bw * 0.4 + r() * 10, l = 10 + r() * 16; return `<path d="M${f(x - 8)},${v.h - 14}h16v${f(l)}a8,8 0 0 1 -16,0z" fill="#ffd23f" stroke="#c89a0a" stroke-width="2"/>`; }).join('') },
  mie:           { laag: 'op', teken: (v, r) => Array.from({ length: 9 }, () => { const x = (r() * 2 - 1) * 80, y = -48 + r() * 30; return `<path d="M${f(x)},${f(y)}q8,-8 16,0t16,0t16,0" fill="none" stroke="#f2cf5a" stroke-width="4" stroke-linecap="round"/>`; }).join('') },
  rijst:         { laag: 'op', teken: (v, r) => Array.from({ length: 34 }, () => { const x = (r() * 2 - 1) * 96, y = -52 + r() * 40; return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4" ry="2" fill="#fff4d0" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`; }).join('') },
  golf:          { laag: 'op', teken: (v, r) => [-34, -8, 18].map(y => `<path d="M-118,${y}q30,-12 60,0t60,0t60,0t60,0" fill="none" stroke="#c4ae80" stroke-opacity="0.6" stroke-width="3"/>`).join('') + stippen(r, v, 10, '#fff', { min: 2, max: 5 }) },
  uien:          { laag: 'boven', teken: () => [-42, 42].map(x => `<rect x="${x - 10}" y="-30" width="20" height="60" rx="8" fill="#f6efe0" stroke="#a89a7a" stroke-width="3"/>`).join('') },
  krullen:       { laag: 'op', teken: (v, r) => Array.from({ length: 12 }, () => { const x = (r() * 2 - 1) * 90, y = -60 + r() * 100; return `<path d="M${f(x)},${f(y)}a10,6 0 1 1 14,4" fill="none" stroke="#9a5a14" stroke-width="3"/>`; }).join('') },
  hotdogbrood:   { laag: 'achter', teken: (v) => `<path d="${rond(-v.bw - 18, -6, (v.bw + 18) * 2, 64, 32)}" fill="#e8a75a" stroke="#8a4f17" stroke-width="4"/>` },
  snor:          { laag: 'gezicht', teken: (v) => { const g = v.gezicht; return `<g transform="translate(${g.x} ${g.y + 16 * g.s}) scale(${g.s})"><path d="M0,0C-10,-12 -40,-14 -52,2C-40,-4 -24,4 -12,6C-6,7 -2,4 0,2C2,4 6,7 12,6C24,4 40,-4 52,2C40,-14 10,-12 0,0Z" fill="#2a1408" stroke="#000" stroke-width="2"/></g>`; } },
  lucht:         { laag: 'boven', teken: (v) => [-50, 0, 50].map(x => `<path d="M${x},${v.top - 10}q-10,-10 0,-20t0,-20" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round"/>`).join('') },
  zweet:         { laag: 'boven', teken: (v) => [[-v.bw - 6, -10], [v.bw + 4, -16], [v.bw * 0.5, v.top - 6]].map(([x, y]) => `<path d="M${x},${y - 12}q8,12 0,16q-8,-4 0,-16z" fill="#8fd0ff" stroke="#2a6a9a" stroke-width="2"/>`).join('') },
  shoarmavlees:  { laag: 'boven', teken: (v, r) => Array.from({ length: 7 }, () => { const x = (r() * 2 - 1) * 70, y = -112 + r() * 14; return `<path d="M${f(x)},${f(y)}q12,-6 26,2" stroke="#7a3a14" stroke-width="7" stroke-linecap="round" fill="none"/>`; }).join('') },
  kaaslaag:      { laag: 'boven', teken: () => `<path d="M-96,-100Q-60,-128 -10,-116Q40,-130 96,-102Q90,-90 76,-94Q70,-80 62,-94Q20,-90 -30,-96Q-40,-82 -48,-96Q-80,-90 -96,-100Z" fill="#ffd23f" fill-opacity="0.92" stroke="#c89a0a" stroke-width="2.5"/>` },
  sla:           { laag: 'boven', teken: () => [[-60, -118], [10, -126], [66, -114]].map(([x, y]) => `<path d="M${x},${y}q14,-14 26,0q-6,10 -26,0z" fill="#5dbb46" stroke="#2f7a24" stroke-width="2"/>`).join('') },
};

// ── Het lijf ─────────────────────────────────────────────────────────────────

function gezicht(g, { ogen = 'boos', kijk = { x: 0, y: 0 }, mond = 'grijns', razend = false }) {
  const wit = razend ? '#ffc4ba' : '#fff';
  const oog = (sx) => {
    const x = sx * 30, y = -14;
    if (ogen === 'dicht') {
      const p = sx < 0 ? `${x - 13},${y - 10} ${x + 9},${y} ${x - 13},${y + 10}` : `${x + 13},${y - 10} ${x - 9},${y} ${x + 13},${y + 10}`;
      return `<polyline points="${p}" fill="none" stroke="${LIJN}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (ogen === 'x') return `<path d="M${x - 11},${y - 11}l22,22M${x + 11},${y - 11}l-22,22" stroke="${LIJN}" stroke-width="7" stroke-linecap="round"/>`;
    if (ogen === 'duizelig') return `<circle cx="${x}" cy="${y}" r="17" fill="${wit}" stroke="${LIJN}" stroke-width="4"/><path d="M${x},${y}m-2,0a2,2 0 1 1 4,0a5,5 0 1 1 -9,0a8,8 0 1 1 15,1a11,11 0 1 1 -21,-1" fill="none" stroke="${LIJN}" stroke-width="2.5"/>`;
    const bang = ogen === 'bang';
    return `<ellipse cx="${x}" cy="${y}" rx="${bang ? 19 : 17}" ry="${bang ? 23 : 19}" fill="${wit}" stroke="${LIJN}" stroke-width="4"/>` +
      `<circle cx="${f(x + kijk.x * 6)}" cy="${f(y + kijk.y * 6)}" r="${bang ? 5 : 8}" fill="${razend ? '#b0000f' : '#1a0802'}"/>` +
      `<circle cx="${f(x + kijk.x * 6 - 2.5)}" cy="${f(y + kijk.y * 6 - 3)}" r="2.2" fill="#fff"/>`;
  };
  const wenk = (sx) => {
    if (ogen === 'x' || ogen === 'duizelig') return '';
    const bang = ogen === 'bang';
    const [y1, y2] = bang ? [-52, -48] : razend ? [-54, -32] : [-50, -36];
    return `<line x1="${sx * 56}" y1="${y1}" x2="${sx * 12}" y2="${y2}" stroke="${LIJN}" stroke-width="${razend ? 11 : 9}" stroke-linecap="round"/>`;
  };
  let m;
  if (mond === 'open') m = `<ellipse cx="0" cy="34" rx="20" ry="16" fill="#3b1206" stroke="${LIJN}" stroke-width="4"/><ellipse cx="0" cy="40" rx="10" ry="6" fill="#c8102e"/>`;
  else if (mond === 'lach') m = `<path d="M-32,22Q0,26 32,22Q28,56 0,56Q-28,56 -32,22Z" fill="#3b1206" stroke="${LIJN}" stroke-width="4"/><path d="M-26,25H26V31H-26Z" fill="#fff8e6"/><ellipse cx="0" cy="48" rx="12" ry="6" fill="#c8102e"/>`;
  else if (mond === 'tong') m = `<path d="M-24,30Q0,24 24,30" fill="none" stroke="${LIJN}" stroke-width="6" stroke-linecap="round"/><path d="M4,30q2,18 10,18q8,0 8,-16" fill="#e8506a" stroke="${LIJN}" stroke-width="3"/>`;
  else {
    m = `<rect x="-32" y="22" width="64" height="22" rx="8" fill="#3b1206" stroke="${LIJN}" stroke-width="4"/><rect x="-28" y="25" width="56" height="8" rx="3" fill="#fff8e6"/>` +
      [-1, 0, 1].map(i => `<line x1="${i * 13}" y1="25" x2="${i * 13}" y2="33" stroke="${LIJN}" stroke-width="2"/>`).join('');
  }
  return `<g transform="translate(${g.x} ${g.y}) scale(${g.s})">${wenk(-1)}${wenk(1)}${oog(-1)}${oog(1)}${m}</g>`;
}

// Wat er na een klap op het lijf achterblijft, in de coördinaten van het lijf.
function sporen(c, st) {
  let s = '';
  const [licht, , donker] = c.u.kleur;
  for (const g of st.gaten || []) s += `<ellipse cx="${f(g.x)}" cy="${f(g.y)}" rx="6" ry="5" fill="#2a0f04"/><ellipse cx="${f(g.x - 1)}" cy="${f(g.y - 1.5)}" rx="3" ry="2" fill="${c.u.binnen}"/>`;
  if (st.deuk) {
    const { x, y, t } = st.deuk;
    s += `<g opacity="${f(t)}"><ellipse cx="${f(x)}" cy="${f(y)}" rx="24" ry="17" fill="${donker}" fill-opacity="0.6"/><ellipse cx="${f(x - 3)}" cy="${f(y - 3)}" rx="14" ry="9" fill="${licht}" fill-opacity="0.25"/>` +
      `<path d="M${f(x - 22)},${f(y - 12)}l-12,-8M${f(x + 18)},${f(y - 14)}l10,-12M${f(x + 20)},${f(y + 10)}l14,6" stroke="${LIJN}" stroke-width="3" stroke-linecap="round"/></g>`;
  }
  if (st.zout) {
    const r = zaad('zout');
    const n = Math.round(26 * klem(st.zout));
    for (let i = 0; i < n; i++) {
      const x = (r() * 0.9 + 0.05) * c.v.bw, y = c.v.top * 0.85 + r() * (c.v.h - c.v.top * 0.85) * 0.8, a = r() * 90;
      s += `<rect x="${f(x - 3.5)}" y="${f(y - 3.5)}" width="7" height="7" fill="#fff" stroke="#9fc8e8" stroke-width="1.5" transform="rotate(${f(a)} ${f(x)} ${f(y)})"/>`;
    }
  }
  if (st.zwart) s += `<rect x="-200" y="-200" width="400" height="400" fill="#120600" fill-opacity="${f(st.zwart)}"/>`;
  if (st.zwart) s += [-0.5, 0.1, 0.55].map((p, i) => `<ellipse cx="${f(p * c.v.bw)}" cy="${f(c.v.top * 0.3 + i * 12)}" rx="14" ry="9" fill="#000" fill-opacity="${f(0.35 * st.zwart)}"/>`).join('');
  return s;
}

// Het lijf met alle lagen. Squash en kanteling draaien om de onderkant, zodat hij op de grond blijft.
function lijf(c, st) {
  const { u, v } = c;
  const r = zaad(c.key);
  const sx = st.sx ?? 1, sy = st.sy ?? 1, kant = st.rot || 0;
  const draaipunt = st.rotX || 0;
  const regel = v.regel ? ` fill-rule="${v.regel}"` : '';
  const beleg = (laag) => (u.beleg || []).filter(b => BELEG[b]?.laag === laag).map(b => BELEG[b].teken(v, zaad(c.key + b))).join('');
  const korrels = u.korrel ? Array.from({ length: 90 }, () => {
    const x = (r() * 2 - 1) * v.bw, y = v.top + r() * (v.h - v.top);
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.5 + r() * 2.6)}" fill="${r() < 0.45 ? u.kleur[0] : u.kleur[2]}" fill-opacity="0.8"/>`;
  }).join('') : '';
  const basis = v.stukken
    ? v.stukken.map(([x, y, a, b]) => v.rol
      ? `<path d="${rond(x - a / 2, y - b / 2, a, b, b / 2)}" fill="url(#lijf)" stroke="${LIJN}" stroke-width="5"/><path d="M${x - a / 2 + 18},${y - 6}h${a - 36}" stroke="#000" stroke-opacity="0.15" stroke-width="4"/>`
      : `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" fill="url(#lijf)" stroke="${LIJN}" stroke-width="5"/>`).join('')
    : `<path d="${v.pad}" fill="url(#lijf)"${regel}/>`;
  const glans = `<ellipse cx="${f(-v.bw * 0.4)}" cy="${f(v.top * 0.55)}" rx="${f(Math.min(30, v.bw * 0.3))}" ry="12" fill="#fff" fill-opacity="0.25" transform="rotate(-25 ${f(-v.bw * 0.4)} ${f(v.top * 0.55)})"/>`;
  const flits = (st.rood ? `<rect x="-220" y="-220" width="440" height="440" fill="#ff2a2a" fill-opacity="${f(st.rood)}"/>` : '') +
    (st.wit ? `<rect x="-220" y="-220" width="440" height="440" fill="#fff" fill-opacity="${f(st.wit)}"/>` : '');
  const stoom = st.razend ? [-0.35, 0.35].map((p, i) => {
    const fase = ((st.tik || 0) * 0.18 + i * 0.5) % 1;
    return `<circle cx="${f(p * v.bw + (i ? 6 : -6) * fase)}" cy="${f(v.top - 8 - fase * 34)}" r="${f(8 + fase * 10)}" fill="#fff" fill-opacity="${f(0.55 * (1 - fase))}"/>`;
  }).join('') : '';
  const folie = st.folie ? `<g clip-path="url(#folieveeg)"><path d="${v.pad}"${regel} fill="#e8f6ff" fill-opacity="0.38" stroke="#ffffff" stroke-opacity="0.85" stroke-width="7" transform="scale(1.07)"/>` +
    `<g clip-path="url(#klip)">${Array.from({ length: 7 }, (_, i) => `<path d="M${-v.bw - 40 + i * v.bw * 0.4},${v.top - 10}l${f(v.bw * 0.5)},${f(v.h - v.top + 20)}" stroke="#fff" stroke-opacity="0.5" stroke-width="3"/>`).join('')}</g></g>` : '';
  const binnenGroep = `${basis}<g clip-path="url(#klip)">${korrels}${vormDetail(u, v, zaad(c.key + 'vorm'))}${beleg('op')}${glans}${sporen(c, st)}</g>` +
    (v.stukken ? '' : `<path d="${v.pad}"${regel} fill="none" stroke="${LIJN}" stroke-width="5"/>`) +
    beleg('boven') + gezicht(v.gezicht, { ...st, razend: st.razend && st.ogen !== 'x' }) + beleg('gezicht') +
    `<g clip-path="url(#klip)">${flits}</g>` + folie;
  const lichaam = `${beleg('achter')}${binnenGroep}`;
  const vervorm = `translate(${f(draaipunt)} ${v.h}) rotate(${f(kant)}) scale(${f(sx * 1000) / 1000} ${f(sy * 1000) / 1000}) translate(${f(-draaipunt)} ${-v.h})`;
  const binnen = () => `<g transform="${vervorm}"><path d="${v.pad}"${regel} fill="${u.binnen}" transform="scale(0.93)"/>` +
    stippen(zaad(c.key + 'binnen'), v, 18, '#000', { min: 1.5, max: 3, rand: ' fill-opacity="0.12"' }) +
    (u.ei ? `<g transform="rotate(${f(c.snijHoek)})"><ellipse cx="0" cy="0" rx="58" ry="40" fill="#fffdf6" stroke="#e8dcc2" stroke-width="3"/></g><circle cx="0" cy="0" r="25" fill="url(#dooier)"/>` : '') + '</g>';
  let inhoud;
  if (st.snee) {
    const g = st.snee / 2, n = c.snijNormaal;
    inhoud = binnen() +
      `<g transform="translate(${f(n.x * g)} ${f(n.y * g)}) rotate(${f(-st.snee * 0.35)} 0 ${v.h})"><g clip-path="url(#helftA)"><g transform="${vervorm}">${lichaam}</g></g></g>` +
      `<g transform="translate(${f(-n.x * g * 0.5)} ${f(-n.y * g * 0.5)}) rotate(${f(st.snee * 0.15)} 0 ${v.h})"><g clip-path="url(#helftB)"><g transform="${vervorm}">${lichaam}</g></g></g>`;
  } else inhoud = `<g transform="${vervorm}">${lichaam}${stoom}</g>`;
  return `<g transform="translate(${f(c.cx + (st.dx || 0))} ${f(c.cy + (st.dy || 0))})">${inhoud}</g>`;
}

function schaduw(c, st) {
  const sx = (st.sx ?? 1) * (st.schaduw ?? 1);
  return `<ellipse cx="${f(c.cx + (st.dx || 0))}" cy="${GROND - 3}" rx="${f(c.v.bw * 0.95 * sx)}" ry="13" fill="#000" fill-opacity="0.45"/>`;
}

// ── Decor, balk, teksten ─────────────────────────────────────────────────────

function defs(c) {
  const [licht, basis, donker] = c.u.kleur;
  const half = (teken) => {
    const { x: dx, y: dy } = c.snijRichting, n = c.snijNormaal, L = 1000;
    const a = [dx * L, dy * L], b = [-dx * L, -dy * L], m = [n.x * L * teken, n.y * L * teken];
    return `${f(a[0])},${f(a[1])} ${f(a[0] + m[0])},${f(a[1] + m[1])} ${f(b[0] + m[0])},${f(b[1] + m[1])} ${f(b[0])},${f(b[1])}`;
  };
  return `<defs>
<linearGradient id="lucht" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d1b0d"/><stop offset="1" stop-color="#160905"/></linearGradient>
<radialGradient id="spot" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb347" stop-opacity="0.3"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
<radialGradient id="vignet" cx="50%" cy="48%" r="72%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>
<radialGradient id="lijf" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="${licht}"/><stop offset="0.5" stop-color="${basis}"/><stop offset="1" stop-color="${donker}"/></radialGradient>
<radialGradient id="dooier" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#f0a500"/></radialGradient>
<linearGradient id="staal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset="0.55" stop-color="#b9c3cd"/><stop offset="1" stop-color="#7d8894"/></linearGradient>
<linearGradient id="hout" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4a26"/><stop offset="1" stop-color="#3f230f"/></linearGradient>
<linearGradient id="ijzer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a7078"/><stop offset="0.45" stop-color="#2e3238"/><stop offset="1" stop-color="#121417"/></linearGradient>
<radialGradient id="bolG" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#5a5e66"/><stop offset="1" stop-color="#0c0d10"/></radialGradient>
<radialGradient id="knuppel" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#f6c46c"/><stop offset="0.5" stop-color="#d98c35"/><stop offset="1" stop-color="#8f4a14"/></radialGradient>
<radialGradient id="vuur" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.35" stop-color="#ffd23f"/><stop offset="0.7" stop-color="#ff7a1a"/><stop offset="1" stop-color="#d12a0a" stop-opacity="0"/></radialGradient>
<linearGradient id="hp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7a3d"/><stop offset="1" stop-color="#d1122f"/></linearGradient>
<clipPath id="klip"><path d="${c.v.pad}"${c.v.regel ? ` clip-rule="${c.v.regel}"` : ''}/></clipPath>
<clipPath id="helftA"><polygon points="${half(1)}"/></clipPath><clipPath id="helftB"><polygon points="${half(-1)}"/></clipPath>
</defs>`;
}

function decor() {
  let tegels = '';
  for (let x = 0; x <= W; x += 40) tegels += `<line x1="${x}" y1="74" x2="${x}" y2="${GROND - 12}" stroke="#fff" stroke-opacity="0.045" stroke-width="2"/>`;
  for (let y = 74; y < GROND - 12; y += 40) tegels += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#fff" stroke-opacity="0.045" stroke-width="2"/>`;
  return `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="url(#lucht)"/>${tegels}
<ellipse cx="${W / 2}" cy="${GROND - 120}" rx="220" ry="180" fill="url(#spot)"/>
<rect x="-40" y="${GROND - 12}" width="${W + 80}" height="${H - GROND + 52}" fill="#1c0c06"/><rect x="-40" y="${GROND - 12}" width="${W + 80}" height="4" fill="#6b3512"/>`;
}

function hpBalk(c, hp, spook) {
  const x = 24, y = 52, b = W - 48, h = 18, max = c.max;
  const naam = String(c.naam || 'De Weekvijand').toUpperCase();
  const maat = Math.max(13, Math.min(22, Math.floor(300 / (naam.length * 0.7))));
  const breed = (n) => f((b - 4) * klem(n / max));
  return tekst(x, 38, naam, { maat, kleur: GOUD, anker: 'start', extra: 'letter-spacing="1.5"' }) +
    tekst(W - 24, 38, `${Math.round(Math.max(0, hp))}/${max} HP`, { maat: 18, anker: 'end' }) +
    `<rect x="${x}" y="${y}" width="${b}" height="${h}" rx="9" fill="#2a0f08" stroke="#6b3512" stroke-width="2"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="${breed(spook)}" height="${h - 4}" rx="7" fill="#ffd36b"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="${breed(hp)}" height="${h - 4}" rx="7" fill="url(#hp)"/>` +
    `<rect x="${x + 6}" y="${y + 4}" width="${f(Math.max(0, (b - 12) * klem(hp / max)))}" height="4" rx="2" fill="#fff" fill-opacity="0.35"/>`;
}

function banier(t, regel) {
  if (t == null || t < 0 || !regel) return '';
  const y = 354 + 60 * (1 - uit(t));
  const maat = Math.max(11, Math.min(17, Math.floor((W - 90) / (regel.length * 0.68))));
  return `<g transform="translate(0 ${f(y)})"><rect x="28" y="0" width="${W - 56}" height="34" rx="17" fill="#1b0c07" stroke="${GOUD}" stroke-width="2.5"/>` +
    tekst(W / 2, 23, regel, { maat, kleur: GOUD, extra: 'letter-spacing="1.2"' }) + '</g>';
}

// Groot getal of kreet dat uit de klap springt.
function knal(c, t, inhoud, { kleur = '#ff3b30', maat = 66, x = null, y = null } = {}) {
  if (t == null || t < 0) return '';
  // Nooit onder de HP-balk (die eindigt op y = 70): de bovenkant van de letters blijft eronder.
  const px = x ?? Math.min(W - maat * 0.95, c.cx + c.v.bw * 0.55 + 48), py = Math.max(76 + maat * 0.72, (y ?? c.cy + c.v.top - 6) - 20 * uit(t));
  const s = Math.min(1.12, 0.2 + 0.9 * terug(t * 2.2));
  return `<g transform="translate(${f(px)} ${f(py)}) scale(${f(s * 100) / 100})">${tekst(0, 0, inhoud, { maat, kleur, rand: '#2b0a05', randB: 10 })}</g>`;
}

function inslag(x, y, t, schaal = 1) {
  if (t == null || t < 0 || t > 1) return '';
  const r = (30 + 85 * uit(t)) * schaal;
  return `<g opacity="${f(1 - t)}">${ster(x, y, r, '#fff6c8', 8, 0.35)}${ster(x, y, r * 0.55, '#fff', 8, 0.3)}</g>`;
}

function ontploffing(x, y, t, schaal = 1) {
  if (t == null || t < 0 || t > 1.4) return '';
  const r = (40 + 150 * uit(t)) * schaal, o = klem(1.3 - t);
  const rook = [[-1, -0.6], [1, -0.7], [-0.5, -1.2], [0.6, -1.1], [0, -1.5]].map(([dx, dy], i) =>
    `<circle cx="${f(x + dx * r * 0.6)}" cy="${f(y + dy * r * 0.5 - t * 30)}" r="${f(r * (0.28 + i * 0.03))}" fill="#3a3330" fill-opacity="${f(0.55 * klem(t * 1.5) * klem(1.6 - t))}"/>`).join('');
  return `<g>${rook}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#vuur)" opacity="${f(o)}"/>${ster(x, y, r * 0.9, '#ffb020', 10, 0.45, `opacity="${f(o)}"`)}${ster(x, y, r * 0.5, '#fff3b0', 10, 0.4, `opacity="${f(o)}"`)}</g>`;
}

// Kruimels die uit de klap vliegen en op de grond blijven liggen.
function maakKruimels(c, x, y, n, { richting = 0, extra = [] } = {}) {
  const r = zaad(`${c.key}kruimel${n}${f(x)}`);
  const kleuren = [...c.u.kleur, ...extra];
  return Array.from({ length: n }, () => ({
    x, y, vx: (r() * 2 - 1) * 6 + richting * (2 + r() * 4), vy: -3 - r() * 8, g: 3 + r() * 5,
    kleur: kleuren[Math.floor(r() * kleuren.length)], draai: r() * 360, spin: (r() - 0.5) * 40,
  }));
}
function kruimels(deeltjes, stap) {
  if (stap == null || stap < 0) return '';
  return deeltjes.map(k => {
    // Eenmaal op de grond blijft hij liggen.
    const land = (-k.vy + Math.sqrt(k.vy * k.vy + 2.4 * Math.max(0, GROND - 4 - k.y))) / 1.2;
    const t = Math.min(stap, land);
    const x = k.x + k.vx * t;
    const y = Math.min(GROND - 4 + (k.g % 3), k.y + k.vy * t + 0.6 * t * t);
    const g = k.g;
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(k.draai + k.spin * t)})"><polygon points="${f(-g)},${f(-g * 0.6)} ${f(g * 0.4)},${f(-g)} ${f(g)},${f(g * 0.3)} ${f(-g * 0.2)},${f(g)}" fill="${k.kleur}" stroke="#3b1206" stroke-width="1.5"/></g>`;
  }).join('');
}

// Eén beeld van de film.
function beeld(c, s) {
  const st = { tik: s.tik, ...s.st };
  const schud = s.schud || { x: 0, y: 0 };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${c.defs}` +
    (s.folieVeeg != null ? `<defs><clipPath id="folieveeg"><rect x="-300" y="-300" width="${f(600 * klem(s.folieVeeg))}" height="600"/></clipPath></defs>` : '<defs><clipPath id="folieveeg"><rect x="-300" y="-300" width="600" height="600"/></clipPath></defs>') +
    `<g transform="translate(${f(schud.x)} ${f(schud.y)})">${decor()}${schaduw(c, st)}${s.achter || ''}${s.verborgen ? '' : lijf(c, st)}${s.kruimels || ''}${s.voor || ''}${s.fx || ''}</g>` +
    `${s.boven || ''}<rect width="${W}" height="${H}" fill="url(#vignet)"/>${hpBalk(c, s.hp, s.spook ?? s.hp)}${banier(s.banierT, s.banier)}` +
    (s.scherm ? `<rect width="${W}" height="${H}" fill="${s.scherm.kleur}" fill-opacity="${f(s.scherm.o)}"/>` : '') + '</svg>';
}

// ── Wapens ───────────────────────────────────────────────────────────────────
// Elke tekening heeft zijn aangrijppunt op (0,0): de punt van het mes en de vork, de voorkant van
// de want, de spuitmond, het midden van de bom, de voet van de knuppel.

const SPRITE = {
  knuppel: (vlam, tik) => `<rect x="-8" y="-80" width="16" height="86" rx="6" fill="url(#hout)" stroke="#2a160a" stroke-width="3"/>` +
    `<rect x="-28" y="-206" width="56" height="134" rx="28" fill="url(#knuppel)" stroke="#5a2a0b" stroke-width="4"/>` +
    [[-10, -180], [8, -160], [-6, -130], [12, -110], [-12, -96], [4, -190]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#8f4a14"/>`).join('') +
    (vlam ? `<g transform="translate(0 -200) scale(1 ${f(1 + 0.12 * Math.sin(tik * 2.1))})"><path d="M-30,0Q-44,-40 -14,-70Q-16,-44 0,-36Q4,-66 28,-84Q22,-44 34,0Z" fill="#ff7a1a"/><path d="M-16,0Q-22,-26 -4,-46Q-2,-28 8,-22Q12,-40 22,-50Q20,-24 20,0Z" fill="#ffd23f"/></g>` : ''),
  vork: () => `<rect x="0" y="-8" width="118" height="16" rx="8" fill="#d62828" stroke="#6a0a0a" stroke-width="3"/>` +
    `<path d="M2,-8L-24,-22V22L2,8Z" fill="#d62828" stroke="#6a0a0a" stroke-width="3" stroke-linejoin="round"/>` +
    [-17, 0, 17].map(y => `<rect x="-80" y="${y - 4}" width="62" height="8" rx="4" fill="#d62828" stroke="#6a0a0a" stroke-width="2.5"/>`).join('') +
    `<path d="M14,-3H108" stroke="#fff" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round"/>`,
  mes: (glim) => `<path d="M0,0Q-8,-16 -34,-20L-176,-20L-176,12Q-60,12 0,0Z" fill="url(#staal)" stroke="#3b4652" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M-12,-6Q-60,4 -170,6" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="2.5"/>` +
    `<rect x="-188" y="-23" width="14" height="38" rx="4" fill="#9aa4ae" stroke="#3b4652" stroke-width="3"/>` +
    `<rect x="-268" y="-17" width="84" height="27" rx="11" fill="url(#hout)" stroke="#2a160a" stroke-width="3"/>` +
    `<circle cx="-246" cy="-3.5" r="4" fill="#d9dde2"/><circle cx="-212" cy="-3.5" r="4" fill="#d9dde2"/>` +
    (glim ? ster(-40, -14, 16 * glim, '#fff') : ''),
  mepper: () => `<line x1="40" y1="-44" x2="190" y2="-220" stroke="#1f7a38" stroke-width="13" stroke-linecap="round"/><line x1="40" y1="-44" x2="190" y2="-220" stroke="#45d16a" stroke-width="7" stroke-linecap="round"/>` +
    `<rect x="-72" y="-56" width="144" height="112" rx="14" fill="#45d16a" fill-opacity="0.92" stroke="#1f7a38" stroke-width="5"/>` +
    [-48, -24, 0, 24, 48].map(x => `<path d="M${x},-52V52" stroke="#1f7a38" stroke-opacity="0.55" stroke-width="2.5"/>`).join('') +
    [-32, -10, 12, 34].map(y => `<path d="M-68,${y}H68" stroke="#1f7a38" stroke-opacity="0.55" stroke-width="2.5"/>`).join(''),
  want: () => `<rect x="40" y="-50" width="50" height="100" rx="12" fill="#f4efe6" stroke="${LIJN}" stroke-width="4"/>` +
    [-30, -10, 10, 30].map(y => `<path d="M42,${y}H88" stroke="#c9bfae" stroke-width="3"/>`).join('') +
    `<path d="M0,-52Q-10,-92 -42,-86Q-66,-78 -50,-50Z" fill="#c8102e" stroke="${LIJN}" stroke-width="4"/>` +
    `<path d="M44,-52L-34,-52Q-72,-52 -72,-4Q-72,52 -22,52L44,52Z" fill="#c8102e" stroke="${LIJN}" stroke-width="4"/>` +
    [-40, -10, 20].map(x => `<path d="M${x},-48l30,96M${x + 30},-48l-30,96" stroke="#fff" stroke-opacity="0.35" stroke-width="2.5"/>`).join(''),
  folie: () => `<rect x="-70" y="-22" width="140" height="44" rx="6" fill="#e9d3a5" stroke="#7a5a2a" stroke-width="3"/>` +
    `<rect x="-70" y="-6" width="140" height="12" fill="#3a7bd5"/><circle cx="-70" cy="0" r="20" fill="#dfe9f2" stroke="#7f9aaa" stroke-width="3"/><circle cx="-70" cy="0" r="7" fill="#9fb3c8"/>`,
  spuit: () => `<rect x="8" y="26" width="78" height="130" rx="18" fill="#e8f4ff" stroke="#3a5a7a" stroke-width="4"/>` +
    `<rect x="13" y="72" width="68" height="80" rx="14" fill="#9fd0ff" fill-opacity="0.75"/>` +
    `<rect x="18" y="92" width="58" height="28" rx="4" fill="#fff" stroke="#3a5a7a" stroke-width="2"/>` +
    tekst(47, 112, 'PEKEL', { maat: 13, kleur: '#2a5a9a' }) +
    `<rect x="30" y="8" width="34" height="20" fill="#3a5a7a"/>` +
    `<path d="M0,-12L74,-12L74,12L0,8Z" fill="#e04040" stroke="${LIJN}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M24,8Q20,36 34,48L40,44Q32,30 36,10Z" fill="#e04040" stroke="${LIJN}" stroke-width="3"/>`,
  bom: (tik) => `<circle cx="0" cy="0" r="34" fill="url(#bolG)" stroke="#000" stroke-width="3"/>` +
    `<ellipse cx="-12" cy="-13" rx="10" ry="6" fill="#fff" fill-opacity="0.35"/>` +
    `<path d="M0,-10C6,-2 10,4 10,8A10,10 0 0 1 -10,8C-10,4 -6,-2 0,-10Z" fill="${GOUD}"/>` +
    `<rect x="14" y="-40" width="16" height="12" rx="3" fill="#555" transform="rotate(35 22 -34)"/>` +
    `<path d="M26,-38Q40,-58 30,-68" stroke="#c9a26a" stroke-width="4" fill="none"/>` +
    ster(30, -68, 9 + 4 * Math.abs(Math.sin(tik * 1.7)), '#ffd23f', 6, 0.4) + ster(30, -68, 5, '#fff', 6, 0.4),
  kanon: () => `<path d="M-20,20L96,20L76,74L4,74Z" fill="url(#hout)" stroke="#2a160a" stroke-width="4"/>` +
    `<rect x="-14" y="-30" width="176" height="60" rx="14" fill="url(#ijzer)" stroke="#0c0d10" stroke-width="4"/>` +
    `<rect x="22" y="-32" width="14" height="64" rx="4" fill="#1a1c20"/><rect x="118" y="-32" width="14" height="64" rx="4" fill="#1a1c20"/>` +
    `<rect x="156" y="-38" width="22" height="76" rx="8" fill="#2e3238" stroke="#0c0d10" stroke-width="4"/>` +
    tekst(78, 7, 'FRITUUR', { maat: 13, kleur: GOUD }) +
    `<circle cx="40" cy="74" r="32" fill="#5a3a1a" stroke="#2a160a" stroke-width="5"/>` +
    [0, 45, 90, 135].map(a => `<line x1="${f(40 + Math.cos(a * Math.PI / 180) * 30)}" y1="${f(74 + Math.sin(a * Math.PI / 180) * 30)}" x2="${f(40 - Math.cos(a * Math.PI / 180) * 30)}" y2="${f(74 - Math.sin(a * Math.PI / 180) * 30)}" stroke="#2a160a" stroke-width="5"/>`).join('') +
    `<circle cx="40" cy="74" r="8" fill="#2a160a"/><path d="M-14,-8Q-34,-28 -26,-46" stroke="#c9a26a" stroke-width="4" fill="none"/>`,
  kogel: () => `<circle cx="0" cy="0" r="24" fill="url(#bolG)" stroke="#000" stroke-width="3"/><ellipse cx="-8" cy="-9" rx="7" ry="4" fill="#fff" fill-opacity="0.4"/>`,
};

// Een slaglijn achter een snelle beweging.
const zwiep = (a, b, dik = 30) =>
  `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="#fff" stroke-opacity="0.22" stroke-width="${dik}" stroke-linecap="round"/>` +
  `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="#e8f4ff" stroke-opacity="0.6" stroke-width="7" stroke-linecap="round"/>`;
const boog = (cx, cy, r, van, tot, dik = 26) => {
  const p = (a) => ({ x: cx + Math.sin(a * Math.PI / 180) * r, y: cy - Math.cos(a * Math.PI / 180) * r });
  const a = p(van), b = p(tot), groot = Math.abs(tot - van) > 180 ? 1 : 0, zin = tot > van ? 1 : 0;
  const d = `M${f(a.x)},${f(a.y)}A${r},${r} 0 ${groot} ${zin} ${f(b.x)},${f(b.y)}`;
  return `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="${dik}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#e8f4ff" stroke-opacity="0.6" stroke-width="7" stroke-linecap="round"/>`;
};

// Per wapen: het effect op het lijf, het raakpunt (in lijf-coördinaten) en de pose per fase.
// Een pose geeft { voor, achter, fx, st, folieVeeg } terug. `slag` is het laatste moment vóór de klap.
// c.raak is het raakpunt in schermcoördinaten.
const WAPENBEELD = {
  geen: {
    effect: 'deuk', slagBeelden: 3,
    raak: (v) => ({ x: v.bw * 0.55, y: v.top * 0.62 }),
    pose(fase, t, c, o) {
      const P0 = { x: Math.min(W - 26, c.cx + c.v.bw + 60), y: GROND - 10 };
      const hoekRaak = Math.atan2(c.raak.x - P0.x, P0.y - c.raak.y) * 180 / Math.PI;
      const knup = (x, y, hoek) => plaats(SPRITE.knuppel(o.offer, c.tik), x, y, hoek);
      if (fase === 'intro') return { voor: knup(P0.x + 220 * (1 - uit(t)), P0.y, hoekRaak + 70) };
      if (fase === 'aanloop') return { voor: knup(P0.x, P0.y, hoekRaak + 70 + 25 * uit(t)) };
      if (fase === 'slag') { const h = lerp(hoekRaak + 95, hoekRaak, in3(t)); return { voor: knup(P0.x, P0.y, h), fx: t > 0 ? boog(P0.x, P0.y, 150, hoekRaak + 95, h) : '' }; }
      return { voor: t < 0.6 ? knup(P0.x + 260 * uit(t / 0.6), P0.y + 40 * t, hoekRaak + 40 * t) : '' };
    },
  },
  frietvork: {
    effect: 'gaten', slagBeelden: 3,
    raak: (v) => ({ x: v.bw - 14, y: -8 }),
    pose(fase, t, c) {
      const doel = { x: c.raak.x - 4, y: c.raak.y };
      const vork = (x, y, h = 0) => plaats(SPRITE.vork(), x, y, h, 0.9);
      if (fase === 'intro') return { voor: vork(doel.x + 140 + 240 * (1 - uit(t)), doel.y - 30 * (1 - t), -12 * (1 - t)) };
      if (fase === 'aanloop') return { voor: vork(doel.x + 140 + 40 * uit(t), doel.y) };
      if (fase === 'slag') return { voor: vork(lerp(doel.x + 180, doel.x, in3(t)), doel.y), fx: t > 0.3 ? zwiep({ x: doel.x + 200, y: doel.y }, { x: lerp(doel.x + 180, doel.x, in3(t)) + 80, y: doel.y }, 20) : '' };
      if (t < 0.35) return { voor: vork(doel.x, doel.y, Math.sin(t * 40) * 5) };
      return { voor: t < 1 ? vork(doel.x + 300 * in3((t - 0.35) / 0.65), doel.y - 20 * t) : '' };
    },
  },
  kroketmes: {
    effect: 'snee', slagBeelden: 3,
    raak: () => ({ x: 0, y: 0 }),
    pose(fase, t, c) {
      const d = c.snijRichting, hoek = Math.atan2(d.y, d.x) * 180 / Math.PI;
      const op = (s) => ({ x: c.cx + d.x * s, y: c.cy + d.y * s });
      const zweef = op(-c.v.bw - 40);
      const mes = (p, h, glim = 0) => plaats(SPRITE.mes(glim), p.x, p.y, h, 0.82);
      if (fase === 'intro') { const s = { x: zweef.x + 260, y: zweef.y - 200 }; return { voor: mes({ x: lerp(s.x, zweef.x, uit(t)), y: lerp(s.y, zweef.y, uit(t)) }, hoek - 40 + 40 * uit(t)) }; }
      if (fase === 'aanloop') return { voor: mes({ x: zweef.x - d.x * 20 * uit(t), y: zweef.y - d.y * 20 * uit(t) }, hoek - 22 * uit(t), Math.sin(t * Math.PI)) };
      if (fase === 'slag') { const s = lerp(-c.v.bw * 0.6, c.v.bw * 1.7, t); return { voor: mes(op(s), hoek), fx: zwiep(op(-c.v.bw - 120), op(s)) }; }
      return { voor: t < 0.3 ? mes(op(c.v.bw * 2.4 + 300 * t), hoek) : '' };
    },
  },
  vliegenmepper: {
    effect: 'plat', slagBeelden: 3,
    raak: (v) => ({ x: 0, y: v.top }),
    pose(fase, t, c) {
      const top = (sy) => c.cy + c.v.h - (c.v.h - c.v.top) * sy;
      const mep = (x, y, h) => plaats(SPRITE.mepper(), x, y, h);
      const hoog = top(1) - 150;
      if (fase === 'intro') return { voor: mep(c.cx + 30, hoog - 260 * (1 - uit(t)), -15) };
      if (fase === 'aanloop') return { voor: mep(c.cx + 30, hoog - 40 * uit(t), -15 - 12 * uit(t)) };
      if (fase === 'slag') { const y = lerp(hoog - 40, top(0.55) - 52, in3(t)); return { voor: mep(c.cx + 10, y, lerp(-27, 0, in3(t))), fx: zwiep({ x: c.cx - 60, y: hoog - 60 }, { x: c.cx - 60, y: y - 40 }, 18) + zwiep({ x: c.cx + 60, y: hoog - 60 }, { x: c.cx + 60, y: y - 40 }, 18) }; }
      if (t < 0.25) return { voor: mep(c.cx + 10, top(0.55) - 52, 0) };
      return { voor: t < 1 ? mep(c.cx + 10 + 60 * t, top(0.55) - 52 - 380 * in3((t - 0.25) / 0.75), -20 * t) : '' };
    },
  },
  ovenwant: {
    effect: 'deuk', slagBeelden: 3, geenTerugslag: true,
    raak: (v) => ({ x: v.bw - 10, y: 0 }),
    pose(fase, t, c) {
      const doel = { x: c.raak.x + 52, y: c.raak.y };
      const want = (x, y, s = 1) => plaats(SPRITE.want(), x, y, 0, s * 0.85);
      if (fase === 'intro') return { voor: want(doel.x + 150 + 200 * (1 - uit(t)), doel.y + 20 * (1 - t)) };
      if (fase === 'aanloop') return { voor: want(doel.x + 150 + 50 * uit(t), doel.y, 1 + 0.12 * uit(t)) };
      if (fase === 'slag') { const x = lerp(doel.x + 200, doel.x, in3(t)); return { voor: want(x, doel.y, 1.12 - 0.12 * t), fx: t > 0 ? zwiep({ x: x + 120, y: doel.y }, { x: x + 40, y: doel.y }, 50) : '' }; }
      return { voor: t < 1 ? want(doel.x + 30 + 280 * in3(t), doel.y) : '' };
    },
  },
  vershoudfolie: {
    effect: 'folie', slagBeelden: 10,
    raak: () => ({ x: 0, y: 0 }),
    pose(fase, t, c) {
      const rx = c.v.bw + 70, ry = (c.v.h - c.v.top) / 2 + 30, my = c.cy + (c.v.h + c.v.top) / 2;
      const rol = (x, y, h) => plaats(SPRITE.folie(), x, y, h, 0.85);
      if (fase === 'intro') return { voor: rol(c.cx + rx + 180 * (1 - uit(t)), my - 80 * (1 - t), 20 * (1 - t)) };
      if (fase === 'aanloop') return { voor: rol(c.cx + rx, my, Math.sin(t * 12) * 8) };
      if (fase === 'slag') {
        const a = t * Math.PI * 2, x = c.cx + Math.cos(a) * rx, y = my - Math.sin(a) * ry;
        const band = `<path d="M${f(x)},${f(y)}L${f(c.cx + c.v.bw * 0.4)},${f(my)}" stroke="#eaf6ff" stroke-opacity="0.45" stroke-width="34" stroke-linecap="round"/>`;
        const sprite = rol(x, y, -a * 180 / Math.PI);
        return Math.sin(a) > 0 ? { achter: band + sprite, folieVeeg: t, st: { folie: true } } : { voor: band + sprite, folieVeeg: t, st: { folie: true } };
      }
      return { voor: t < 1 ? rol(c.cx + rx + 260 * in3(t), my - 120 * t, 30 * t) : '', folieVeeg: 1 };
    },
  },
  pekelspuit: {
    effect: 'zout', slagBeelden: 7,
    raak: (v) => ({ x: v.bw * 0.45, y: v.top * 0.3 }),
    pose(fase, t, c) {
      const mond = { x: Math.min(W - 70, c.cx + c.v.bw + 70), y: c.cy + c.v.top * 0.45 };
      const fles = (x, y, h = 0) => plaats(SPRITE.spuit(), x, y, h, 0.8);
      if (fase === 'intro') return { voor: fles(mond.x + 200 * (1 - uit(t)), mond.y - 40 * (1 - t)) };
      if (fase === 'aanloop') return { voor: fles(mond.x + Math.sin(t * 30) * 3, mond.y, -4 * t) };
      if (fase === 'slag') {
        const r = zaad(`pekel${Math.round(t * 20)}`);
        let wolk = '';
        for (let i = 0; i < 18; i++) {
          const s = r(), x = lerp(mond.x - 6, c.raak.x, s), y = mond.y + (c.raak.y - mond.y) * s + (r() - 0.5) * 70 * s;
          wolk += `<rect x="${f(x - 3)}" y="${f(y - 3)}" width="6" height="6" fill="#fff" stroke="#9fc8e8" stroke-width="1.2" transform="rotate(${f(r() * 90)} ${f(x)} ${f(y)})"/>`;
        }
        wolk = `<path d="M${f(mond.x)},${f(mond.y - 4)}L${f(c.raak.x)},${f(c.raak.y - 40)}L${f(c.raak.x)},${f(c.raak.y + 40)}L${f(mond.x)},${f(mond.y + 4)}Z" fill="#fff" fill-opacity="0.18"/>` + wolk;
        return { voor: fles(mond.x, mond.y, -4 + Math.sin(t * 25) * 2), fx: wolk, st: { ogen: 'dicht', mond: 'open', zout: t } };
      }
      return { voor: t < 1 ? fles(mond.x + 240 * in3(t), mond.y + 60 * t, 20 * t) : '' };
    },
  },
  vetbom: {
    effect: 'ontploffing', slagBeelden: 9,
    raak: (v) => ({ x: v.bw * 0.55 + 34, y: v.h - 34 }),
    pose(fase, t, c, o) {
      const land = { x: c.raak.x, y: GROND - 34 };
      const start = { x: W + 60, y: 40 };
      const bom = (x, y, h = 0, s = 1) => plaats(SPRITE.bom(c.tik), x, y, h, s);
      if (fase === 'intro') return { voor: '', st: { kijk: { x: 0.8, y: -0.6 } } };
      if (fase === 'aanloop') { const x = lerp(start.x, start.x - 40, t); return { voor: bom(x, start.y + 20 * t, -20 * t) }; }
      if (fase === 'slag') {
        if (o.ketst) {
          const doel = { x: c.cx + 10, y: c.cy + c.v.top + 10 };
          if (t <= 0.45) { const s = t / 0.45; return { voor: bom(lerp(start.x - 40, doel.x, s), lerp(start.y + 20, doel.y, s) - Math.sin(s * Math.PI) * 120, -300 * s), st: { ogen: 'bang', kijk: { x: 0.6, y: -0.8 } } }; }
          const s = (t - 0.45) / 0.55;
          return { voor: bom(lerp(doel.x, W / 2, s), lerp(doel.y, H / 2 + 30, s) - Math.sin(s * Math.PI) * 60, 200 * s, 1 + 3.2 * in3(s)), st: { mond: 'lach', ogen: 'boos', kijk: { x: 0, y: 0.3 } } };
        }
        if (t <= 0.55) { const s = t / 0.55; return { voor: bom(lerp(start.x - 40, land.x, s), lerp(start.y + 20, land.y, s) - Math.sin(s * Math.PI) * 140, -360 * s), st: { ogen: 'bang', kijk: { x: 0.7, y: -0.5 } } }; }
        const s = (t - 0.55) / 0.45, hop = Math.abs(Math.sin(s * Math.PI * 1.5)) * 20 * (1 - s);
        return { voor: bom(land.x, land.y - hop, 10 * Math.sin(s * 9)), st: { ogen: 'bang', kijk: { x: 0.5, y: 0.9 }, mond: 'open' } };
      }
      return { voor: '' };
    },
  },
};

function banierTekst(o, wk) {
  const g = o.gave;
  if (o.ketst) return 'VETBOM · KETST TERUG';
  if (o.gemist) return g?.naam ? `MIS · ${g.naam.toUpperCase()}` : 'MIS';
  const basis = {
    geen: o.offer ? 'OFFER-AANVAL' : 'AANVAL',
    frietvork: 'FRIETVORK',
    kroketmes: g?.soort === 'pantser' ? 'KROKETMES · DOOR HET PANTSER' : 'KROKETMES',
    vliegenmepper: g?.soort === 'ontwijk' ? 'VLIEGENMEPPER · MIST NOOIT' : 'VLIEGENMEPPER',
    ovenwant: 'OVENWANT · GEEN TERUGSLAG',
    vershoudfolie: 'VERSHOUDFOLIE · HERSTELT NIET',
    pekelspuit: 'PEKELSPUIT · ZOUT VOOR DE VOLGENDE TWEE',
    vetbom: 'VETBOM',
  }[wk];
  return o.pekelBonus ? `${basis} · GEPEKELD +1` : basis;
}

// ── De film ──────────────────────────────────────────────────────────────────

function context(key, naam, max, cx = W / 2) {
  const u = uiterlijkVan(key);
  const v = { ...vormVan(u), naam: VORMEN[u.vorm] ? u.vorm : 'bal' };
  const l = Math.hypot(-200, 190);
  const snijRichting = { x: -200 / l, y: 190 / l };
  const c = {
    key: String(key || 'onbekend'), naam, max: Math.max(1, max || 1), u, v, cx, cy: GROND - 4 - v.h,
    snijRichting, snijNormaal: { x: -snijRichting.y, y: snijRichting.x }, snijHoek: Math.atan2(snijRichting.y, snijRichting.x) * 180 / Math.PI, tik: 0,
  };
  c.defs = defs(c);
  return c;
}

// Het eind: de vijand zakt in elkaar tot een hoopje, en "VERSLAGEN!" met goud. (Omvallen werkte
// niet: een bal of een schijf kantelde half uit beeld.)
function genadeslagScènes(c, zet, st0, deeltjes, stap0, fx0) {
  const extra = maakKruimels(c, c.cx, c.cy, 30, { extra: [c.u.binnen, '#fff'] });
  for (let i = 0; i < 6; i++) zet({ st: { ...st0, ogen: 'x', mond: 'tong', dx: Math.sin(i * 2.2) * 5 }, kruimels: kruimels(deeltjes, stap0 + i), hp: 0, spook: lerp(c.hpVoor, 0, inUit(i / 5)), boven: fx0 }, 50);
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    zet({ st: { ...st0, ogen: 'x', mond: 'tong', sx: 1 + 0.4 * in3(t), sy: 1 - 0.7 * in3(t), schaduw: 1 + 0.2 * t }, kruimels: kruimels(deeltjes, stap0 + 6 + i) + kruimels(extra, t > 0.6 ? (t - 0.6) * 20 : -1), hp: 0, boven: fx0 }, 55);
  }
  const r = zaad(c.key + 'goud');
  const sterren = Array.from({ length: 16 }, () => ({ x: r() * W, y: -20 - r() * 120, v: 4 + r() * 5, s: 6 + r() * 6 }));
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const goud = sterren.map(s => ster(s.x, s.y + s.v * i * 4, s.s, GOUD, 4, 0.4)).join('');
    zet({ st: { ...st0, ogen: 'x', mond: 'tong', sx: 1.4, sy: 0.3, schaduw: 1.2 }, kruimels: kruimels(deeltjes, 30) + kruimels(extra, 8 + i), hp: 0,
      boven: goud + knal(c, t, 'VERSLAGEN!', { kleur: GOUD, maat: 50, x: W / 2, y: 170 }), banier: 'DE GENADESLAG', banierT: t }, i === 9 ? 2600 : 60);
  }
}

function aanvalFilm(o = {}) {
  const max = Math.max(1, o.maxHp || 1);
  const voor = Math.max(0, Math.min(max, o.hpVoor ?? max));
  const wk = o.wapen && WAPENBEELD[o.wapen] ? o.wapen : 'geen';
  const wb = WAPENBEELD[wk];
  const ketst = !!o.ketst && wk === 'vetbom';
  const gemist = !ketst && (o.gemist || !(o.schade > 0));
  const schade = gemist || ketst ? 0 : Math.min(voor, Math.max(0, Math.round(o.schade)));
  const na = voor - schade;
  const dood = schade > 0 && na === 0;
  const c = context(o.vijandKey, o.vijandNaam, max);
  c.hpVoor = voor;
  const raakLokaal = wb.raak(c.v);
  c.raak = { x: c.cx + raakLokaal.x, y: c.cy + raakLokaal.y };
  const regel = banierTekst({ ...o, gemist, ketst }, wk);
  const film = [];
  const zet = (s, ms = 50) => { c.tik = film.length; film.push({ svg: beeld(c, { tik: c.tik, hp: voor, ...s }), ms }); };
  const rust = { ogen: 'boos', mond: 'grijns', kijk: { x: 0.6, y: -0.5 }, razend: !!o.razend };
  const pose = (fase, t, extra = {}) => { const p = wb.pose(fase, t, c, { ...o, ketst }); return { ...p, st: { ...extra, ...p.st } }; };

  // 1. Hij staat te loeren; het wapen komt binnen.
  for (let i = 0; i < 6; i++) { const p = pose('intro', i / 5); zet({ ...p, st: { ...rust, dy: Math.sin(i * 0.9) * 3, ...p.st } }); }
  // 2. Uithalen; hij schrikt.
  for (let i = 0; i < 4; i++) { const t = i / 3, p = pose('aanloop', t); zet({ ...p, st: { ...rust, ogen: 'bang', mond: 'open', sx: 1 - 0.04 * t, sy: 1 + 0.04 * t, ...p.st } }); }
  // 3. De slag. Bij een misser duikt hij weg.
  const ontwijk = (t) => (gemist ? -(c.v.bw + 70) * uit(t * 1.6) : 0);
  for (let i = 1; i <= wb.slagBeelden; i++) {
    const t = i / wb.slagBeelden, p = pose('slag', t);
    zet({ ...p, st: { ...rust, ogen: 'bang', mond: 'open', ...p.st, dx: ontwijk(t) } }, wb.slagBeelden > 3 ? 55 : 40);
  }

  if (ketst) {
    // De bom komt op de kijker af en ontploft in uw gezicht. Hij lacht; zijn HP blijft staan.
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      zet({ st: { ...rust, mond: 'lach', ogen: 'boos', kijk: { x: 0, y: 0.3 }, dy: Math.sin(i * 1.7) * 4 }, scherm: { kleur: i < 2 ? '#fff4c0' : '#ff8a1a', o: 0.95 * (1 - t) },
        fx: ontploffing(W / 2, H / 2 + 30, t * 0.9, 1.8), boven: knal(c, t, 'KETST!', { kleur: '#ff9a1a', maat: 56, x: W / 2, y: 150 }), banier: regel, banierT: t }, 60);
    }
    const punten = o.terugslag > 0 ? `−${o.terugslag} PT` : '';
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      zet({ st: { ...rust, mond: 'lach', ogen: 'boos', kijk: { x: 0, y: 0.3 }, dy: Math.sin(i * 1.7) * 3 }, boven: knal(c, 1, 'KETST!', { kleur: '#ff9a1a', maat: 56, x: W / 2, y: 150 }) + (punten ? knal(c, t, punten, { kleur: GOUD, maat: 40, x: W / 2, y: 215 }) : ''),
        banier: regel, banierT: 1 }, i === 5 ? 2600 : 60);
    }
    return film;
  }

  if (gemist) {
    // Hij komt terug met een grijns; "MIS!" waar hij stond.
    for (let i = 0; i < 9; i++) {
      const t = i / 8, p = pose('na', klem(t * 1.4));
      zet({ ...p, st: { ...rust, mond: 'lach', ogen: 'boos', kijk: { x: 0, y: 0.3 }, dx: ontwijk(1) * (1 - inUit(t)) }, boven: knal(c, t, 'MIS!', { kleur: '#fff', maat: 58, x: c.cx, y: c.cy + c.v.top - 4 }), banier: regel, banierT: t }, 55);
    }
    zet({ st: { ...rust, mond: 'lach', ogen: 'boos', kijk: { x: 0, y: 0.3 } }, boven: knal(c, 1, 'MIS!', { kleur: '#fff', maat: 58, x: c.cx, y: c.cy + c.v.top - 4 }), banier: regel, banierT: 1 }, 2600);
    return film;
  }

  // 4. De klap. Elk effect laat zijn eigen spoor na.
  const eff = wb.effect;
  const deeltjes = maakKruimels(c, c.raak.x, c.raak.y, eff === 'ontploffing' ? 30 : 22, { richting: eff === 'snee' ? 0 : -0.4, extra: eff === 'snee' ? [c.u.binnen] : [] });
  const gaten = eff === 'gaten' ? [-17, 0, 17].map(dy => ({ x: raakLokaal.x - 2, y: raakLokaal.y + dy * 0.9 })) : [];
  const spoor = (t) => ({
    ...(eff === 'deuk' ? { deuk: { x: raakLokaal.x * 0.8, y: raakLokaal.y * 0.8, t: klem(t * 3) } } : {}),
    ...(eff === 'gaten' ? { gaten } : {}),
    ...(eff === 'folie' ? { folie: true } : {}),
    ...(eff === 'zout' ? { zout: 1 } : {}),
    ...(eff === 'ontploffing' ? { zwart: lerp(0.6, 0.38, klem(t)) } : {}),
  });
  const plat = eff === 'plat';
  const knalSx = plat ? 1.25 : eff === 'ontploffing' ? 1.15 : 1.18, knalSy = plat ? 0.55 : 0.82;
  const fxBij = (t) => (eff === 'ontploffing' ? ontploffing(c.raak.x, c.raak.y - 30, t) : inslag(c.raak.x, c.raak.y, t));
  const strip = (t) => (eff === 'snee' ? snedeStreep(c, t) : '');
  const komisch = (t) => (plat ? knal(c, t, 'MEP!', { kleur: '#ffe14a', maat: 44, x: c.cx - c.v.bw * 0.6 - 10, y: c.cy + c.v.top + 10 }) : eff === 'ontploffing' ? knal(c, t, 'BOEM!', { kleur: '#ffb020', maat: 46, x: c.cx - c.v.bw * 0.5 - 20, y: c.cy + c.v.top - 10 }) : '');
  const schok = (i, kracht) => ({ x: Math.sin(i * 2.7) * kracht, y: Math.cos(i * 3.1) * kracht * 0.6 });
  const naP = (t) => pose('na', t);

  zet({ ...naP(0), st: { ...rust, ...spoor(0), sx: knalSx, sy: knalSy, wit: 0.75, ogen: 'dicht', mond: 'open', snee: 0 }, hp: na, spook: voor, fx: fxBij(0.05) + strip(0), boven: komisch(0.1),
    scherm: eff === 'ontploffing' ? { kleur: '#fff4c0', o: 0.7 } : null, schud: schok(1, eff === 'ontploffing' ? 10 : 5) }, 60);
  zet({ ...naP(0.08), st: { ...rust, ...spoor(0.1), sx: knalSx - 0.04, sy: knalSy + 0.04, rood: 0.55, ogen: 'dicht', mond: 'open', snee: eff === 'snee' ? 2 : 0 }, hp: na, spook: voor,
    fx: fxBij(0.35) + strip(0.3), kruimels: kruimels(deeltjes, 1), boven: komisch(0.3), schud: schok(2, eff === 'ontploffing' ? 8 : 3) }, 60);
  // 5. Hij veert terug, kruimels vliegen, het getal springt eruit.
  for (let i = 0; i < 11; i++) {
    const t = i / 10, v = veer(t);
    const st = { ...rust, ...spoor(0.2 + t), sx: lerp(knalSx - 0.04, 1, v), sy: lerp(knalSy + 0.04, 1, v), rood: 0.55 * (1 - t),
      ogen: t < 0.35 ? 'dicht' : eff === 'ontploffing' ? 'duizelig' : 'boos', mond: t < 0.35 ? 'open' : eff === 'ontploffing' ? 'tong' : 'grijns',
      kijk: { x: 0, y: 0.25 }, snee: eff === 'snee' ? 2 + 22 * terug(t) : 0, dx: Math.sin(i * 2.4) * 6 * (1 - t) };
    zet({ ...naP(0.15 + t * 0.85), st, hp: na, spook: voor, fx: fxBij(0.6 + t) + strip(0.6 + t), kruimels: kruimels(deeltjes, 2 + i),
      boven: komisch(0.5 + t) + knal(c, t, `−${schade}`), schud: eff === 'ontploffing' ? schok(i + 3, 6 * (1 - t)) : null }, 50);
  }
  const eind = { ...rust, ...spoor(2), ogen: eff === 'ontploffing' ? 'duizelig' : 'boos', mond: eff === 'ontploffing' ? 'tong' : 'grijns', kijk: { x: 0, y: 0.3 }, snee: eff === 'snee' ? 24 : 0 };
  const getal = knal(c, 1, `−${schade}`);
  const rookPluim = (i) => (eff === 'ontploffing' ? [-0.3, 0.25].map((p, k) => { const fase = (i * 0.12 + k * 0.5) % 1; return `<circle cx="${f(c.cx + p * c.v.bw)}" cy="${f(c.cy + c.v.top - 10 - fase * 50)}" r="${f(10 + fase * 14)}" fill="#3a3330" fill-opacity="${f(0.5 * (1 - fase))}"/>`; }).join('') : '');

  if (dood) {
    genadeslagScènes(c, zet, { ...eind, folie: eind.folie }, deeltjes, 13, getal);
    return film;
  }

  // 6. De HP-balk loopt leeg en de banier schuift erin.
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    zet({ st: { ...eind, dx: Math.sin(i * 2.1) * 3 * (1 - t) }, kruimels: kruimels(deeltjes, 13 + i), fx: rookPluim(i), hp: na, spook: lerp(voor, na, inUit(t)), boven: getal, banier: regel, banierT: t }, 50);
  }
  // 7. Terugslag: hij valt de kijker aan.
  if (o.terugslag > 0 && !wb.geenTerugslag) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8, aanval = Math.sin(t * Math.PI);
      zet({ st: { ...eind, ogen: 'boos', mond: 'open', sx: 1 + 0.55 * aanval, sy: 1 + 0.55 * aanval, dy: 30 * aanval, razend: true }, kruimels: kruimels(deeltjes, 23), hp: na,
        boven: knal(c, t, 'HIJ SLAAT TERUG', { kleur: '#ff5a3a', maat: 30, x: W / 2, y: 120 }) + knal(c, t - 0.2, `−${o.terugslag} PT`, { kleur: GOUD, maat: 40, x: W / 2, y: 168 }),
        scherm: { kleur: '#c8102e', o: 0.3 * aanval }, schud: schok(i, 9 * aanval), banier: regel, banierT: 1 }, 55);
    }
    zet({ st: eind, kruimels: kruimels(deeltjes, 24), hp: na, boven: getal + knal(c, 1, `−${o.terugslag} PT`, { kleur: GOUD, maat: 30, x: W / 2, y: 120 }), banier: regel, banierT: 1 }, 2600);
    return film;
  }
  zet({ st: eind, kruimels: kruimels(deeltjes, 23), fx: rookPluim(10), hp: na, boven: getal, banier: regel, banierT: 1 }, 2600);
  return film;
}

function snedeStreep(c, t) {
  if (t < 0 || t > 1) return '';
  const d = c.snijRichting, L = c.v.bw + 30;
  const a = { x: c.cx - d.x * L, y: c.cy - d.y * L }, b = { x: c.cx + d.x * L, y: c.cy + d.y * L }, o = 1 - in3(t);
  return `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="#fff" stroke-opacity="${f(o * 0.5)}" stroke-width="18" stroke-linecap="round"/>` +
    `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="#fff" stroke-opacity="${f(o)}" stroke-width="5" stroke-linecap="round"/>`;
}

// Het Frituurkanon: van links, één schot, een grote klap.
function kanonFilm(o = {}) {
  const max = Math.max(1, o.maxHp || 1);
  const voor = Math.max(0, Math.min(max, o.hpVoor ?? max));
  const schade = Math.min(voor, Math.max(0, Math.round(o.schade || 0)));
  const na = voor - schade;
  const c = context(o.vijandKey, o.vijandNaam, max, 300);
  c.hpVoor = voor;
  const film = [];
  const zet = (s, ms = 50) => { c.tik = film.length; film.push({ svg: beeld(c, { tik: c.tik, hp: voor, ...s }), ms }); };
  const rust = { ogen: 'boos', mond: 'grijns', kijk: { x: -0.7, y: 0 }, razend: !!o.razend };
  const basis = { x: 28, y: GROND - 108 }, hoek = -6;
  const loop = { x: basis.x + Math.cos(hoek * Math.PI / 180) * 178, y: basis.y + Math.sin(hoek * Math.PI / 180) * 178 };
  const kanon = (dx = 0) => plaats(SPRITE.kanon(), basis.x + dx, basis.y, hoek);
  const raak = { x: c.cx - c.v.bw + 14, y: c.cy - 6 };

  for (let i = 0; i < 6; i++) zet({ achter: kanon(-260 * (1 - uit(i / 5))), st: { ...rust, dy: Math.sin(i) * 2 } });
  for (let i = 0; i < 5; i++) {
    const t = i / 4, lont = { x: basis.x - 26 + 12 * t, y: basis.y - 46 + 38 * t };
    zet({ achter: kanon(), fx: ster(lont.x, lont.y, 10 + 5 * Math.abs(Math.sin(i * 1.9)), '#ffd23f', 6, 0.4) + ster(lont.x, lont.y, 5, '#fff', 6, 0.4), st: { ...rust, ogen: 'bang', mond: 'open' } });
  }
  for (let i = 0; i < 4; i++) {
    const t = i / 3, x = lerp(loop.x, raak.x, t), y = lerp(loop.y, raak.y, t);
    zet({ achter: kanon(-22 * (1 - t)), fx: (i === 0 ? ster(loop.x + 10, loop.y, 50, '#ffb020', 10, 0.45) + ster(loop.x + 10, loop.y, 26, '#fff3b0', 10, 0.4) : '') +
      `<circle cx="${f(loop.x + 30 * t)}" cy="${f(loop.y - 10 * t)}" r="${f(20 + 30 * t)}" fill="#7a706a" fill-opacity="${f(0.5 * (1 - t))}"/>` + zwiep({ x: loop.x, y: loop.y }, { x, y }, 34) + plaats(SPRITE.kogel(), x, y),
      st: { ...rust, ogen: 'bang', mond: 'open' }, schud: i === 0 ? { x: -5, y: 2 } : null }, 45);
  }
  const deeltjes = maakKruimels(c, raak.x, raak.y, 34, { richting: 0.8 });
  const schok = (i, k) => ({ x: Math.sin(i * 2.7) * k, y: Math.cos(i * 3.1) * k * 0.6 });
  const deuk = (t) => ({ deuk: { x: -c.v.bw * 0.75, y: -6, t: klem(t * 3) } });
  zet({ achter: kanon(), st: { ...rust, ...deuk(0), sx: 0.78, sy: 1.15, dx: 18, wit: 0.8, ogen: 'dicht', mond: 'open' }, fx: inslag(raak.x, raak.y, 0.05, 1.5), hp: na, spook: voor, scherm: { kleur: '#fff4c0', o: 0.6 }, schud: schok(1, 12) }, 60);
  zet({ achter: kanon(), st: { ...rust, ...deuk(0.1), sx: 0.82, sy: 1.12, dx: 14, rood: 0.6, ogen: 'dicht', mond: 'open' }, fx: inslag(raak.x, raak.y, 0.35, 1.5), kruimels: kruimels(deeltjes, 1), hp: na, spook: voor, schud: schok(2, 10) }, 60);
  const dood = schade > 0 && na === 0;
  for (let i = 0; i < 11; i++) {
    const t = i / 10, v = veer(t);
    zet({ achter: kanon(), st: { ...rust, ...deuk(1), sx: lerp(0.82, 1, v), sy: lerp(1.12, 1, v), dx: 14 * (1 - v), rood: 0.6 * (1 - t), ogen: t < 0.4 ? 'dicht' : 'duizelig', mond: t < 0.4 ? 'open' : 'tong' },
      fx: inslag(raak.x, raak.y, 0.6 + t, 1.5), kruimels: kruimels(deeltjes, 2 + i), hp: na, spook: voor, boven: knal(c, t, `−${schade}`, { maat: 76 }), schud: schok(i + 3, 8 * (1 - t)) }, 50);
  }
  const eind = { ...rust, ...deuk(1), ogen: 'duizelig', mond: 'tong' };
  const getal = knal(c, 1, `−${schade}`, { maat: 76 });
  if (dood) {
    genadeslagScènes(c, (s, ms) => zet({ achter: kanon(), ...s }, ms), eind, deeltjes, 13, getal);
    return film;
  }
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    zet({ achter: kanon(), st: eind, kruimels: kruimels(deeltjes, 13 + i), hp: na, spook: lerp(voor, na, inUit(t)), boven: getal, banier: 'HET FRITUURKANON', banierT: t }, i === 9 ? 2600 : 50);
  }
  return film;
}

// De bliksem van de Kroket God: een schicht van boven (schade), of een groene gloed (heling, `heling: true`).
// `bedrag` = de HP die eraf of erbij gaat.
function bliksemFilm(o = {}) {
  const max = Math.max(1, o.maxHp || 1);
  const heel = !!o.heling;
  const voor = Math.max(0, Math.min(max, o.hpVoor ?? max));
  const bedrag = Math.max(0, Math.round(o.bedrag || 0));
  const na = heel ? Math.min(max, voor + bedrag) : Math.max(0, voor - bedrag);
  const c = context(o.vijandKey, o.vijandNaam, max);
  c.hpVoor = voor;
  const film = [];
  const zet = (s, ms = 50) => { c.tik = film.length; film.push({ svg: beeld(c, { tik: c.tik, hp: voor, ...s }), ms }); };
  const rust = { ogen: 'boos', mond: 'grijns', kijk: { x: 0, y: -0.6 }, razend: !!o.razend };
  const top = { x: c.cx, y: c.cy + c.v.top };
  const r = zaad(c.key + 'bliksem');
  // Een gekartelde schicht van boven naar de kop.
  const stappen = 7, punten = [{ x: top.x + 40, y: 74 }];
  for (let i = 1; i < stappen; i++) punten.push({ x: top.x + (r() * 2 - 1) * 50, y: lerp(74, top.y, i / stappen) });
  punten.push(top);
  const lijn = punten.map(p => `${f(p.x)},${f(p.y)}`).join(' ');
  const schicht = (t) => `<polyline points="${lijn}" fill="none" stroke="#7fb4ff" stroke-opacity="${f(0.55 * (1 - t))}" stroke-width="26" stroke-linejoin="round"/>` +
    `<polyline points="${lijn}" fill="none" stroke="#fffbd0" stroke-opacity="${f(1 - t * 0.6)}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>`;
  const gloed = (t) => `<ellipse cx="${f(c.cx)}" cy="${f(c.cy)}" rx="${f(c.v.bw * (1 + 0.5 * t))}" ry="${f(Math.abs(c.v.top) * (1 + 0.4 * t))}" fill="#3dff7a" fill-opacity="${f(0.45 * (1 - t * 0.5))}"/>`;
  const plusjes = (t) => Array.from({ length: 9 }, (_, i) => {
    const x = c.cx + (i - 4) * c.v.bw * 0.22, y = c.cy + c.v.top * 0.2 - ((t * 120 + i * 23) % 150);
    return tekst(x, y, '+', { maat: 34, kleur: '#b6ffcc', rand: '#0c4a22', randB: 5 });
  }).join('');

  for (let i = 0; i < 6; i++) zet({ st: { ...rust, dy: Math.sin(i) * 2 } });
  if (heel) {
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      zet({ st: { ...rust, ogen: 'dicht', mond: 'open' }, fx: gloed(t) + plusjes(t), scherm: { kleur: '#3dff7a', o: 0.1 * Math.sin(t * Math.PI) }, hp: lerp(voor, na, inUit(t)), spook: voor });
    }
    const eind = { ...rust, ogen: 'dicht', mond: 'open' };
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      zet({ st: eind, fx: gloed(1) , boven: knal(c, t, `+${bedrag}`, { kleur: '#5dff8a', maat: 76 }), hp: na, spook: na, banier: 'DE KROKET GOD HELPT', banierT: t }, i === 9 ? 2600 : 50);
    }
    return film;
  }
  for (let i = 0; i < 4; i++) zet({ st: { ...rust, ogen: 'bang', mond: 'open' }, scherm: { kleur: '#0b1030', o: 0.15 + 0.15 * i } });
  zet({ st: { ...rust, ogen: 'dicht', mond: 'open', wit: 0.8 }, fx: schicht(0), scherm: { kleur: '#ffffff', o: 0.7 }, hp: na, spook: voor, schud: { x: -6, y: 3 } }, 70);
  zet({ st: { ...rust, ogen: 'dicht', mond: 'open', wit: 0.5 }, fx: schicht(0.4) + inslag(top.x, top.y, 0.2, 1.5), hp: na, spook: voor, scherm: { kleur: '#bcd4ff', o: 0.3 }, schud: { x: 5, y: -3 } }, 60);
  const deeltjes = maakKruimels(c, top.x, top.y, 26, { richting: 0 });
  const dood = bedrag > 0 && na === 0;
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    zet({ st: { ...rust, ogen: t < 0.4 ? 'dicht' : 'duizelig', mond: t < 0.4 ? 'open' : 'tong', rood: 0.5 * (1 - t) }, fx: inslag(top.x, top.y, 0.4 + t * 0.6, 1.5),
      kruimels: kruimels(deeltjes, 1 + i), hp: na, spook: voor, boven: knal(c, t, `−${Math.min(bedrag, voor)}`, { maat: 76 }), schud: { x: Math.sin(i * 2.7) * 7 * (1 - t), y: 0 } });
  }
  const eind = { ...rust, ogen: 'duizelig', mond: 'tong' };
  const getal = knal(c, 1, `−${Math.min(bedrag, voor)}`, { maat: 76 });
  if (dood) { genadeslagScènes(c, zet, eind, deeltjes, 11, getal); return film; }
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    zet({ st: eind, kruimels: kruimels(deeltjes, 11 + i), hp: na, spook: lerp(voor, na, inUit(t)), boven: getal, banier: 'BLIKSEM VAN DE KROKET GOD', banierT: t }, i === 9 ? 2600 : 50);
  }
  return film;
}

module.exports = { aanvalFilm, kanonFilm, bliksemFilm, UITERLIJK, VORMEN, BELEG, WAPENBEELD, uiterlijkVan, W, H };
