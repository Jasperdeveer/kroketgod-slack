// Tests voor de R2-upload. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { tekenV4, zetOpR2 } = require('./r2');

// Het "PUT Object"-voorbeeld uit de AWS-documentatie over Signature V4 voor S3.
test('tekenV4 klopt met het AWS-voorbeeld', () => {
  const auth = tekenV4({
    methode: 'PUT', pad: '/test$file.text',
    headers: {
      Host: 'examplebucket.s3.amazonaws.com', Date: 'Fri, 24 May 2013 00:00:00 GMT',
      'x-amz-date': '20130524T000000Z', 'x-amz-storage-class': 'REDUCED_REDUNDANCY',
      'x-amz-content-sha256': '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
    },
    payloadHash: '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', regio: 'us-east-1',
  });
  assert.match(auth, /SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class, Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd$/);
});

test('zetOpR2 doet een PUT en geeft de openbare URL', async () => {
  const env = { R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'id', R2_SECRET_ACCESS_KEY: 'geheim', R2_BUCKET: 'casino', R2_PUBLIC_URL: 'https://pub-x.r2.dev/' };
  let gezien;
  const fetch = async (url, opties) => { gezien = { url, opties }; return { ok: true }; };
  const url = await zetOpR2(Buffer.from('png'), 'abc.png', 'image/png', { fetch, env });
  assert.strictEqual(url, 'https://pub-x.r2.dev/abc.png');
  assert.strictEqual(gezien.url, 'https://acc.r2.cloudflarestorage.com/casino/abc.png');
  assert.strictEqual(gezien.opties.method, 'PUT');
  assert.match(gezien.opties.headers.authorization, /^AWS4-HMAC-SHA256 Credential=id\/\d{8}\/auto\/s3\/aws4_request/);
  await assert.rejects(zetOpR2(Buffer.from('x'), 'a.png', 'image/png', { fetch, env: {} }), /niet ingesteld/);
});
