const crypto = require('crypto');

async function testQuery(q) {
  const GQL_HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://allmanga.to',
    'Origin': 'https://allmanga.to',
  };
  try {
    const res = await fetch('https://api.allanime.day/api', {
      method: 'POST',
      headers: GQL_HEADERS,
      body: JSON.stringify({ query: q })
    });
    const text = await res.text();
    console.log(q, '\n', text.substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  }
}

async function run() {
  const mangaId = "ex9vXC6gWYY9bGkSo";
  const chapterString = "1185";
  const translationType = "sub";
  
  await testQuery(`{ chapterPages(mangaId:"${mangaId}", chapterString:"${chapterString}", translationType: ${translationType}) { edges { pictureUrls pictureUrlHead } } }`);
  await testQuery(`{ chapterPages(mangaId:"${mangaId}", chapterString:"${chapterString}", translationType: ${translationType}, countryOfOrigin: "ALL") { edges { pictureUrls pictureUrlHead } } }`);
  await testQuery(`{ chapterPages(mangaId:"${mangaId}", chapterString:"${chapterString}", translationType: ${translationType}, countryOrigin: "ALL") { edges { pictureUrls pictureUrlHead } } }`);
}

run();
