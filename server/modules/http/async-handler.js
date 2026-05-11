'use strict';

/**
 * Creates an async route wrapper with consistent error logging/response.
 */
function createAsyncHandler(tag = 'API', defaultStatus = 500, defaultMessage = 'Internal Server Error') {
  return (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      console.error(`[${tag}][ERROR]`, {
        method: req?.method,
        path: req?.originalUrl,
        params: req?.params,
        body: req?.body,
        error: err?.message,
        stack: err?.stack,
      });

      if (res.headersSent) return;
      const status = Number(err?.statusCode) || defaultStatus;
      res.status(status).json({ error: err?.message || defaultMessage });
    }
  };
}

module.exports = {
  createAsyncHandler,
};
