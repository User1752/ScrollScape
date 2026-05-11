'use strict';

const { readStore, writeStore } = require('../store');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createReviewService } = require('../modules/reviews/service');

const asyncHandler = createAsyncHandler('REVIEWS');

const reviewService = createReviewService({
  readStore,
  writeStore,
});

/**
 * @param {import('express').Router} router
 */
function registerReviewRoutes(router) {
  router.get('/api/reviews/:mangaId', asyncHandler(async (req, res) => {
    res.json(await reviewService.getReviews(req.params.mangaId));
  }));

  router.post('/api/reviews', asyncHandler(async (req, res) => {
    res.json(await reviewService.addReview(req.body || {}));
  }));

  router.get('/api/ratings', asyncHandler(async (_req, res) => {
    res.json(await reviewService.getRatings());
  }));

  router.post('/api/ratings/clear', asyncHandler(async (req, res) => {
    res.json(await reviewService.clearRating(req.body || {}));
  }));

  router.delete('/api/ratings/:mangaId', asyncHandler(async (req, res) => {
    res.json(await reviewService.removeRatingById(req.params.mangaId));
  }));
}

module.exports = { registerReviewRoutes };