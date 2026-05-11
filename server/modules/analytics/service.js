'use strict';

function createAnalyticsService({ readStore, writeStore }) {
  async function getAnalytics() {
    const store = await readStore();

    const dist = { reading: 0, completed: 0, on_hold: 0, plan_to_read: 0, dropped: 0 };
    for (const s of Object.values(store.readingStatus)) {
      if (dist[s.status] !== undefined) dist[s.status]++;
    }

    let ratingSum = 0;
    let ratingCount = 0;
    let totalReviews = 0;
    for (const arr of Object.values(store.reviews)) {
      totalReviews += arr.length;
      const r = arr[0]?.rating;
      if (typeof r === 'number' && r > 0) {
        ratingSum += r;
        ratingCount++;
      }
    }

    const meanScore = ratingCount ? Math.round((ratingSum / ratingCount) * 100) / 100 : null;

    return {
      analytics: store.analytics,
      statusDistribution: dist,
      totalFavorites: store.favorites.length,
      totalReviews,
      totalLists: store.customLists.length,
      meanScore,
    };
  }

  async function recordSession({ mangaId, mangaTitle, chapterId, chapterName, chapterNumber, chaptersRead, duration } = {}) {
    const safeMid = String(mangaId ?? '').slice(0, 200);
    const safeTitle = String(mangaTitle ?? '').slice(0, 300);
    const safeCid = String(chapterId ?? '').slice(0, 200);
    const safeCName = String(chapterName ?? '').slice(0, 300);
    const safeCNum = String(chapterNumber ?? '').slice(0, 60);
    const safeReadCount = Math.max(1, Math.min(500, Number(chaptersRead) || 1));

    const store = await readStore();
    const a = store.analytics;

    const mins = Math.min(1440, Math.max(0, Number(duration) || 0));
    a.totalTimeSpent = (a.totalTimeSpent || 0) + mins;
    a.totalChaptersRead = (a.totalChaptersRead || 0) + 1;

    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();

    if (a.lastReadDate !== todayStr) {
      if (a.lastReadDate === yesterdayStr) {
        a.dailyStreak = (a.dailyStreak || 0) + 1;
      } else {
        a.dailyStreak = 1;
      }
      a.lastReadDate = todayStr;
    }

    a.readingSessions = a.readingSessions || [];
    a.readingSessions.unshift({
      mangaId: safeMid,
      mangaTitle: safeTitle,
      chapterId: safeCid,
      chapterName: safeCName,
      chapterNumber: safeCNum,
      chaptersRead: safeReadCount,
      duration: mins,
      date: new Date().toISOString(),
    });
    a.readingSessions = a.readingSessions.slice(0, 200);

    await writeStore(store);
    return { ok: true, analytics: store.analytics };
  }

  return {
    getAnalytics,
    recordSession,
  };
}

module.exports = { createAnalyticsService };