// ── De Tijdcapsule: het ontleden van "wanneer" ─────────────────────────────────
// Een lid verzegelt een voorspelling met een moment erbij: "over twee weken", "vrijdag",
// "31 december". Deze module zet die menselijke aanduiding om in een tijdstip en geeft de rest van
// de invoer terug als de voorspelling zelf. Pure functies, geen state, geen Slack.
//
// WAAROM DIT EEN EIGEN MODULE IS. Datumontleding is precies het soort code dat stil kapot gaat op
// een schrikkeljaar, een maandgrens of een zomertijdwissel, en dat je nooit merkt omdat de uitkomst
// "een datum" is en dus altijd plausibel lijkt. Hier staat het los en volledig getest.
//
// ALLES IN AMSTERDAMSE TIJD, en een deadline valt altijd op het EINDE van de genoemde dag
// (23:59 lokaal). "Vrijdag" betekent voor een mens "ergens vrijdag", niet "vrijdag 00:00" — bij die
// laatste lezing zou een capsule opengaan voordat de dag begonnen was.

// Ruim genoeg voor een grap over volgend jaar, krap genoeg dat een typefout ("over 900 weken")
// geweigerd wordt in plaats van een capsule voor het jaar 2043 op te leveren.
const MAX_HORIZON_DAGEN = 400;
// Een voorspelling moet érgens over gaan: minder dan een uur vooruit is geen voorspelling.
const MIN_HORIZON_MS = 3_600_000;

const WEEKDAGEN = {
  maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6, zondag: 0,
};

const MAANDEN = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
};

const WOORDGETALLEN = { een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6 };

// Tijdseenheden EXPLICIET uitgeschreven, enkelvoud én meervoud. Bewust geen prefix-check
// (`startsWith('week')`): het Nederlandse meervoud van "week" is "weken" — de e verhuist, dus
// "weken" begint niet met "week". Zo'n stille misser levert geen foutmelding op maar een verkeerde
// datum, en dat merk je pas weken later. Vandaar een tabel in plaats van slimmigheid.
const EENHEID_DAGEN = { dag: 1, dagen: 1, week: 7, weken: 7 };
// Maanden kunnen niet in dagen: hun lengte verschilt. Die gaan via maandenErbij.
const EENHEID_MAANDEN = new Set(['maand', 'maanden']);

// Onderdelen van een tijdstip in Amsterdamse tijd.
function amsDelen(datum) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const o = {};
  for (const p of dtf.formatToParts(new Date(datum))) o[p.type] = p.value;
  const dagMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    jaar: +o.year, maand: +o.month, dag: +o.day,
    uur: +(o.hour === '24' ? '0' : o.hour), minuut: +o.minute,
    weekdag: dagMap[o.weekday],
  };
}

// Zet een Amsterdamse wandklok om naar een echt tijdstip (epoch ms), zomertijd-proof: gok eerst
// alsof de wandklok UTC was en corrigeer met de offset die op dat gokmoment in Amsterdam geldt.
function amsNaarEpoch(jaar, maand, dag, uur = 23, minuut = 59) {
  const gok = Date.UTC(jaar, maand - 1, dag, uur, minuut);
  const d = amsDelen(gok);
  const offset = Date.UTC(d.jaar, d.maand - 1, d.dag, d.uur, d.minuut) - gok;
  return gok - offset;
}

// Einde van de genoemde dag, in Amsterdamse tijd.
function eindeVanDag(jaar, maand, dag) {
  return amsNaarEpoch(jaar, maand, dag, 23, 59);
}

// Telt dagen op bij de Amsterdamse datum van `nu` en geeft het einde van die dag terug. Via
// Date.UTC, zodat maand- en jaargrenzen en schrikkeljaren automatisch goed gaan.
function dagenErbij(nu, aantal) {
  const d = amsDelen(nu);
  const basis = new Date(Date.UTC(d.jaar, d.maand - 1, d.dag));
  basis.setUTCDate(basis.getUTCDate() + aantal);
  return eindeVanDag(basis.getUTCFullYear(), basis.getUTCMonth() + 1, basis.getUTCDate());
}

function maandenErbij(nu, aantal) {
  const d = amsDelen(nu);
  const basis = new Date(Date.UTC(d.jaar, d.maand - 1, d.dag));
  // setUTCMonth klapt een te hoge dag netjes door (31 januari + 1 maand = 3 maart in een
  // niet-schrikkeljaar). Voor een snackvoorspelling ruim goed genoeg, en het levert nooit een
  // ongeldige datum op.
  basis.setUTCMonth(basis.getUTCMonth() + aantal);
  return eindeVanDag(basis.getUTCFullYear(), basis.getUTCMonth() + 1, basis.getUTCDate());
}

// De eerstvolgende genoemde weekdag. Vandaag telt NIET mee: wie op vrijdag "vrijdag" zegt, bedoelt
// volgende week vrijdag — anders ging de capsule vandaag al open.
function volgendeWeekdag(nu, doelDag) {
  const d = amsDelen(nu);
  let stappen = (doelDag - d.weekdag + 7) % 7;
  if (stappen === 0) stappen = 7;
  return dagenErbij(nu, stappen);
}

// Ontleedt het "wanneer" aan het begin van de invoer.
// Geeft { deadline, label, rest } terug, of { fout } met een uitlegbare reden.
function parseerWanneer(invoer, nu = Date.now()) {
  const schoon = String(invoer || '').trim().replace(/\s+/g, ' ');
  if (!schoon) return { fout: 'Geen voorspelling opgegeven.' };
  const laag = schoon.toLowerCase();

  const klaar = (deadline, label, restVanaf) => {
    const rest = schoon.slice(restVanaf).replace(/^[\s:,–—-]+/, '').trim();
    if (!rest) return { fout: 'U noemde een moment, maar geen voorspelling.' };
    if (deadline - nu < MIN_HORIZON_MS) return { fout: 'Dat moment is al (bijna) voorbij — kies iets in de toekomst.' };
    if (deadline - nu > MAX_HORIZON_DAGEN * 86_400_000) {
      return { fout: `Zo ver vooruit kijkt zelfs de Kroket God niet (hoogstens ${MAX_HORIZON_DAGEN} dagen).` };
    }
    return { deadline, label, rest };
  };

  // "over 3 dagen" / "over twee weken" / "over een maand"
  const over = laag.match(/^over\s+(\d+|een|één|twee|drie|vier|vijf|zes)\s+(dagen|dag|weken|week|maanden|maand)\b/);
  if (over) {
    const n = /^\d+$/.test(over[1]) ? parseInt(over[1], 10) : WOORDGETALLEN[over[1]];
    if (!n || n < 1) return { fout: 'Een termijn van nul is geen termijn.' };
    const eenheid = over[2];
    const deadline = EENHEID_MAANDEN.has(eenheid)
      ? maandenErbij(nu, n)
      : dagenErbij(nu, n * EENHEID_DAGEN[eenheid]);
    return klaar(deadline, `over ${n} ${eenheid}`, over[0].length);
  }

  if (laag.startsWith('overmorgen')) return klaar(dagenErbij(nu, 2), 'overmorgen', 'overmorgen'.length);
  if (laag.startsWith('morgen')) return klaar(dagenErbij(nu, 1), 'morgen', 'morgen'.length);
  if (laag.startsWith('volgende week')) return klaar(dagenErbij(nu, 7), 'volgende week', 'volgende week'.length);
  if (laag.startsWith('volgende maand')) return klaar(maandenErbij(nu, 1), 'volgende maand', 'volgende maand'.length);

  // Weekdagnaam
  for (const [naam, nr] of Object.entries(WEEKDAGEN)) {
    if (laag.startsWith(naam)) return klaar(volgendeWeekdag(nu, nr), naam, naam.length);
  }

  // "31 december", met optioneel jaartal
  const dagMaand = laag.match(/^(\d{1,2})\s+([a-zéë]+)(\s+(\d{4}))?\b/);
  if (dagMaand && MAANDEN[dagMaand[2]]) {
    const dag = parseInt(dagMaand[1], 10);
    const maand = MAANDEN[dagMaand[2]];
    if (dag < 1 || dag > 31) return { fout: `"${dag}" is geen dag van de maand.` };
    const jaar = dagMaand[4] ? parseInt(dagMaand[4], 10) : amsDelen(nu).jaar;
    let deadline = eindeVanDag(jaar, maand, dag);
    // Zonder jaartal: dit jaar, tenzij die datum al voorbij is — dan volgend jaar.
    if (!dagMaand[4] && deadline < nu) deadline = eindeVanDag(jaar + 1, maand, dag);
    return klaar(deadline, `${dag} ${dagMaand[2]}`, dagMaand[0].length);
  }

  // "31-12", "31-12-2026", "31/12"
  const cijfers = laag.match(/^(\d{1,2})[-/](\d{1,2})([-/](\d{4}))?\b/);
  if (cijfers) {
    const dag = parseInt(cijfers[1], 10);
    const maand = parseInt(cijfers[2], 10);
    if (dag < 1 || dag > 31 || maand < 1 || maand > 12) return { fout: 'Dat is geen bestaande datum.' };
    const jaar = cijfers[4] ? parseInt(cijfers[4], 10) : amsDelen(nu).jaar;
    let deadline = eindeVanDag(jaar, maand, dag);
    if (!cijfers[4] && deadline < nu) deadline = eindeVanDag(jaar + 1, maand, dag);
    return klaar(deadline, `${dag}-${maand}`, cijfers[0].length);
  }

  return { fout: 'Ik kon er geen moment in lezen. Probeer "over 2 weken", "vrijdag", "31 december" of "31-12".' };
}

module.exports = {
  MAX_HORIZON_DAGEN,
  MIN_HORIZON_MS,
  WEEKDAGEN,
  MAANDEN,
  amsDelen,
  amsNaarEpoch,
  eindeVanDag,
  dagenErbij,
  maandenErbij,
  volgendeWeekdag,
  parseerWanneer,
};
