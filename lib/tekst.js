// ── Tekstbewerking op LLM-uitvoer ──────────────────────────────────────────────
// Pure functies zonder projectstate: afgekapte zinnen netjes afsluiten, hoofdletterspam
// herkennen en de ondertekening van de Kroket God normaliseren.

// Detecteert of een tekst grotendeels in hoofdletters is (zoals 8B-model output)
function isHoofdletterSpam(tekst) {
  if (!tekst || tekst.length < 30) return false;
  const letters = tekst.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 20) return false;
  const hoofdletters = letters.replace(/[^A-Z]/g, '').length;
  return (hoofdletters / letters.length) > 0.65; // meer dan 65% hoofdletters = fout
}

// Zet zinnen die (bijna) helemaal in hoofdletters staan om naar een gewone zin. Voor de
// karakterbeschrijving van een persona, vóórdat die naar het model gaat.
//
// Waarom: Benito M. heeft vijftien voorbeeldzinnen in hoofdletters ("IK HOOR WAT JE ZEGT, MAAR…"),
// en het model deed die stijl na — hele berichten in hoofdletters. Daarin maakt een taalmodel veel
// meer spelfouten, omdat woorden in hoofdletters in vreemde stukjes uiteenvallen: "HET LACKT EEN
// HETZOE VAAN ECHTE OWNERSHIP". Op de Pi gemeten (23 oktober 2026): met de originele tekst stonden
// 5 van de 6 antwoorden volledig in hoofdletters, met omgezette voorbeelden 0 van de 8, en die
// waren foutloos en nog steeds herkenbaar Benito.
//
// Alleen zinnen van minstens vier woorden met meer dan 70% hoofdletters: een afkorting ("CEO"), een
// kopje ("TONE OF VOICE") of korte nadruk ("Een TOTAL DISASTER") blijft staan. Losse woorden in
// hoofdletters horen bij sommige karakters, en daarin ontstaan geen gekke fouten — in lange
// passages wel.
function isHoofdletterZin(zin) {
  const kaal = zin.replace(/^[\s\-•*>"“”#/]+|[\s"“”]+$/g, '');
  if (kaal.split(/\s+/).filter(w => /[A-Za-zÀ-ÿ]/.test(w)).length < 4) return false;
  const letters = kaal.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const hoog = kaal.replace(/[^A-ZÀ-Þ]/g, '').length;
  return letters.length >= 8 && hoog / letters.length > 0.7;
}

function ontschreeuw(tekst) {
  return String(tekst ?? '').split(/(?<=[.!?…"\n])/).map(zin =>
    isHoofdletterZin(zin) ? zin.toLowerCase().replace(/[a-zà-ÿ]/, c => c.toUpperCase()) : zin,
  ).join('');
}

// Schreeuwt deze persona? Ja als zijn karaktertekst minstens twee echte UITROEPEN in hoofdletters
// bevat: zinnen die eindigen op . ! ? of … ("DIT BEDRIJF BESTAAT AL 10 JAAR!"). Kopjes als
// "## KERNREGELS" of "TONE OF VOICE" eindigen daar niet op en tellen niet mee — anders gold op
// 23 oktober 2026 bijna elke persona als schreeuwer. Gemeten op de Pi: Benito M. (29), De Smeuïge
// Pindakaas, :bread: en Tung Tung Tung Sahur schreeuwen; de rest heeft alleen kopjes.
function isSchreeuwer(tekst) {
  const zinnen = String(tekst ?? '').split(/\n|(?<=[.!?…])\s+/)
    .map(z => z.replace(/[\s"“”]+$/g, ''))
    .filter(z => /[.!?…]$/.test(z) && isHoofdletterZin(z));
  return zinnen.length >= 2;
}

// Bekende afkortingen die op een punt eindigen — een punt hierachter is GEEN zinseinde. Zonder
// deze lijst zou een afgekapte "…uw bondgenoot Mr." als "afgeronde zin" gelden en bleef de halve
// zin staan (precies de bug die we zagen).
const AFKORTING_VOOR_PUNT = /(?:^|[\s(«"'([])(bijv|bv|nr|dhr|mevr|mej|mr|mrs|ms|dr|drs|ir|mw|prof|ing|enz|etc|blz|pag|vgl|zgn|ca|resp|incl|excl|max|min|tel|o\.a|t\.o\.v|a\.u\.b|z\.o\.z|i\.p\.v|d\.w\.z|m\.a\.w|e\.d|n\.a\.v|i\.v\.m|d\.d)\.?$/i;

// Het begin van de tekst en elke zin na . ! ? … met een hoofdletter — behalve na een afkorting
// ("bijv. de kroket"). Het model schrijft bij een uitroep soms de rest in kleine letters door.
function zinnenMetHoofdletter(tekst) {
  const s = String(tekst ?? '').replace(/^([\s>"'«(*_–—-]*)([a-zà-ÿ])/, (_, voor, c) => voor + c.toUpperCase());
  return s.replace(/([.!?…])(\s+)([("'«]?)([a-zà-ÿ])/g, (m, p, ws, q, c, offset, hele) => {
    if (p === '.' && AFKORTING_VOOR_PUNT.test(hele.slice(0, offset + 1))) return m;
    return p + ws + q + c.toUpperCase();
  });
}

// Zet de uitroepen die een persona tussen *sterretjes* schreef om in HOOFDLETTERS, vlak vóór het
// plaatsen. Een persona die schreeuwt (Benito M.) laat het model in gewone letters schrijven en de
// schreeuw markeren: in hoofdletters bedacht, maakt een taalmodel gekke spelfouten (zie ontschreeuw),
// in gewone letters bedacht en daarna omgezet niet. Ook **dubbele** sterretjes tellen.
function roepUit(tekst) {
  const geroepen = String(tekst ?? '').replace(/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g,
    (_, dubbel, enkel) => (dubbel ?? enkel).toLocaleUpperCase('nl-NL'));
  return zinnenMetHoofdletter(geroepen);
}

// Kapt een (door de tokenlimiet) afgebroken respons netjes af op de laatste volledige zin, zodat de
// Kroket God nooit een halve zin de wereld in stuurt. In plaats van blind op het laatste leesteken
// te knippen (dan blijft een afgekapte "…Mr." staan), zoekt hij ECHTE zinsgrenzen: een . ! ? …
// gevolgd door witruimte, en niet direct achter een afkorting. Eindigt de tekst zelf al op een echt
// zinseinde, dan blijft hij ongemoeid. Vindt hij geen bruikbare grens (heel korte respons), dan laat
// hij de tekst staan — liever een korte gedachte dan niets.
function kapAfOpZinsgrens(tekst) {
  if (!tekst || typeof tekst !== 'string') return tekst;
  const s = tekst.trimEnd();
  if (s.length < 15) return s;
  // Verzamel alle ÉCHTE zinsgrenzen: leesteken(s) + optionele sluit-aanhaling, gevolgd door
  // witruimte, waarbij het leesteken niet direct op een afkorting volgt.
  const grenzen = [];
  const re = /[.!?…]+["'”’)\]]?(?=\s)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (AFKORTING_VOOR_PUNT.test(s.slice(0, m.index))) continue; // afkorting → geen zinsgrens
    grenzen.push(m.index + m[0].length);
  }
  // Eindigt de tekst zelf al op een echt zinseinde (leesteken, geen afkorting)? Dan niets afgekapt.
  // Strip ook afsluitende markdown-tekens (*_~`) — "…gesproken._" is een compleet einde.
  const kern = s.replace(/["'”’)\]*_~`]+$/, '');
  if (/[.!?…]$/.test(kern) && !AFKORTING_VOOR_PUNT.test(kern.slice(0, -1))) return s;
  // Anders: terugknippen tot de laatste volledige zin.
  if (grenzen.length) {
    const geknipt = s.slice(0, grenzen[grenzen.length - 1]).trimEnd();
    if (geknipt.length >= 15) return geknipt;
  }
  return s; // geen bruikbare grens → liever de (afgekapte) tekst dan een leeg bericht
}

// ── Lange tekst over meerdere Slack-blokken ────────────────────────────────────
// Een `section`-blok houdt maximaal 3000 tekens. postToChannel kapte daarom hard af op
// substring(0, 2999) terwijl het `text`-veld de volledige tekst hield: een lang bericht
// verloor zijn staart middenin een woord, zonder enige markering, en juist de ondertekening
// van de Kroket God staat aan het eind. Slack staat tientallen blokken per bericht toe, dus
// afkappen was nooit nodig — splitsen is dat wel.
//
// Splitst zo netjes als de tekst toelaat: eerst op alinea's, dan op zinsgrenzen, en pas als
// een enkele zin zelf te lang is op woordgrens. Alleen bij een woord dat op zichzelf langer
// is dan het maximum valt er hard geknipt te worden.
const BLOK_MAX = 2900; // marge onder Slack's 3000 voor onvoorziene opmaak

function splitsVoorBlokken(tekst, max = BLOK_MAX) {
  if (!tekst || typeof tekst !== 'string') return [];
  const heel = tekst.trim();
  if (!heel) return [];
  if (heel.length <= max) return [heel];

  // Stap 1: alinea's als grofste eenheid; die horen visueel toch al bij elkaar.
  const stukken = [];
  let huidig = '';
  const voegToe = (deel, scheiding) => {
    const kandidaat = huidig ? huidig + scheiding + deel : deel;
    if (kandidaat.length <= max) { huidig = kandidaat; return; }
    if (huidig) { stukken.push(huidig); huidig = ''; }
    if (deel.length <= max) { huidig = deel; return; }
    // Te lang als geheel → fijner splitsen en die delen opnieuw aanbieden.
    for (const fijner of splitsFijner(deel, max)) {
      if (huidig && (huidig + '\n' + fijner).length <= max) huidig += '\n' + fijner;
      else { if (huidig) stukken.push(huidig); huidig = fijner; }
    }
  };
  for (const alinea of heel.split(/\n{2,}/)) {
    const a = alinea.trim();
    if (a) voegToe(a, '\n\n');
  }
  if (huidig) stukken.push(huidig);
  return stukken.filter(Boolean);
}

// Splitst één te lang stuk: op regels, dan zinnen, dan woorden, dan hard.
function splitsFijner(deel, max) {
  const uit = [];
  let buffer = '';
  const duw = (eenheid, scheiding) => {
    const kandidaat = buffer ? buffer + scheiding + eenheid : eenheid;
    if (kandidaat.length <= max) { buffer = kandidaat; return; }
    if (buffer) { uit.push(buffer); buffer = ''; }
    if (eenheid.length <= max) { buffer = eenheid; return; }
    // Laatste redmiddel: hard knippen op max, want één woord kan het maximum overschrijden.
    for (let i = 0; i < eenheid.length; i += max) uit.push(eenheid.slice(i, i + max));
  };

  const regels = deel.split('\n');
  if (regels.length > 1) {
    for (const regel of regels) duw(regel, '\n');
    if (buffer) uit.push(buffer);
    return uit;
  }
  // Eén lange regel: op zinsgrens knippen met dezelfde afkorting-uitzondering als kapAfOpZinsgrens.
  const zinnen = [];
  const re = /[.!?…]+["\'”’)\]]?(?=\s|$)/g;
  let laatst = 0, m;
  while ((m = re.exec(deel)) !== null) {
    const eind = m.index + m[0].length;
    if (AFKORTING_VOOR_PUNT.test(deel.slice(0, m.index))) continue;
    zinnen.push(deel.slice(laatst, eind).trim());
    laatst = eind;
  }
  if (laatst < deel.length) zinnen.push(deel.slice(laatst).trim());
  if (zinnen.filter(Boolean).length > 1) {
    for (const zin of zinnen) if (zin) duw(zin, ' ');
    if (buffer) uit.push(buffer);
    return uit;
  }
  // Eén onafgebroken zin: op woordgrens.
  for (const woord of deel.split(/\s+/)) if (woord) duw(woord, ' ');
  if (buffer) uit.push(buffer);
  return uit;
}

// Normaliseer ondertekening — de Kroket God ondertekent ALTIJD als "De Almachtige Kroket God"
function normaliseerOndertekening(tekst) {
  if (!tekst) return tekst;
  // Vang elke variatie van "— [evt. de] [evt. bijvoeglijke naamwoorden] Kroket God", maar
  // ALLEEN als handtekening: verankerd op het einde van een regel ($ met m-flag). Zonder anker
  // herschreef dit ook lopende tekst ("— de tempel van de Kroket God staat centraal") en de
  // vaste EER-footer ("— _De Kroket God heeft gesproken_ …").
  return tekst.replace(
    /([—–-])\s*(?:de\s+)?(?:\w+\s+){0,4}kroket\s*god\b\.?\s*$/gim,
    '$1 De Almachtige Kroket God'
  );
}

// ── Modeluitvoer als keuze lezen ──────────────────────────────────────────────
// Een classifier krijgt de opdracht één woord te antwoorden, maar levert in de praktijk ook
// "Klasse: STERK.", "**ja**", "Antwoord: NEE" of een verbogen vorm. Dit leest daar de bedoelde
// keuze uit: accenten en leestekens weg, dan de klasse die als EERSTE voorkomt — bij
// "sterk, niet legendarisch" is dat sterk, en dat is wat het model bedoelde.
//
// Geeft null als er niets herkenbaars in staat, zodat de aanroeper naar zijn vangnet kan vallen
// in plaats van stilzwijgend de eerste klasse toe te kennen.
// `deelwoorden` staat standaard UIT, en dat is geen smaakkwestie. Met de terugval aan leest
// "Jammer genoeg niet" als "ja", want ja zit in jammer — bij isBanwaardig betekent dat iemand
// verbannen terwijl het model nee zei. Dezelfde val geldt voor jaar, januari en elk ander woord
// met die twee letters. Alleen waar verbogen vormen écht voorkomen (de eer-jury: "een zwakke
// reden" moet als zwak tellen) zet de aanroeper hem aan.
function kiesKlasse(tekst, klassen = [], { deelwoorden = false } = {}) {
  const schoon = String(tekst == null ? '' : tekst)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!schoon) return null;
  // Eerst op HELE WOORDEN, en bij `deelwoorden` daarna pas op deelwoord.
  const omspatied = ` ${schoon} `;
  for (const pass of deelwoorden ? ['heel', 'deel'] : ['heel']) {
    let beste = null;
    let positie = Infinity;
    for (const k of klassen) {
      const naald = String(k).toLowerCase();
      const idx = pass === 'heel' ? omspatied.indexOf(` ${naald} `) : schoon.indexOf(naald);
      if (idx !== -1 && idx < positie) { positie = idx; beste = k; }
    }
    if (beste) return beste;
  }
  return null;
}

module.exports = {
  kiesKlasse, isHoofdletterSpam, ontschreeuw, isSchreeuwer, roepUit, zinnenMetHoofdletter, kapAfOpZinsgrens, normaliseerOndertekening, splitsVoorBlokken, BLOK_MAX, AFKORTING_VOOR_PUNT };
