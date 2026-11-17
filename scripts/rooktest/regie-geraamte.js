// Rooktest: het geraamte van de regisseur. Run: `node scripts/rooktest/regie-geraamte.js`.
'use strict';
const harnas = require('./harnas.js');

// Maandag 16 november 2026, 13:00 Amsterdam (12:00 UTC). Zaterdag 21 november, zelfde tijd.
const MAANDAG_13 = Date.parse('2026-11-16T12:00:00Z');
const ZATERDAG_13 = Date.parse('2026-11-21T12:00:00Z');

harnas(async (h) => {
  const { regieTik } = h.index;
  const bonus = () => { try { return Object.values(h.lees('casinobonus.json')).reduce((a, b) => a + b, 0); } catch { return 0; } };
  const log = () => { try { return h.lees('regie.json').log || []; } catch { return []; } };
  const audit = () => { try { return h.lees('auditlog.json').items.filter((i) => i.endpoint === 'regie'); } catch { return []; } };

  // 1. Stille modus en alleen-testkanaal blokkeren elke tik, ook een geforceerde.
  h.schrijf('instellingen.json', { stilModus: true });
  let keuze = await regieTik(h.client, { forceer: true, nu: MAANDAG_13 });
  h.ok(keuze === null && h.posts.length === 0 && bonus() === 0, 'stilModus: een geforceerde tik doet niets');

  // 2. Zaterdag zonder forceer: niets (weekendrust en buiten het venster).
  h.schrijf('instellingen.json', { stilModus: false });
  keuze = await regieTik(h.client, { nu: ZATERDAG_13 });
  h.ok(keuze === null && h.posts.length === 0 && bonus() === 0, 'zaterdag zonder forceer: niets');

  // 3. Geforceerde tik op maandag 13:00 met lege state: Het Huis geeft.
  keuze = await regieTik(h.client, { forceer: true, nu: MAANDAG_13 });
  h.ok(keuze?.ingreep.id === 'huis_geeft', `de gekozen ingreep is huis_geeft (${keuze?.ingreep.id})`);
  h.ok(h.posts.length === 1 && /3 extra casinospellen/.test(h.posts[0].text), `Het Huis geeft staat in het kanaal: ${h.posts[0]?.text}`);
  h.ok(bonus() === 3, `casinobonus.json staat op +3 (${bonus()})`);
  h.ok(log().length === 1 && log()[0].id === 'huis_geeft' && log()[0].laag === 'ingreep', 'regie.json heeft een logregel');
  h.ok(audit().length === 1, `het auditlog heeft een regel: ${audit()[0]?.samenvatting}`);

  // 4. Een tweede geforceerde tik telt de bonus erbij op (3 + 3), na de afkoeltijd van een dag.
  await regieTik(h.client, { forceer: true, nu: MAANDAG_13 + 25 * 3_600_000 });
  h.ok(bonus() === 6, 'een latere tik leest de bonus van vandaag en telt erbij op');

  // 5. Faalt de post, dan is het effect toch geboekt: een tweede tik stapelt de bonus niet.
  h.schrijf('casinobonus.json', {}); h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });
  h.schakel.faalPost = true;
  await regieTik(h.client, { forceer: true, nu: MAANDAG_13 });
  await regieTik(h.client, { forceer: true, nu: MAANDAG_13 + 60_000 });
  h.schakel.faalPost = false;
  h.ok(bonus() === 3 && log().length === 1, `mislukte post: bonus blijft +3 (${bonus()}) en regie.json heeft een logregel (${log().length})`);
});
