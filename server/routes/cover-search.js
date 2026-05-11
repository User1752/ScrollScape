'use strict';

const { searchCoverImages } = require('../modules/cover-search');
const { createAsyncHandler } = require('../modules/http/async-handler');

const asyncHandler = createAsyncHandler('COVER_SEARCH', 502, 'Google search failed');

function registerCoverSearchRoutes(router) {
  router.get('/api/cover/google-images', asyncHandler(async (req, res) => {
    const result = await searchCoverImages(req.query || {});
    res.json(result);
  }));
}

module.exports = { registerCoverSearchRoutes };
