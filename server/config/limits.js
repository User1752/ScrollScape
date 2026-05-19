'use strict';

module.exports = {
  jsonBodyLimit: '5mb',
  maxUploadSizeBytes: 500 * 1024 * 1024,
  apiRateLimitWindowMs: 600_000,
  apiRateLimitMaxRequests: 6000,
  fetchTimeoutMs: 10_000,
  sourceCallTimeoutMs: 30_000,
  repoCacheTtlMs: 3_600_000
};
