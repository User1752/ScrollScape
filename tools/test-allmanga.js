const https = require('https');

function req(path, body, headers) {
  return new Promise((resolve, reject) => {
    const r = https.request(
      { hostname: 'api.allanime.day', path, method: 'POST', headers },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); }
    );
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://allmanga.to',
    'Origin': 'https://allmanga.to',
  };

  // Test 1: simple query
  const q1 = JSON.stringify({ query: '{ mangas(search:{query:"one piece"}, limit:1, page:1) { edges { _id name } } }' });
  const r1 = await req('/api', q1, headers);
  console.log('=== Search ===');
  const d1 = JSON.parse(r1);
  console.log(JSON.stringify(d1, null, 2).slice(0, 500));

  // Get first manga id
  const mangaId = d1.data?.mangas?.edges?.[0]?._id;
  if (!mangaId) { console.log('No manga found'); return; }
  console.log('\nManga ID:', mangaId);

  // Test 2: chapters
  const q2 = JSON.stringify({ query: `{ manga(_id:${JSON.stringify(mangaId)}) { availableChaptersDetail } }` });
  const r2 = await req('/api', q2, headers);
  const d2 = JSON.parse(r2);
  const detail = d2.data?.manga?.availableChaptersDetail || {};
  const nums = detail.sub || detail.raw || [];
  const firstChapter = nums[nums.length - 1]; // oldest = last in sorted desc
  console.log('\nFirst chapter num:', firstChapter, '| Total:', nums.length);

  if (!firstChapter) { console.log('No chapters'); return; }

  // Test 3: pages
  const q3 = JSON.stringify({ query: `{ chapterPages(mangaId:${JSON.stringify(mangaId)}, chapterString:${JSON.stringify(String(firstChapter))}, translationType: sub) { edges { pictureUrls pictureUrlHead } } }` });
  const r3 = await req('/api', q3, headers);
  console.log('\n=== Pages raw response ===');
  console.log(r3.slice(0, 1000));
}

main().catch(console.error);
