// De illustraties op de actiekaarten van App Home 2.0 (liggend, geen tekst: de titel staat in de kaart)
// en het portret van de weekvijand. Puur: SVG-teksten, geen I/O. Renderen (naarPng) en op R2 zetten
// doet index.js, één keer; de URL's staan in kaartbeelden.json.
// Stijl als de casino- en vijandplaatjes: donkere frituurkeuken, gouden gloed, dikke bruine contouren.
'use strict';

const { portretBeeld } = require('./vijandbeeld.js');

const W = 600, H = 300;
const LIJN = '#2b0d03', GOUD = '#f2c14e';
const rand = `stroke="${LIJN}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;

const ster = (x, y, r, kleur = '#fff3b0') => `<path d="M${x},${y - r}L${x + r * 0.28},${y - r * 0.28}L${x + r},${y}L${x + r * 0.28},${y + r * 0.28}L${x},${y + r}L${x - r * 0.28},${y + r * 0.28}L${x - r},${y}L${x - r * 0.28},${y - r * 0.28}Z" fill="${kleur}"/>`;
const sterren = (...p) => p.map(([x, y, r]) => ster(x, y, r)).join('');
const straal = (x, y, r1, r2, n, kleur = GOUD) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return `<line x1="${x + Math.cos(a) * r1}" y1="${y + Math.sin(a) * r1}" x2="${x + Math.cos(a) * r2}" y2="${y + Math.sin(a) * r2}" stroke="${kleur}" stroke-opacity="0.55" stroke-width="7" stroke-linecap="round"/>`;
}).join('');

// Een kroket (liggende staaf) met glans en ragout; draait om (x, y).
const kroket = (x, y, draai = 0, s = 1) => `<g transform="translate(${x} ${y}) rotate(${draai}) scale(${s})">` +
  `<rect x="-70" y="-30" width="140" height="60" rx="30" fill="url(#kr)" ${rand}/>` +
  `<path d="M-48,-14Q0,-24 48,-14" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round"/>` +
  `<circle cx="-30" cy="8" r="3" fill="#a8641a"/><circle cx="0" cy="14" r="3" fill="#a8641a"/><circle cx="32" cy="6" r="3" fill="#a8641a"/></g>`;

const SCENES = {
  raadpleeg: () => straal(300, 150, 110, 160, 14) + `<ellipse cx="300" cy="248" rx="120" ry="14" fill="#000" fill-opacity="0.35"/>` +
    kroket(300, 150, -12, 1.5) + `<ellipse cx="300" cy="62" rx="70" ry="16" fill="none" stroke="${GOUD}" stroke-width="9"/>` +
    sterren([120, 90, 16], [490, 80, 20], [160, 200, 12], [450, 210, 15]),
  duel: () => `<ellipse cx="300" cy="250" rx="200" ry="14" fill="#000" fill-opacity="0.35"/>` +
    [-1, 1].map(z => `<g transform="translate(300 165) scale(${z * 1.3} 1.3) rotate(-40)"><rect x="-6" y="-120" width="12" height="150" rx="4" fill="url(#staal)" ${rand}/><rect x="-30" y="28" width="60" height="12" rx="5" fill="${GOUD}" ${rand}/><rect x="-7" y="38" width="14" height="42" rx="5" fill="#7a4a26" ${rand}/></g>`).join('') +
    `<g transform="translate(300 135) scale(0.8)"><path d="M0,-52L12,-14L50,-26L22,2L56,26L16,22L10,58L-6,24L-46,44L-22,8L-58,-8L-16,-12Z" fill="#ffd23f" ${rand}/></g>` +
    kroket(110, 205, -20, 0.7) + kroket(490, 205, 20, 0.7),
  roof: () => `<ellipse cx="300" cy="256" rx="170" ry="14" fill="#000" fill-opacity="0.35"/>` +
    `<path d="M210,250C170,190 200,130 262,100L338,100C400,130 430,190 390,250Z" fill="#a8761f" ${rand}/>` +
    `<path d="M255,100L345,100L330,72L270,72Z" fill="#8a5c12" ${rand}/><path d="M262,96Q300,114 338,96" fill="none" stroke="${LIJN}" stroke-width="5"/>` +
    `<circle cx="300" cy="176" r="38" fill="${GOUD}" ${rand}/><circle cx="300" cy="176" r="24" fill="none" stroke="#a8761f" stroke-width="5"/>` +
    [[150, 232], [190, 250], [440, 240], [470, 252]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="22" ry="8" fill="${GOUD}" ${rand}/>`).join('') +
    `<g transform="translate(468 90) rotate(14)"><path d="M-46,-6Q-46,-34 0,-34Q46,-34 46,-6Q30,22 0,12Q-30,22 -46,-6Z" fill="#1b1b22" ${rand}/><ellipse cx="-20" cy="-8" rx="9" ry="6" fill="#fff"/><ellipse cx="20" cy="-8" rx="9" ry="6" fill="#fff"/></g>`,
  offer: () => `<ellipse cx="300" cy="258" rx="190" ry="14" fill="#000" fill-opacity="0.35"/>` +
    [[220, 170, -14, [[0, 0]]], [380, 150, 16, [[-18, -18], [18, 18], [-18, 18], [18, -18], [0, 0]]]].map(([x, y, d, pips]) =>
      `<g transform="translate(${x} ${y}) rotate(${d})"><rect x="-58" y="-58" width="116" height="116" rx="22" fill="#fff6e0" ${rand}/>` +
      pips.map(([a, b]) => `<circle cx="${a * 1.5}" cy="${b * 1.5}" r="9" fill="#c8102e"/>`).join('') + '</g>').join('') +
    `<path d="M300,40C250,70 330,100 300,130" fill="none" stroke="#ff7a1a" stroke-width="10" stroke-linecap="round"/>` + sterren([110, 80, 16], [500, 70, 14], [300, 36, 12]),
  casino: () => `<ellipse cx="300" cy="266" rx="150" ry="12" fill="#000" fill-opacity="0.35"/>` +
    `<rect x="190" y="40" width="220" height="220" rx="28" fill="#c8102e" ${rand}/><rect x="212" y="84" width="176" height="92" rx="14" fill="#fff6e0" ${rand}/>` +
    [0, 1, 2].map(i => `<line x1="${212 + 58.7 * (i + 1)}" y1="84" x2="${212 + 58.7 * (i + 1)}" y2="176" stroke="${LIJN}" stroke-width="4"/>`).join('') +
    `<circle cx="241" cy="130" r="18" fill="#c8102e" ${rand}/>` + ster(300, 130, 24, GOUD) + `<circle cx="359" cy="130" r="18" fill="#2a9d4a" ${rand}/>` +
    `<rect x="236" y="196" width="128" height="36" rx="10" fill="#7a0a1c" ${rand}/>` + sterren([258, 214, 8], [300, 214, 8], [342, 214, 8]) +
    `<line x1="410" y1="110" x2="454" y2="64" stroke="#9aa4ae" stroke-width="10" stroke-linecap="round"/><circle cx="458" cy="58" r="16" fill="#e04040" ${rand}/>` +
    [[120, 230], [120, 214], [120, 198], [480, 236], [480, 220]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="38" ry="11" fill="#1f6fb8" ${rand}/>`).join(''),
  eer: () => straal(300, 130, 90, 150, 16) + `<ellipse cx="300" cy="262" rx="150" ry="14" fill="#000" fill-opacity="0.35"/>` +
    `<path d="M220,262L236,196L364,196L380,262Z" fill="#8a8f98" ${rand}/><rect x="210" y="186" width="180" height="20" rx="8" fill="#b9c0c9" ${rand}/>` +
    kroket(300, 150, 0, 1.15) + `<ellipse cx="300" cy="86" rx="60" ry="14" fill="none" stroke="${GOUD}" stroke-width="9"/>` +
    [150, 450].map(x => `<rect x="${x - 12}" y="170" width="24" height="90" rx="6" fill="#f4efe6" ${rand}/><path d="M${x},166C${x - 14},146 ${x},130 ${x},120C${x},130 ${x + 14},146 ${x},166Z" fill="#ff9a1f" ${rand}/>`).join(''),
  gunst: () => `<ellipse cx="300" cy="262" rx="150" ry="14" fill="#000" fill-opacity="0.35"/>` +
    `<rect x="210" y="130" width="180" height="130" rx="10" fill="#c8102e" ${rand}/><rect x="198" y="104" width="204" height="40" rx="10" fill="#e0334d" ${rand}/>` +
    `<rect x="282" y="104" width="36" height="156" fill="${GOUD}" ${rand}/>` +
    `<path d="M300,104C260,50 200,70 236,104Z" fill="${GOUD}" ${rand}/><path d="M300,104C340,50 400,70 364,104Z" fill="${GOUD}" ${rand}/>` +
    sterren([140, 100, 18], [470, 120, 22], [120, 210, 12], [490, 220, 14], [300, 40, 14]),
  visioen: () => straal(300, 150, 120, 170, 18, '#b48cff') +
    `<path d="M90,150Q300,10 510,150Q300,290 90,150Z" fill="#fff6e0" ${rand}/><circle cx="300" cy="150" r="62" fill="#6a3fd0" ${rand}/><circle cx="300" cy="150" r="34" fill="#1b1033"/>` +
    `<circle cx="282" cy="132" r="12" fill="#fff"/>` + sterren([140, 60, 16], [470, 70, 20], [90, 240, 12], [520, 236, 16], [300, 30, 12]),
  bingo: () => `<rect x="150" y="30" width="230" height="240" rx="16" fill="#fff6e0" transform="rotate(-6 265 150)" ${rand}/>` +
    `<g transform="rotate(-6 265 150)">` + Array.from({ length: 16 }, (_, i) => {
      const x = 170 + (i % 4) * 52, y = 50 + Math.floor(i / 4) * 52;
      return `<rect x="${x}" y="${y}" width="44" height="44" rx="8" fill="${[0, 5, 10, 15, 6].includes(i) ? '#f9d6dc' : '#fff'}" stroke="${LIJN}" stroke-width="3"/>` +
        ([0, 5, 10, 15, 6].includes(i) ? `<circle cx="${x + 22}" cy="${y + 22}" r="14" fill="#c8102e"/>` : '');
    }).join('') + '</g>' +
    [[440, 90, '#2a9d4a'], [490, 170, '#1f6fb8'], [430, 230, '#e8a21c']].map(([x, y, k]) => `<circle cx="${x}" cy="${y}" r="34" fill="${k}" ${rand}/><circle cx="${x}" cy="${y}" r="15" fill="#fff6e0"/><ellipse cx="${x - 12}" cy="${y - 16}" rx="10" ry="6" fill="#fff" fill-opacity="0.5"/>`).join(''),
  gok: () => `<ellipse cx="300" cy="262" rx="130" ry="14" fill="#000" fill-opacity="0.35"/>` +
    `<path d="M240,262L262,214L338,214L360,262Z" fill="#7a4a26" ${rand}/><circle cx="300" cy="132" r="88" fill="#3a86ff" fill-opacity="0.85" ${rand}/>` +
    `<ellipse cx="270" cy="96" rx="26" ry="14" fill="#fff" fill-opacity="0.5" transform="rotate(-30 270 96)"/>` +
    `<path d="M282,120Q300,90 318,120Q318,140 300,148L300,160" fill="none" stroke="#fff6e0" stroke-width="11" stroke-linecap="round"/><circle cx="300" cy="182" r="7" fill="#fff6e0"/>` +
    sterren([120, 90, 18], [490, 100, 16], [150, 220, 12], [470, 230, 18]),
  veiling: () => `<ellipse cx="300" cy="262" rx="170" ry="14" fill="#000" fill-opacity="0.35"/>` +
    `<ellipse cx="250" cy="238" rx="90" ry="22" fill="#7a4a26" ${rand}/><rect x="160" y="216" width="180" height="22" fill="#7a4a26" ${rand}/><ellipse cx="250" cy="216" rx="90" ry="22" fill="#a8641a" ${rand}/>` +
    `<g transform="translate(330 110) rotate(-28)"><rect x="-70" y="-30" width="120" height="60" rx="14" fill="#a8641a" ${rand}/><rect x="-14" y="-12" width="150" height="24" rx="10" fill="#7a4a26" ${rand}/></g>` +
    `<circle cx="250" cy="196" r="26" fill="${GOUD}" ${rand}/>` + straal(250, 196, 40, 66, 10) + sterren([470, 80, 18], [130, 90, 14]),
  gast: () => `<ellipse cx="300" cy="266" rx="150" ry="12" fill="#000" fill-opacity="0.35"/>` +
    `<path d="M300,60L470,250L130,250Z" fill="#ffd23f" fill-opacity="0.3"/>` +
    `<path d="M210,262V92Q210,48 300,48Q390,48 390,92V262Z" fill="#ffb347" ${rand}/><path d="M232,262V98Q232,70 300,70Q368,70 368,98V262Z" fill="#fff3b0"/>` +
    `<path d="M300,170a24,24 0 1 1 0.01,0Z" fill="#1b1b22" ${rand}/><path d="M258,262Q262,198 300,196Q338,198 342,262Z" fill="#1b1b22" ${rand}/>` +
    `<path d="M430,70L452,28L474,70Z" fill="#c8102e" ${rand}/><circle cx="452" cy="24" r="8" fill="${GOUD}"/>` + sterren([120, 110, 16], [500, 150, 14], [140, 220, 12]),
};

const KAART_SLEUTELS = Object.keys(SCENES);
// action_id van de actiekaart in de Home -> sleutel van zijn tekening.
const KNOP_NAAR_SLEUTEL = {
  open_raadpleeg: 'raadpleeg', open_duel: 'duel', open_roof: 'roof', open_offer: 'offer', open_casino: 'casino',
  open_eer: 'eer', open_gunst: 'gunst', open_visioen: 'visioen', open_bingo: 'bingo', open_gok: 'gok',
  veiling_bied_1: 'veiling', veiling_bied_3: 'veiling',
  gast_vasthouden_0: 'gast', gast_vasthouden_1: 'gast', gast_vasthouden_2: 'gast', gast_vasthouden_3: 'gast',
};

const DEFS = `<defs>
<linearGradient id="lucht" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2210"/><stop offset="1" stop-color="#1a0a05"/></linearGradient>
<radialGradient id="spot" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb347" stop-opacity="0.4"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
<radialGradient id="vignet" cx="50%" cy="48%" r="72%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
<radialGradient id="kr" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="#f6c46c"/><stop offset="0.5" stop-color="#d98c35"/><stop offset="1" stop-color="#8f4a14"/></radialGradient>
<linearGradient id="staal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f4f7fa"/><stop offset="0.5" stop-color="#b9c3cd"/><stop offset="1" stop-color="#7d8894"/></linearGradient>
</defs>`;

function kaartSvg(sleutel) {
  if (!SCENES[sleutel]) throw new Error(`geen kaarttekening: ${sleutel}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}` +
    `<rect width="${W}" height="${H}" fill="url(#lucht)"/><ellipse cx="300" cy="150" rx="280" ry="170" fill="url(#spot)"/>` +
    `${SCENES[sleutel]()}<rect width="${W}" height="${H}" fill="url(#vignet)"/></svg>`;
}

const vijandPortret = (key) => portretBeeld(key);

module.exports = { kaartSvg, vijandPortret, KAART_SLEUTELS, KNOP_NAAR_SLEUTEL };
