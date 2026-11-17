// Rooktest-harnas: de echte index.js met een nep-Slack, een nep-R2 en een eigen tijdelijke statemap.
// Gebruik, in een eigen script (zie regie-geraamte.js en README.md):
//   require('./harnas.js')(async (h) => { ... h.ok(voorwaarde, 'omschrijving'); });
// Het harnas start de bot, wacht tot de opstart klaar is, draait jouw functie en sluit af met exitcode
// 0 als elke `ok` slaagde, anders 1.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = async function harnas(test, { opstartMs = 2500 } = {}) {
  const repo = path.join(__dirname, '..', '..');
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'rooktest-state-'));
  const uitmap = fs.mkdtempSync(path.join(os.tmpdir(), 'rooktest-uit-'));
  process.on('exit', () => { for (const d of [state, uitmap]) fs.rmSync(d, { recursive: true, force: true }); });
  const seed = path.join(__dirname, 'seed-state');
  for (const f of fs.readdirSync(seed)) fs.copyFileSync(path.join(seed, f), path.join(state, f));

  Object.assign(process.env, {
    KROKET_STATE_DIR: state, KROKET_ROOKTEST: '1', SLACK_BOT_TOKEN: 'xoxb-nep', SLACK_APP_TOKEN: 'xapp-nep', SLACK_SIGNING_SECRET: 'nep',
    KROKET_ARCHIEF_PAD: path.join(state, 'grootarchief.ndjson'), SLACK_CHANNEL_ID: 'CKANAAL', KROKET_EMOJI_VERTRAGING_MS: '0',
    GROQ_BASE_URL: 'http://127.0.0.1:9', // groq-sdk leest dit: verbinding geweigerd, geen netwerk
    GEMINI_API_KEY: '', GEMINI_API_KEYS: '', GROQ_API_KEY: 'gsk-nep-ongeldig', OPENROUTER_API_KEY: '', CEREBRAS_API_KEY: '',
    SAMBANOVA_API_KEY: '', HF_API_TOKEN: '', IMGBB_API_KEY: '', CLOUDFLARE_API_TOKEN: '', DASHBOARD_TOKEN: 'nep',
    R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'id', R2_SECRET_ACCESS_KEY: 'geheim', R2_BUCKET: 'emmer', R2_PUBLIC_URL: 'https://beeld.voorbeeld.nl',
  });

  // Nep-R2: elke PUT naar *.r2.cloudflarestorage.com lukt, en het bestand komt in de uitmap. De rest faalt.
  const r2 = [];
  const fetchPad = require.resolve('node-fetch', { paths: [repo] });
  const nepFetch = async (url, opts = {}) => {
    if (/r2\.cloudflarestorage\.com/.test(String(url)) && opts.method === 'PUT') {
      r2.push({ url: String(url), bytes: opts.body.length });
      fs.writeFileSync(path.join(uitmap, `r2-${r2.length}.gif`), opts.body);
      return { ok: true, status: 200, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
    }
    throw new Error('geen netwerk in de rooktest');
  };
  require.cache[fetchPad] = { id: fetchPad, filename: fetchPad, loaded: true, exports: Object.assign(nepFetch, { default: nepFetch }) };

  const posts = [];
  const updates = [];
  const ephemeral = []; // chat.postEphemeral: { user, text }
  const views = []; // client.views.* aanroepen: { fn, args }
  const handlers = { action: [], command: {}, event: {} };
  let tsTeller = 1000;
  const schakel = { faalPost: false, reacties: [] }; // reacties: [{ name, users }] voor reactions.get
  // true: chat.postMessage gooit (een mislukte Slack-post)
  const client = new Proxy({}, { get: (_, ns) => new Proxy({}, { get: (_, fn) => async (args = {}) => {
    if (ns === 'chat' && fn === 'postMessage' && schakel.faalPost) throw new Error('nep-429: post mislukt');
    if (ns === 'chat' && fn === 'postMessage') posts.push({ text: args.text, blocks: args.blocks, thread: args.thread_ts || null, ts: String(++tsTeller) });
    if (ns === 'chat' && fn === 'update') updates.push(args);
    if (ns === 'chat' && fn === 'postEphemeral') ephemeral.push({ user: args.user, text: args.text });
    if (ns === 'views') views.push({ fn, args });
    if (ns === 'reactions' && fn === 'get') return { ok: true, message: { reactions: schakel.reacties || [] } };
    return { ok: true, ts: String(tsTeller), channel: 'CKANAAL', user_id: 'UBOT', view: { id: 'V1' }, members: ['UA', 'UB', 'UC', 'UD', 'UE', 'UF'], channels: [], user: { profile: {} }, response_metadata: {} };
  } }) });
  class App {
    constructor() { this.client = client; }
    action(id, fn) { handlers.action.push([id, fn]); }
    command(naam, fn) { handlers.command[naam] = fn; }
    event(naam, fn) { (handlers.event[naam] ||= []).push(fn); }
    view() {} shortcut() {} options() {} message() {} use() {} error() {}
    async start() {} async stop() {}
  }
  const boltPad = require.resolve('@slack/bolt', { paths: [repo] });
  require.cache[boltPad] = { id: boltPad, filename: boltPad, loaded: true, exports: { App, LogLevel: {} } };

  const lees = (f) => JSON.parse(fs.readFileSync(path.join(state, f), 'utf8'));
  const schrijf = (f, d) => fs.writeFileSync(path.join(state, f), JSON.stringify(d));
  const actie = (id) => handlers.action.find(([k]) => (k instanceof RegExp ? k.test(id) : k === id))[1];
  const body = (user, extra = {}) => ({ user: { id: user }, channel: { id: 'CKANAAL' }, container: { type: 'message' }, actions: [{}], ...extra });
  const klik = (id, user, extra = {}, bodyExtra = {}) => actie(id)({ ack: async () => {}, body: body(user, bodyExtra), action: { action_id: id, ...extra }, client });
  // Draait `/kroketgod <tekst>` als dit lid en geeft het antwoord terug (een commando werkt alleen in kroket-illuminati).
  async function commando(user, text) {
    let antwoord = '';
    await handlers.command['/kroketgod']({ command: { user_id: user, text, channel_id: 'CKANAAL', channel_name: 'kroket-illuminati', trigger_id: 't' },
      ack: async () => {}, respond: async (r) => { antwoord += (typeof r === 'string' ? r : r.text) + '\n'; }, client });
    return antwoord;
  }
  // Draait elke handler die met `app.event(naam, fn)` is geregistreerd, met { event, client, ack } (gebeurtenis('message', { user, text, channel, ts })).
  const gebeurtenis = async (naam, event) => { for (const fn of handlers.event[naam] || []) await fn({ event, client, ack: async () => {} }); };
  const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
  const ok = (cond, wat) => { console.log(`${cond ? '✔' : '✖'} ${wat}`); if (!cond) process.exitCode = 1; };

  // index.js exporteert alleen onder KROKET_ROOKTEST (zie het eind van het regie-blok).
  const index = require(path.join(repo, 'index.js'));
  await wacht(opstartMs);
  try {
    await test({ klik, commando, lees, schrijf, posts, updates, ephemeral, views, ok, wacht, client, index, state, uitmap, r2, handlers, schakel, gebeurtenis });
  } catch (err) { console.error('FOUT', err); process.exitCode = 1; }
  process.exit();
};
