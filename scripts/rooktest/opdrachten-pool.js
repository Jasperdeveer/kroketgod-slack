// Rooktest: de opdrachtenpool groeit zonder dat de keuzes van nu verschuiven.
// Run: `node scripts/rooktest/opdrachten-pool.js`.
'use strict';
const harnas = require('./harnas.js');

// Vastgelegd voor de wijziging (kiesOpdrachten uit de oude pool van 16).
const OUD_WEEK = { '2026-11-16': ['w-duelwin', 'w-roof'] };
const OUD_DAG = { '2026-11-17': ['d-offer', 'd-raid', 'd-eer'] };
const OUDE_IDS = ['d-offer', 'd-eer', 'd-duel', 'd-raid', 'd-eer2', 'd-winkel', 'd-duelwin', 'd-bingo',
  'w-duelwin', 'w-offer', 'w-eer', 'w-raid', 'w-veiling', 'w-roof', 'w-goud', 'w-winkel'];

harnas(async (h) => {
  const { kiesOpdrachten, opdrachtHaalbaar, opdrachtTekst, opdrachtPool, alleOpdrachten } = h.index;
  const OPDRACHTEN = alleOpdrachten();
  const ids = (l) => l.map((o) => o.id);

  for (const [k, v] of Object.entries(OUD_WEEK)) h.ok(JSON.stringify(ids(kiesOpdrachten('week', k, 2))) === JSON.stringify(v), `weekkeuze ${k} blijft ${v}`);
  for (const [k, v] of Object.entries(OUD_DAG)) h.ok(JSON.stringify(ids(kiesOpdrachten('dag', k, 3))) === JSON.stringify(v), `dagkeuze ${k} blijft ${v}`);

  h.ok(JSON.stringify(OPDRACHTEN.slice(0, 16).map((o) => o.id)) === JSON.stringify(OUDE_IDS), 'de eerste 16 zijn de oude lijst in de oude volgorde');
  h.ok(OPDRACHTEN.length === 26, `26 opdrachten (${OPDRACHTEN.length})`);

  h.ok(opdrachtPool('dag', '2026-11-17').length === 8, 'dagpool op 17 nov nog 8');
  h.ok(opdrachtPool('dag', '2026-11-18').length === 10, 'dagpool vanaf 18 nov 10');
  h.ok(opdrachtPool('week', '2026-11-16').length === 8, 'weekpool op 16 nov nog 8');
  h.ok(opdrachtPool('week', '2026-11-23').length === 16, 'weekpool vanaf 23 nov 16');

  // {dreiging}
  const dSeizoen = OPDRACHTEN.find((o) => o.id === 'd-seizoen');
  h.schrijf('seizoen.json', { nummer: 1, status: 'actief', dreiging: { naam: 'De Grote Verkilling' }, hp: 10, maxHp: 10 });
  let t = opdrachtTekst(dSeizoen);
  h.ok(t.includes('de Grote Verkilling') && !t.includes('{'), `{dreiging} opgelost: ${t}`);
  h.schrijf('seizoen.json', { nummer: 1, status: 'geveld', dreiging: { naam: 'De Grote Verkilling' } });
  t = opdrachtTekst(dSeizoen);
  h.ok(t.includes('de dreiging van het seizoen') && !t.includes('{'), `zonder lopend seizoen: ${t}`);

  // seizoen_daad haalbaar alleen bij een actief seizoen
  h.ok(opdrachtHaalbaar('UA', dSeizoen) === false, 'seizoen_daad onhaalbaar zonder actief seizoen');
  h.schrijf('seizoen.json', { nummer: 1, status: 'actief', dreiging: { naam: 'X' } });
  h.ok(opdrachtHaalbaar('UA', dSeizoen) === true, 'seizoen_daad haalbaar met actief seizoen');

  // Dode zegenopdracht
  const dZegen = OPDRACHTEN.find((o) => o.id === 'd-zegen');
  const maandag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(
    (() => { const d = new Date(); const dag = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - dag * 86400000); })());
  const regieLeeg = { schatkist: 0, effecten: [], log: [], verrassing: null };
  h.schrijf('regie.json', regieLeeg);
  h.schrijf('profeet.json', { userId: 'UA', weekStart: maandag });
  h.ok(opdrachtHaalbaar('UB', dZegen) === true, 'ongebruikte zegen: haalbaar voor UB');
  h.ok(opdrachtHaalbaar('UA', dZegen) === false, 'de profeet zelf kan zich niet laten zegenen');
  h.schrijf('profeet.json', { userId: 'UA', weekStart: maandag, zegenGebruikt: true });
  h.ok(opdrachtHaalbaar('UB', dZegen) === false, 'zegen gebruikt: onhaalbaar');
  h.schrijf('regie.json', { ...regieLeeg, effecten: [{ id: 'z1', soort: 'zegendag', tot: Date.now() + 3600000 }] });
  h.ok(opdrachtHaalbaar('UB', dZegen) === true, 'zegendag actief: weer haalbaar');
});
