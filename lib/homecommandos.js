// ── Commando's vanuit de App Home ──────────────────────────────────────────────
// Elk commando in het register heeft een sjabloon zoals `eer [namen] (voor [reden])`. Uit dat
// sjabloon leiden we zowel het Home-formulier af als de tekst die naar de slash-commando-handler
// gaat. Een nieuw commando in het register staat dus vanzelf in de Home-tab — er is geen
// tweede lijst om bij te houden. Pure functies, zodat de test ze zonder Slack kan draaien.

// Commando's die in de Home-tab geen zin hebben: lijstjes die de Home zelf al vervangt, of een
// flow die buiten de Home al een eigen ingang heeft.
const NIET_IN_HOME = new Set(['help', 'prompts', 'kroketprompts', 'aanmelden']);

// Placeholdernaam → soort veld. Alles wat hier niet staat wordt een tekstveld.
const VELD_SOORT = { naam: 'lid', namen: 'leden' };

function normaliseer(sjabloon) {
  return sjabloon.replace(/^\/kroketgod\s*/, '').trim();
}

// Zet een sjabloon om in onderdelen: vaste woorden en velden (in volgorde).
//   `eer [namen] (voor [reden])` → lit 'eer', veld leden, optioneel veld tekst met voorvoegsel 'voor'
//   `gok krokant|slap`           → lit 'gok', veld keuze [krokant, slap]
function parseSjabloon(sjabloon) {
  const delen = [];
  const re = /\(([^)]*)\)|\[([^\]]+)\]|(\S+)/g;
  let m;
  while ((m = re.exec(normaliseer(sjabloon)))) {
    if (m[1] !== undefined) {
      // Optionele groep: vaste woorden gevolgd door één placeholder, bv. "voor [reden]".
      const binnen = m[1].match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
      if (binnen) delen.push({ soort: 'tekst', label: binnen[2], optioneel: true, voorvoegsel: binnen[1].trim() });
      else delen.push({ soort: 'lit', tekst: m[1] });
    } else if (m[2] !== undefined) {
      delen.push({ soort: VELD_SOORT[m[2]] || 'tekst', label: m[2], optioneel: false });
    } else if (m[3].includes('|') && m[3] !== '|') {
      delen.push({ soort: 'keuze', label: 'keuze', opties: m[3].split('|'), optioneel: false });
    } else {
      delen.push({ soort: 'lit', tekst: m[3] });
    }
  }
  return delen;
}

const velden = (delen) => delen.filter(d => d.soort !== 'lit');

// Bouwt de commandotekst uit de ingevulde waarden. `waarden[i]` hoort bij het i-de veld:
// een string, of een array van namen bij een `leden`-veld.
function bouwCommandoTekst(sjabloon, waarden) {
  let i = 0;
  const stukken = [];
  for (const d of parseSjabloon(sjabloon)) {
    if (d.soort === 'lit') { stukken.push(d.tekst); continue; }
    const w = waarden[i++];
    const tekst = Array.isArray(w) ? w.filter(Boolean).join(' en ') : (w || '').trim();
    if (!tekst) continue; // leeg optioneel veld: ook het voorvoegsel weglaten
    if (d.voorvoegsel) stukken.push(d.voorvoegsel);
    stukken.push(tekst);
  }
  return stukken.join(' ').replace(/\s+/g, ' ').trim();
}

const kap = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const hoofdletter = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Modal voor één commando. `ledenOpties` = Block Kit-opties voor de medeleden,
// `maxLeden` = hoeveel namen een `leden`-veld maximaal toestaat.
function bouwCommandoModal(sjabloon, uitleg, ledenOpties, maxLeden = 10) {
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: kap(`*${normaliseer(sjabloon)}*\n_${uitleg || ''}_`, 3000) } }];
  velden(parseSjabloon(sjabloon)).forEach((v, i) => {
    let element;
    if (v.soort === 'lid' || v.soort === 'leden') {
      if (!ledenOpties.length) return;
      element = v.soort === 'leden'
        ? { type: 'multi_static_select', action_id: 'w', options: ledenOpties.slice(0, 100), max_selected_items: Math.max(1, maxLeden) }
        : { type: 'static_select', action_id: 'w', options: ledenOpties.slice(0, 100) };
      element.placeholder = { type: 'plain_text', text: v.soort === 'leden' ? 'Een of meer medeleden…' : 'Een medelid…' };
    } else if (v.soort === 'keuze') {
      element = { type: 'static_select', action_id: 'w', options: v.opties.map(o => ({ text: { type: 'plain_text', text: kap(o, 75) }, value: o })) };
    } else {
      element = { type: 'plain_text_input', action_id: 'w', max_length: 500 };
    }
    blocks.push({
      type: 'input', block_id: `v${i}`, optional: v.optioneel,
      label: { type: 'plain_text', text: kap(hoofdletter(v.label), 2000) },
      element,
    });
  });
  return {
    type: 'modal',
    callback_id: 'home_cmd_modal',
    private_metadata: sjabloon,
    title: { type: 'plain_text', text: kap(hoofdletter(normaliseer(sjabloon).split(' ')[0].replace(/\[.*/, 'Commando') || 'Commando'), 24) },
    submit: { type: 'plain_text', text: 'Uitvoeren' },
    close: { type: 'plain_text', text: 'Sluiten' },
    blocks,
  };
}

// Leest de ingevulde waarden uit een view_submission, in veldvolgorde. Ledenvelden bevatten
// user-ID's; `naamVan` zet die om naar de naam die de commando-handler herkent.
function leesModalWaarden(sjabloon, state, naamVan = (id) => id) {
  return velden(parseSjabloon(sjabloon)).map((v, i) => {
    const w = state?.[`v${i}`]?.w;
    if (!w) return '';
    if (w.selected_options) return w.selected_options.map(o => naamVan(o.value));
    if (w.selected_option) return v.soort === 'lid' ? naamVan(w.selected_option.value) : w.selected_option.value;
    return w.value || '';
  });
}

// Groepeert het register ({ categorie } | { cmd, uitleg }) tot Home-menu's: één keuzemenu per
// categorie. `extra` = losse commando's uit de help die niet in het register staan.
function bouwCommandoMenus(register, extra = [], isAdmin = false) {
  const menus = [];
  const gezien = new Set();
  const voegToe = (item) => {
    const sjabloon = normaliseer(item.cmd);
    const eersteWoord = sjabloon.split(' ')[0];
    if (!sjabloon || NIET_IN_HOME.has(eersteWoord) || gezien.has(sjabloon)) return;
    if (/^\(admin\)/.test(item.uitleg || '') && !isAdmin) return;
    gezien.add(sjabloon);
    menus[menus.length - 1].opties.push({ sjabloon, uitleg: item.uitleg || '' });
  };
  for (const item of register) {
    if (item.categorie) menus.push({ categorie: item.categorie, opties: [] });
    else if (menus.length) voegToe(item);
  }
  const eigenWoorden = new Set([...gezien].map(s => s.split(' ')[0]));
  menus.push({ categorie: '🧩 Overig', opties: [] });
  for (const item of extra) {
    // Help-regels die al als registercommando bestaan (zelfde eerste woord) niet dubbel tonen.
    if (eigenWoorden.has(normaliseer(item.cmd).split(' ')[0])) continue;
    voegToe(item);
  }
  return menus.filter(m => m.opties.length);
}

// Eén actions-blok met een keuzemenu per categorie (placeholder = categorienaam). Eén blok i.p.v.
// één per categorie: de Home-tab mag maximaal 100 blokken hebben en zit daar al dicht bij.
// Slack-limieten: 25 elementen per actions-blok, 100 opties per menu.
function bouwMenuBlocks(menus) {
  if (!menus.length) return [];
  return [{
    type: 'actions',
    block_id: 'home_cmd_menus',
    elements: menus.slice(0, 25).map((m, idx) => ({
      type: 'static_select',
      action_id: `home_cmd_kies_${idx}`,
      placeholder: { type: 'plain_text', text: kap(m.categorie, 150), emoji: true },
      // Uitleg in de optietekst zelf: `description` bestaat alleen bij checkboxes/radio's.
      options: m.opties.slice(0, 100).map(o => ({
        text: { type: 'plain_text', text: kap(o.uitleg ? `${o.sjabloon} — ${o.uitleg}` : o.sjabloon, 75) },
        value: kap(o.sjabloon, 150),
      })),
    })),
  }];
}

module.exports = {
  NIET_IN_HOME,
  parseSjabloon,
  bouwCommandoTekst,
  bouwCommandoModal,
  leesModalWaarden,
  bouwCommandoMenus,
  bouwMenuBlocks,
  heeftVelden: (sjabloon) => velden(parseSjabloon(sjabloon)).length > 0,
};
