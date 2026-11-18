// Dagbudget voor beelden via Cloudflare Workers AI, in Neurons. Gratis is 10.000 Neurons per dag
// (reset 00:00 UTC); elk beeld wordt vóór de aanroep geboekt tegen een plafond daaronder, zodat er
// nooit betaald wordt, ook niet als het account ooit op Workers Paid komt.
'use strict';

const PLAFOND = 9000;
const utcDag = (nu) => new Date(nu).toISOString().slice(0, 10);

function verbruikt(staat, nu) {
  return staat?.dag === utcDag(nu) ? Number(staat.neurons) || 0 : 0;
}

// Nieuwe staat met de kosten erbij, of null als dat boven het plafond uitkomt.
function reserveer(staat, kosten, nu, plafond = PLAFOND) {
  const na = verbruikt(staat, nu) + kosten;
  return na > Math.min(plafond, PLAFOND) ? null : { dag: utcDag(nu), neurons: na };
}

// Cloudflare zegt zelf dat het op is (429): de rest van de UTC-dag niets meer proberen.
const vol = (nu) => ({ dag: utcDag(nu), neurons: PLAFOND });

module.exports = { PLAFOND, verbruikt, reserveer, vol };
