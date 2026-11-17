// Rooktest: dashboard.html (Dashboard 2.0) bevat alles wat het oude dashboard had (API-paden, acties,
// velden, knoppen), elk script parseert, en de pagina heeft de zeven secties van het ontwerp.
// Run: `node scripts/rooktest/dashboard-indeling.js`.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const repo = path.join(__dirname, '..', '..');
const oud = execSync('git show b8ebc84:dashboard.html', { cwd: repo, maxBuffer: 1 << 26 }).toString();
const nieuw = fs.readFileSync(path.join(repo, 'dashboard.html'), 'utf8');

function inventaris(h) {
  const set = new Set();
  const pats = [
    [/\/api\/[a-zA-Z0-9/_-]+/g, (m) => m[0]],
    [/data-actie="(\w+)"/g, (m) => 'actie:' + m[1]],
    [/actie:'(\w+)'/g, (m) => 'actie:' + m[1]],
    [/(?:nbActie|doeActie)\('(\w+)'\)/g, (m) => 'actie:' + m[1]],
    [/id="((?:i|w|e|g|p|test)_\w+)"/g, (m) => 'veld:' + m[1]],
    [/(?:chk|num)\('(i_\w+)'/g, (m) => 'veld:' + m[1]], // instellingen die via een helper gebouwd worden
    [/data-(save|test|verkondig|eer|winkel|gast-uitnodigen|persona-\w+|prov)\b/g, (m) => 'knop:' + m[1]],
  ];
  for (const [re, f] of pats) for (const m of h.matchAll(re)) set.add(f(m));
  return set;
}

const fouten = [];
const nu = inventaris(nieuw);
for (const x of inventaris(oud)) if (!nu.has(x)) fouten.push('mist: ' + x);

const scripts = [...nieuw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
try { new Function(scripts.join('\n')); } catch (e) { fouten.push('script parseert niet: ' + e.message); }

// De pure kern (helpers, grafieken, skelet) draait zonder DOM.
const kern = nieuw.match(/<script id="kern">([\s\S]*?)<\/script>/);
if (!kern) { console.error('geen <script id="kern">'); process.exit(1); }
const K = vm.runInNewContext(kern[1] + '\n;({ SECS, SKEL })', {});
const secties = K.SECS.map((s) => s[0]);
assert.strictEqual(secties.join(','), 'live,spelers,economie,casino,regisseur,weekvijand,systeem', 'secties: ' + secties); // array uit een andere vm-context: als tekst vergelijken
for (const s of secties) {
  if (typeof K.SKEL[s] !== 'string') fouten.push('geen skelet voor ' + s);
  else if (!K.SKEL[s].includes(`id="kp-${s}"`)) fouten.push('geen KPI-tegels in ' + s);
}

const ids = [...nieuw.matchAll(/ id="((?:i|w|e|g|p|test)_\w+)"/g)].map((m) => m[1]);
const dubbel = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dubbel.length) fouten.push('dubbele id: ' + dubbel.join(','));
if (!/id="i_regieNiveau"[^>]*>\s*<option>uit<\/option>/.test(nieuw)) fouten.push('niveau-select mist');
if (!nieuw.includes('Wat de Kroket God vandaag deed')) fouten.push('mist de lijst "Wat de Kroket God vandaag deed"');

// Regels uit het plan: geen samengestelde strings in inline handlers, localStorage alleen in try, niets van buiten.
if (/\bon\w+="[^"]*'\s*\+/.test(nieuw)) fouten.push('inline handler met samengestelde string (gebruik data-* en een gedelegeerde listener)');
for (const regel of nieuw.split('\n')) if (/localStorage\./.test(regel) && !/try\s*\{/.test(regel)) fouten.push('localStorage buiten try: ' + regel.trim().slice(0, 80));
if (/<script[^>]*\bsrc=|<link\b|@import|url\(\s*['"]?https?:/i.test(nieuw)) fouten.push('externe bron (script, stylesheet of font)');

if (fouten.length) { console.error(fouten.join('\n')); process.exit(1); }
console.log('dashboard-indeling: ok (' + nu.size + ' items, ' + secties.length + ' secties)');
