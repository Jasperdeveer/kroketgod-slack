// ── Runtime-instellingen ───────────────────────────────────────────────────────
// Aanpasbaar via het dashboard en direct werkzaam: er is geen herstart nodig omdat elke
// aanroep opnieuw leest (de mtime-cache in lib/state.js houdt dat goedkoop).
// De whitelist in saveInstellingen is de enige plek waar een nieuwe instelling moet worden
// aangemeld — onbekende sleutels worden genegeerd i.p.v. blind overgenomen.

const { readJSON, writeJSON } = require('./state.js');

// ── Instellingen (runtime, aanpasbaar via dashboard) ──────────────────────────
// Worden uit instellingen.json gelezen (met fallback op deze defaults) en door de relevante
// code-paden uitgelezen. NB: NIET op module-load aanroepen (readJSON heeft fileCache nodig).
const STANDAARD_INSTELLINGEN = {
  stemmingOverride: '',        // '' = automatisch (datum-seed); anders een mood-naam
  stilModus: false,            // bot reageert nergens op (behalve testkanaal)
  weekendRust: true,           // niet reageren in het weekend
  alleenTestkanaal: false,     // alleen in bruin-schaap reageren
  spaarstand: false,           // forceer lichte modellen (spaar Gemini/Cerebras)
  providerUit: [],             // model-namen die tijdelijk uit de keten zijn
  kortafKans: 0.35,            // kans op kortaf antwoord bij 1-woord-mention
  warrigKans: 0.10,            // kans op warrig formaat
  vrijdagAppendKans: 0.02,     // kans op vrijdag-countdown-append
  decreetVanDeDag: '',         // vrije tekst die in de system prompt wordt geïnjecteerd
  decreetIntensiteit: 0.5,     // hoe sterk het decreet doorgevoerd wordt (0 = vleugje, 1 = obsessie)
};

const loadInstellingen = () => ({ ...STANDAARD_INSTELLINGEN, ...readJSON('instellingen.json', {}) });

function instelling(key) { return loadInstellingen()[key]; }

// Slaat een (deel-)update van instellingen op, met validatie/typecoercie per sleutel.
function saveInstellingen(patch) {
  const nieuw = { ...loadInstellingen() };
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in STANDAARD_INSTELLINGEN)) continue; // onbekende sleutel negeren
    const def = STANDAARD_INSTELLINGEN[k];
    if (typeof def === 'boolean') nieuw[k] = !!v;
    else if (typeof def === 'number') { const n = Number(v); if (!isNaN(n)) nieuw[k] = Math.max(0, Math.min(1, n)); } // kansen 0–1
    else if (Array.isArray(def)) nieuw[k] = Array.isArray(v) ? v.filter(x => typeof x === 'string') : def;
    else nieuw[k] = String(v).slice(0, 2000); // strings (stemmingOverride, decreetVanDeDag)
  }
  writeJSON('instellingen.json', nieuw);
  _systemPromptCache = { key: null, value: null }; // decreet/stemming kan de system prompt raken
  return nieuw;
}

module.exports = {
  STANDAARD_INSTELLINGEN,
  loadInstellingen,
  instelling,
  saveInstellingen,
};
