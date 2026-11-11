// Uploaden naar Cloudflare R2 (S3-API) met een eigen AWS Signature V4: één PUT, geen SDK nodig.
// Run de test: `npm test`.

'use strict';

const { createHash, createHmac } = require('node:crypto');

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (sleutel, data) => createHmac('sha256', sleutel).update(data).digest();
const codeer = (pad) => pad.split('/').map(d => encodeURIComponent(d).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('/');

// Geeft de Authorization-header voor een verzoek. `headers` moet host en x-amz-date bevatten.
function tekenV4({ methode, pad, headers, payloadHash, accessKeyId, secretAccessKey, regio, dienst = 's3' }) {
  const amzDatum = headers['x-amz-date'];
  const dag = amzDatum.slice(0, 8);
  const namen = Object.keys(headers).map(n => n.toLowerCase()).sort();
  const lager = Object.fromEntries(Object.entries(headers).map(([n, w]) => [n.toLowerCase(), String(w).trim()]));
  const canoniek = [methode, codeer(pad), '', ...namen.map(n => `${n}:${lager[n]}`), '', namen.join(';'), payloadHash].join('\n');
  const scope = `${dag}/${regio}/${dienst}/aws4_request`;
  const teTekenen = ['AWS4-HMAC-SHA256', amzDatum, scope, sha256(canoniek)].join('\n');
  const sleutel = hmac(hmac(hmac(hmac('AWS4' + secretAccessKey, dag), regio), dienst), 'aws4_request');
  const handtekening = createHmac('sha256', sleutel).update(teTekenen).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${namen.join(';')}, Signature=${handtekening}`;
}

// Zet `buf` in de bucket onder `sleutel` en geeft de openbare URL (R2_PUBLIC_URL + sleutel).
async function zetOpR2(buf, sleutel, contentType, { fetch, env = process.env, timeout = 8000, nu = new Date() } = {}) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) throw new Error('R2 niet ingesteld');
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const pad = `/${R2_BUCKET}/${sleutel}`;
  const payloadHash = sha256(buf);
  const headers = { host, 'content-type': contentType, 'x-amz-content-sha256': payloadHash, 'x-amz-date': nu.toISOString().replace(/[-:]|\.\d{3}/g, '') };
  const authorization = tekenV4({ methode: 'PUT', pad, headers, payloadHash, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, regio: 'auto' });
  const { host: _, ...zonderHost } = headers;
  const res = await fetch(`https://${host}${codeer(pad)}`, { method: 'PUT', body: buf, headers: { ...zonderHost, authorization }, timeout });
  if (!res.ok) throw new Error(`R2 gaf ${res.status}`);
  return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${sleutel}`;
}

module.exports = { tekenV4, zetOpR2 };
