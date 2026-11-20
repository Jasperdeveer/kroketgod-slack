// Rooktest: de regisseur en de weekvijand (extra aanvalsdag, bliksem en heling). Run: `node scripts/rooktest/regie-weekvijand.js`.
'use strict';
const harnas = require('./harnas.js');
const regie = require('../../lib/regie.js');
const { aanvalsLimiet } = require('../../lib/weekvijand.js');

const boek = (id) => regie.REGIEBOEK.find((i) => i.id === id);
const dagSleutel = (nu) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam' }).format(new Date(nu));
const WOENSDAG = Date.parse('2026-11-18T12:00:00Z');
const DINSDAG = Date.parse('2026-11-17T12:00:00Z');
const DONDERDAG = Date.parse('2026-11-19T12:00:00Z');

harnas(async (h) => {
  const { UITVOERDERS, voerIngreepUit, bouwRegieStand, voerBamischijfAanval } = h.index;
  const raid = () => h.lees('bamischijf.json');
  const zetRaid = (hp, extra = {}) => h.schrijf('bamischijf.json', { ...h.lees('bamischijf.json'), actief: hp > 0, hp, maxHp: 51, strijders: {}, extraAanval: undefined, deadlineTs: Date.now() + 2 * 86_400_000, ...extra }); // de seed heeft een vaste deadline (19 nov)
  const keuze = (id) => ({ ingreep: boek(id), doel: null, punten: 0, duurMinuten: 0, reden: 'test' });
  const alles = () => h.posts.map((p) => p.text).join('\n');

  // 1. Extra aanvalsdag: woensdag, vijand op 70%, 2 van de 6 leden vochten.
  zetRaid(36, { strijders: { UA: { schade: 3 }, UB: { schade: 3 } } });
  const stand = bouwRegieStand(WOENSDAG);
  h.ok(stand.raid.leden === 6 && stand.raid.strijders === 2, `stand: ${stand.raid.strijders} van ${stand.raid.leden} leden vochten`);
  const s = { ...stand, nu: WOENSDAG, weekdag: 3, minuutVanDag: 780 };
  h.ok(boek('extra_aanvalsdag').voorwaarde(s) === true, 'extra aanvalsdag is mogelijk op woensdag bij 70% en 2 van 6 strijders');
  await voerIngreepUit(h.client, keuze('extra_aanvalsdag'), stand, WOENSDAG);
  h.ok(raid().extraAanval === dagSleutel(WOENSDAG), `raid.extraAanval = ${raid().extraAanval}`);
  h.ok(aanvalsLimiet(raid(), dagSleutel(WOENSDAG)) === 2, 'de limiet van die dag is 2');
  h.ok(h.updates.length > 0, 'het raidbericht is bijgewerkt');
  // Echte klok: dezelfde ingreep voor vandaag, dan mag UA twee keer aanvallen (en een derde keer niet).
  zetRaid(36);
  await voerIngreepUit(h.client, keuze('extra_aanvalsdag'), stand, Date.now());
  const een = await voerBamischijfAanval(h.client, 'UA', false);
  const twee = await voerBamischijfAanval(h.client, 'UA', false);
  const drie = await voerBamischijfAanval(h.client, 'UA', false);
  h.ok(een.ok && twee.ok && !drie.ok, `twee aanvallen op een extra aanvalsdag, de derde niet (${een.ok}/${twee.ok}/${drie.ok})`);

  // 2. Bliksem: donderdag, de HP daalt met 15% van maxHP (8 van 51), niemand krijgt credit.
  zetRaid(40, { strijders: { UB: { schade: 3 } } });
  const scoresVoor = JSON.stringify(h.lees('scores.json'));
  const uit = await voerIngreepUit(h.client, keuze('bliksem'), stand, DONDERDAG);
  h.ok(raid().hp === 32 && raid().actief, `bliksem: hp ${raid().hp} (verwacht 32)`);
  h.ok(JSON.stringify(raid().strijders) === JSON.stringify({ UB: { schade: 3 } }), 'geen schade of credit voor een lid');
  h.ok(JSON.stringify(h.lees('scores.json')) === scoresVoor, 'bliksem verschuift geen punten');
  h.ok(h.updates.length > 1 && /bliksemschicht/i.test(alles()), 'raidbericht bijgewerkt en aangekondigd');
  h.ok(uit.feiten && /8 HP/.test(uit.feiten), `feiten noemen de schade: ${uit.feiten}`);

  // 3. Genadeslag: een schicht van 8 op een vijand met 5 HP geeft de overwinning.
  h.posts.length = 0;
  zetRaid(5, { strijders: { UA: { schade: 3 }, UB: { schade: 3 } } });
  await voerIngreepUit(h.client, keuze('bliksem'), stand, DONDERDAG);
  h.ok(raid().hp === 0 && raid().actief === false, `genadeslag: hp ${raid().hp}, actief ${raid().actief}`);
  h.ok(/VERSLAGEN/.test(alles()) && /Kroket God/.test(alles()), 'de overwinning staat in het kanaal');
  h.ok(!/genadeslag door \*een volgeling/.test(alles()), 'de genadeslag is niet van een lid');

  // 4. Heling: dinsdag, vijand onder 30%: +10% (5 van 51); donderdag juist een schicht.
  zetRaid(10, { strijders: { UA: { schade: 3 } } });
  await voerIngreepUit(h.client, keuze('bliksem'), stand, DINSDAG);
  h.ok(raid().hp === 15 && raid().actief, `heling op dinsdag: hp ${raid().hp} (verwacht 15)`);
  zetRaid(10);
  await voerIngreepUit(h.client, keuze('bliksem'), stand, DONDERDAG);
  h.ok(raid().hp === 2, `donderdag heelt niet: hp ${raid().hp} (verwacht 2)`);
  zetRaid(40);
  await voerIngreepUit(h.client, keuze('bliksem'), stand, DINSDAG);
  h.ok(raid().hp === 32, `dinsdag boven 30% is gewoon een schicht: hp ${raid().hp}`);
  h.ok(typeof UITVOERDERS.bliksem === 'function' && typeof UITVOERDERS.extra_aanvalsdag === 'function', 'beide uitvoerders staan in de tabel');
});
