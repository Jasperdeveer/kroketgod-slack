// Tests voor de tijdzone van het proces. jsprsuperserver staat op Europe/Amsterdam, en dan raakt node-cron van
// de wijs bij de zomertijdwissels: in het herhaalde uur van eind oktober berekent hij een volgende
// uitvoering die een uur in het verleden ligt (elke minuut-cron vuurt dan twee uur lang in een strakke
// lus), en eind maart slaat hij twee uur over. index.js zet daarom als allereerste `process.env.TZ`
// op UTC. Deze tests bewijzen dat dat werkt, mét de tijdzone van de server als uitgangspunt.
// Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MATCHER = path.join(path.dirname(require.resolve('node-cron')), 'time', 'time-matcher.js');

// Draait in een eigen proces dat start met TZ=Europe/Amsterdam (zoals jsprsuperserver) en rekent per halve
// minuut de wachttijd tot de volgende uitvoering van '* * * * *', vier uur lang vanaf `vanaf`.
// `metUtc` doet wat index.js als eerste regel doet.
function wachttijdenRondWissel(vanaf, metUtc) {
  const code = `
    ${metUtc ? "process.env.TZ = 'UTC';" : ''}
    const { TimeMatcher } = require(${JSON.stringify(MATCHER)});
    const m = new TimeMatcher('* * * * *', 'Europe/Amsterdam');
    const start = Date.parse(${JSON.stringify(vanaf)});
    let teVroeg = 0, teLaat = 0;
    for (let t = start; t < start + 4 * 3600000; t += 30000) {
      const nu = new Date(t);
      const wacht = m.getNextMatch(nu).getTime() - t;
      if (wacht <= 0) teVroeg++;
      if (wacht > 61000) teLaat++;
    }
    process.stdout.write(JSON.stringify({ teVroeg, teLaat }));
  `;
  const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: 'Europe/Amsterdam' }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const NAJAAR = '2026-10-24T23:30:00Z';   // zo 25 okt 2026, rond 03:00 → 02:00
const VOORJAAR = '2027-03-28T00:00:00Z'; // zo 28 mrt 2027, rond 02:00 → 03:00

test('controle: zonder UTC rekent node-cron op een Amsterdamse host verkeerd rond de wissels', () => {
  // Bewijst dat de test hieronder iets toetst. Gaat deze ooit falen, dan heeft node-cron het zelf
  // opgelost — de regel in index.js kan blijven staan, hij is onder UTC hoe dan ook juist.
  assert.ok(wachttijdenRondWissel(NAJAAR, false).teVroeg > 0, 'najaar: geen lus gezien');
  assert.ok(wachttijdenRondWissel(VOORJAAR, false).teLaat > 0, 'voorjaar: geen gat gezien');
});

test('met TZ=UTC vuurt een minuut-cron ook rond de wissels precies elke minuut', () => {
  assert.deepEqual(wachttijdenRondWissel(NAJAAR, true), { teVroeg: 0, teLaat: 0 });
  assert.deepEqual(wachttijdenRondWissel(VOORJAAR, true), { teVroeg: 0, teLaat: 0 });
});

test('index.js zet de tijdzone vóór alle andere code', () => {
  const regels = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8').split('\n');
  const eersteCode = regels.find(r => r.trim() && !r.trim().startsWith('//'));
  assert.equal(eersteCode.trim(), "process.env.TZ = 'UTC';");
});
