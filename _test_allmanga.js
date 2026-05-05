const crypto = require('crypto');
const API = 'https://api.allanime.day/api';
const DECRYPT_KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest();

function decodeTobeparsed(blob) {
  const raw = Buffer.from(blob, 'base64');
  const nonce = raw.subarray(1, 13);
  const iv = Buffer.concat([nonce, Buffer.from([0, 0, 0, 2])]);
  const ciphertext = raw.subarray(13, raw.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-ctr', DECRYPT_KEY, iv);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

const query = `{ mangas(search:{query:"naruto"}, limit:3, page:1) { edges { _id name thumbnail } } }`;
fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Referer': 'https://allmanga.to', 'Origin': 'https://allmanga.to' },
  body: JSON.stringify({ query })
})
  .then(r => r.json())
  .then(json => {
    if (!json.data?.tobeparsed) { console.log(JSON.stringify(json).slice(0, 500)); return; }
    try {
      const d = decodeTobeparsed(json.data.tobeparsed);
      console.log('SUCCESS:', JSON.stringify(d).slice(0, 400));
    } catch(e) {
      console.error('FAIL:', e.message);
    }
  })
  .catch(e => console.error('fetch error:', e.message));
