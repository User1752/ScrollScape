'use strict';

/**
 * Creates an async route wrapper with consistent error logging/response.
 */
function createAsyncHandler(tag = 'API', defaultStatus = 500, defaultMessage = 'Internal Server Error') {
  return (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      const status = Number(err?.statusCode) || defaultStatus;
      const isExpected = !!err?.expected || (status >= 400 && status < 500);
      const logMethod = isExpected ? 'warn' : 'error';

      console[logMethod](`[${tag}][${isExpected ? 'WARN' : 'ERROR'}]`, {
        method: req?.method,
        path: req?.originalUrl,
        params: req?.params,
        body: req?.body,
        error: err?.message,
        ...(isExpected ? {} : { stack: err?.stack }),
      });

      if (res.headersSent) return;
      res.status(status).json({ error: err?.message || defaultMessage });
    }
  };
}

module.exports = {
  createAsyncHandler,
};
