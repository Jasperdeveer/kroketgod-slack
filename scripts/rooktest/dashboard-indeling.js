// Rooktest: dashboard.html na de herindeling bevat alles wat de oude had (API-paden, acties, velden),
// het inline script parseert en er zijn zes tabs met chips.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const oud = execSync('git show 096c775:dashboard.html', { cwd: path.join(__dirname, '..', '..'), maxBuffer: 1 << 26 }).toString();
const nieuw = fs.readFileSync(path.join(__dirname, '..', '..', 'dashboard.html'), 'utf8');

function inventaris(h) {
  const set = new Set();
  const pats = [
    [/\/api\/[a-zA-Z0-9/_-]+/g, (m) => m[0]],
    [/data-actie="(\w+)"/g, (m) => 'actie:' + m[1]],
    [/actie:'(\w+)'/g, (m) => 'actie:' + m[1]],
    [/(?:nbActie|doeActie)\('(\w+)'\)/g, (m) => 'actie:' + m[1]],
    [/id="((?:i|w|e|g|p|test)_\w+)"/g, (m) => 'veld:' + m[1]],
    [/data-(save|test|verkondig|eer|winkel|gast-uitnodigen|persona-\w+)\b/g, (m) => 'knop:' + m[1] + (m[0].includes('=') ? '' : '')],
  ];
  for (const [re, f] of pats) for (const m of h.matchAll(re)) set.add(f(m));
  return set;
}

const fouten = [];
const nu = inventaris(nieuw);
for (const x of inventaris(oud)) if (!nu.has(x)) fouten.push('mist: ' + x);

const scripts = [...nieuw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
try { new Function(scripts.join('\n')); } catch (e) { fouten.push('script parseert niet: ' + e.message); }

const tabs = [...nieuw.matchAll(/<button class="tab[^"]*" data-tab="(\w+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(tabs, ['overzicht', 'spel', 'recht', 'verkondigen', 'personas', 'systeem'], 'tabs: ' + tabs);
for (const t of tabs) {
  const m = nieuw.match(new RegExp('<section class="tabpane[^"]*" id="tab-' + t + '">([\\s\\S]*?)</section>'));
  if (!m) { fouten.push('geen pane ' + t); continue; }
  const chips = [...m[1].matchAll(/class="chip" href="#(\w+)\/([\w-]+)"/g)];
  if (!chips.length) fouten.push('geen chips in ' + t);
  for (const c of chips) if (c[1] !== t) fouten.push('chip in verkeerde tab: ' + c[0]);
}
// Elke chip wijst naar een kaart-id die in de pagina voorkomt (statisch of via card(..., 'id')).
for (const m of nieuw.matchAll(/href="#\w+\/([\w-]+)"/g)) {
  const id = 'k-' + m[1];
  if (!nieuw.includes('id="' + id + '"') && !nieuw.includes("'" + m[1] + "'")) fouten.push('chip zonder kaart: ' + id);
}
const ids = [...nieuw.matchAll(/ id="(i_\w+|w_\w+|e_\w+|test_\w+)"/g)].map((m) => m[1]);
const dubbel = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dubbel.length) fouten.push('dubbele id: ' + dubbel.join(','));
if (!/id="i_regieNiveau"[^>]*>\s*<option>uit<\/option>/.test(nieuw) && !/<option selected>normaal/.test(nieuw)) fouten.push('niveau-select mist selected normaal');
if (!nieuw.includes('Wat de Kroket God vandaag deed')) fouten.push('mist kaart vandaag-lijst');

if (fouten.length) { console.error(fouten.join('\n')); process.exit(1); }
console.log('dashboard-indeling: ok (' + nu.size + ' items, ' + tabs.length + ' tabs)');
