// Rooktest: beelden via Cloudflare Workers AI, binnen het gratis dagbudget, en geen betaalde schakels.
// Run: `node scripts/rooktest/beeld-cloudflare.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { maakBeeldBytes } = h.index;
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const echteFetch = globalThis.fetch;
  let antwoord = () => ({ status: 200, json: { success: true, result: { image: PNG.toString('base64') } } });
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const a = antwoord(String(url));
    return { ok: a.status === 200, status: a.status, json: async () => a.json };
  };
  process.env.POLLINATIONS_UIT = '1';
  const budget = () => h.lees('beeldbudget.json');
  const vandaag = new Date().toISOString().slice(0, 10);
  try {
    // Zonder token: geen enkele Cloudflare-aanroep.
    delete process.env.CF_AI_TOKEN;
    let r = await maakBeeldBytes('a croquette knight');
    h.ok(!r.buffer && calls.length === 0, 'zonder CF_AI_TOKEN geen Cloudflare-aanroep');

    // Met token: FLUX.2 klein met de kroket-referentie, en 1450 Neurons geboekt.
    process.env.CF_AI_TOKEN = 'nep-token';
    h.schrijf('beeldbudget.json', {});
    r = await maakBeeldBytes('a croquette knight');
    const k = calls[0];
    h.ok(r.buffer?.equals(PNG) && r.mimeType === 'image/png', 'beeld uit Cloudflare, als png herkend');
    h.ok(/accounts\/acc\/ai\/run\/@cf\/black-forest-labs\/flux-2-klein-9b$/.test(k.url) && k.opts.headers.Authorization === 'Bearer nep-token', 'klein via het account en het token');
    h.ok(k.opts.body instanceof FormData && k.opts.body.get('input_image_0') && /croquette knight/.test(k.opts.body.get('prompt')), 'multipart met prompt en referentiebeeld');
    h.ok(budget().dag === vandaag && budget().neurons === 1450, `1450 Neurons geboekt (${budget().neurons})`);

    // klein over zijn plafond: dan schnell, met JSON.
    calls.length = 0;
    h.schrijf('beeldbudget.json', { dag: vandaag, neurons: 7000 });
    r = await maakBeeldBytes('a bitterbal on the moon');
    h.ok(calls.length === 1 && /flux-1-schnell$/.test(calls[0].url) && JSON.parse(calls[0].opts.body).steps === 4 && r.buffer, 'boven 7500 voor klein: schnell');
    h.ok(budget().neurons === 7060, `schnell boekt 60 (${budget().neurons})`);

    // Budget helemaal op: geen aanroep, en quota als reden.
    calls.length = 0;
    h.schrijf('beeldbudget.json', { dag: vandaag, neurons: 8990 });
    r = await maakBeeldBytes('a croquette knight');
    h.ok(calls.length === 0 && !r.buffer && r.quotaOp === true, 'budget op: geen aanroep, quotaOp');

    // Cloudflare zegt 429: de dag gaat dicht.
    calls.length = 0;
    h.schrijf('beeldbudget.json', {});
    antwoord = () => ({ status: 429, json: { success: false, errors: [{ code: 3036, message: 'Account limited' }] } });
    r = await maakBeeldBytes('a croquette knight');
    h.ok(calls.length === 1 && r.quotaOp === true && budget().neurons === 9000, 'na 429 geen schnell meer en de dag staat vol');

    // Andere fout bij klein: schnell probeert het nog.
    calls.length = 0;
    h.schrijf('beeldbudget.json', {});
    antwoord = (url) => (/klein/.test(url) ? { status: 500, json: { success: false } } : { status: 200, json: { success: true, result: { image: PNG.toString('base64') } } });
    r = await maakBeeldBytes('a croquette knight');
    h.ok(calls.length === 2 && r.buffer, 'klein 500, schnell lukt');

    // Gemini en HuggingFace staan standaard uit, ook met sleutels.
    process.env.GEMINI_API_KEY = 'nep-gemini'; process.env.HF_API_TOKEN = 'nep-hf';
    delete process.env.CF_AI_TOKEN;
    calls.length = 0;
    const regels = [];
    const [warn, log] = [console.warn, console.log];
    console.warn = console.log = (...a) => regels.push(a.join(' '));
    try { r = await maakBeeldBytes('a croquette knight'); } finally { [console.warn, console.log] = [warn, log]; }
    h.ok(calls.length === 0 && !r.buffer && !regels.some((t) => /Gemini|HuggingFace/.test(t)), `geen betaalde schakels zonder GEMINI_BEELD/HF_BEELD (${regels.length} logregels)`);
    // Tegenproef: met GEMINI_BEELD=1 probeert hij Gemini wel (en faalt hier zonder netwerk).
    process.env.GEMINI_BEELD = '1';
    regels.length = 0;
    console.warn = console.log = (...a) => regels.push(a.join(' '));
    try { await maakBeeldBytes('a croquette knight'); } finally { [console.warn, console.log] = [warn, log]; delete process.env.GEMINI_BEELD; }
    h.ok(regels.some((t) => /Gemini image/.test(t)), 'tegenproef: met GEMINI_BEELD=1 wel Gemini');
  } finally {
    globalThis.fetch = echteFetch;
  }
});
