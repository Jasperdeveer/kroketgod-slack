// Rooktest: dagstanden (K1): feature, cron-label en het bestand na opstart.
// Run: `node scripts/rooktest/puntenhistorie.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { CRON_LABELS, geplandeCronMeta, dagSleutel } = h.index;
  h.ok(CRON_LABELS['55 23 * * *']?.label === 'Dagstand vastleggen', 'cron-label 55 23 * * * aanwezig');
  h.ok(geplandeCronMeta.some((m) => m.label === 'Dagstand vastleggen'), 'cron is ingepland');
  const staat = h.lees('puntenhistorie.json');
  const vandaag = staat.dagen?.[dagSleutel()];
  h.ok(vandaag && Object.keys(vandaag).length > 0, 'bestand na opstart gevuld met de stand van vandaag');
  const scores = h.lees('scores.json');
  h.ok(Object.keys(vandaag || {}).every((id) => vandaag[id] === (scores[id] || 0)), 'standen kloppen met scores.json');
});
