const allmanga = require('../data/sources/allmanga.js');

async function test() {
  try {
    console.log('Fetching details for a known manga (e.g., One Piece or similar)...');
    const searchRes = await allmanga.search('One Piece', 1);
    const manga = searchRes.results[0];
    if (!manga) {
      console.log('No manga found');
      return;
    }
    console.log('Manga:', manga.title, manga.id);
    
    console.log('\nFetching chapters...');
    const chapRes = await allmanga.chapters(manga.id);
    const chapters = chapRes.chapters;
    console.log('Chapters found:', chapters.length);
    if (chapters.length === 0) return;
    
    const firstChap = chapters[200] || chapters[0];
    console.log('\nFetching pages for chapter:', firstChap.id);
    const pagesRes = await allmanga.pages(firstChap.id);
    console.log('Pages:', pagesRes.pages?.length || 0);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
