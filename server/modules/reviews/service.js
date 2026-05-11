'use strict';

function createReviewService({ readStore, writeStore }) {
  function normalizeKey(rawValue) {
    return String(rawValue || '').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 200);
  }

  async function getReviews(mangaId) {
    const safeKey = normalizeKey(mangaId);
    const store = await readStore();
    return { reviews: store.reviews[safeKey] || [] };
  }

  async function addReview({ mangaId, rating, text } = {}) {
    if (!mangaId || !rating) {
      const err = new Error('mangaId and rating required');
      err.statusCode = 400;
      throw err;
    }

    const safeKey = normalizeKey(mangaId);
    if (!safeKey) {
      const err = new Error('Invalid mangaId');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    if (!Object.prototype.hasOwnProperty.call(store.reviews, safeKey)) store.reviews[safeKey] = [];
    store.reviews[safeKey] = [
      {
        rating: Math.min(10, Math.max(1, Number(rating))),
        text: String(text || '').slice(0, 2000),
        date: new Date().toISOString(),
      },
      ...store.reviews[safeKey].slice(0, 19),
    ];
    await writeStore(store);
    return { ok: true, reviews: store.reviews[safeKey] };
  }

  async function getRatings() {
    const store = await readStore();
    const ratings = {};
    for (const [mangaId, arr] of Object.entries(store.reviews)) {
      if (arr[0]?.rating) ratings[mangaId] = arr[0].rating;
    }
    return { ratings };
  }

  async function clearRating({ mangaId } = {}) {
    const safeKey = normalizeKey(mangaId);
    if (!safeKey) {
      const err = new Error('Invalid mangaId');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    delete store.reviews[safeKey];
    await writeStore(store);
    return { ok: true };
  }

  async function removeRatingById(mangaId) {
    const safeKey = normalizeKey(mangaId);
    if (!safeKey) {
      const err = new Error('Invalid mangaId');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    delete store.reviews[safeKey];
    await writeStore(store);
    return { ok: true };
  }

  return {
    getReviews,
    addReview,
    getRatings,
    clearRating,
    removeRatingById,
  };
}

module.exports = { createReviewService };