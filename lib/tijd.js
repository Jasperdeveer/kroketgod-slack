// ── Tijd: alles in Amsterdamse tijd ────────────────────────────────────────────
// De bot leeft in Europe/Amsterdam: weekgrenzen, weekenden en dagsleutels moeten daar kloppen,
// ongeacht de tijdzone van de server. Vandaar overal expliciete Intl-formatters.

function isWeekendAms() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short',
  }).formatToParts(new Date());
  const dag = parts.find(p => p.type === 'weekday')?.value;
  return dag === 'Sat' || dag === 'Sun';
}

// ── Amsterdam-offset helper ───────────────────────────────────────────────────
// Geeft de UTC-offset van Amsterdam in milliseconden (bijv. UTC+2 → 7200000).
// Veilig bij DST-wisselingen omdat Intl.DateTimeFormat de actuele offset berekent.
function getAmsOffsetMs(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');
  const amsMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return amsMs - date.getTime(); // positief voor UTC+ zones
}

function getMondayOfWeek(date = new Date()) {
  // Gebruik Amsterdam-tijd voor dag-bepaling zodat dit rond middernacht correct blijft.
  // toLocaleString met timeZone geeft een string die we als lokale tijd parsen —
  // zo krijgen we de juiste weekdag voor Amsterdam zonder timezone-drift.
  const amsDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const day = amsDate.getDay(); // 0=zondag, 1=maandag, ...
  const diff = amsDate.getDate() - day + (day === 0 ? -6 : 1);
  amsDate.setDate(diff);
  const y = amsDate.getFullYear();
  const m = String(amsDate.getMonth() + 1).padStart(2, '0');
  const d = String(amsDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function secondenTotVrijdagMiddag() {
  const nu = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(nu);
  const get = (type) => parts.find(p => p.type === type)?.value;
  const weekdagMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekdag  = weekdagMap[get('weekday')] ?? 0;
  const uur      = parseInt(get('hour'));
  const minuut   = parseInt(get('minute'));
  const seconde  = parseInt(get('second'));

  const secondenVandaag = uur * 3600 + minuut * 60 + seconde;
  const DOEL = 12 * 3600; // vrijdag 12:00:00
  let dagenTot = (5 - weekdag + 7) % 7;
  if (dagenTot === 0 && secondenVandaag >= DOEL) dagenTot = 7;
  return Math.max(0, dagenTot * 86400 + DOEL - secondenVandaag);
}

// ── Middernacht in een andere tijdzone ────────────────────────────────────────
// Gemini zet zijn dagquota terug om middernacht Pacific-tijd, niet om middernacht hier. Een sleutel
// die zijn dagquotum op heeft, hoort dus tot dat moment op de bank — dat is in de zomer 09:00 en
// in de winter 09:00 Amsterdamse tijd, maar rond de DST-wissels (die in de VS op een andere zondag
// vallen) een uur anders. Vandaar rekenen in de echte zone en niet met een vaste offset.

// UTC-offset van `tijdzone` op moment `ts`, in ms, afgerond op de minuut.
function offsetMsIn(tijdzone, ts) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tijdzone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ts));
  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');
  const uur = get('hour') % 24; // sommige ICU-versies geven 24 voor middernacht
  const lokaal = Date.UTC(get('year'), get('month') - 1, get('day'), uur, get('minute'), get('second'));
  return Math.round((lokaal - ts) / 60_000) * 60_000;
}

// Het eerstvolgende middernacht in `tijdzone`, als epoch-ms.
function volgendeMiddernachtIn(tijdzone, nu = Date.now()) {
  const lokaal = new Date(nu + offsetMsIn(tijdzone, nu));
  const middernachtLokaal = Date.UTC(lokaal.getUTCFullYear(), lokaal.getUTCMonth(), lokaal.getUTCDate() + 1);
  // De offset op het doelmoment kan door een DST-wissel anders zijn dan nu: corrigeer daarop.
  const schatting = middernachtLokaal - offsetMsIn(tijdzone, nu);
  return middernachtLokaal - offsetMsIn(tijdzone, schatting);
}

const volgendeMiddernachtPacific = (nu = Date.now()) => volgendeMiddernachtIn('America/Los_Angeles', nu);

module.exports = {
  isWeekendAms, getAmsOffsetMs, getMondayOfWeek, secondenTotVrijdagMiddag,
  volgendeMiddernachtIn, volgendeMiddernachtPacific,
};
