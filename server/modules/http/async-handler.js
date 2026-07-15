'use strict';

const { recordError } = require('../error-logger');

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

      if (!isExpected) {
        let area = tag.toLowerCase();
        if (req?.params?.id) area = req.params.id;
        else if (req?.originalUrl?.includes('/api/proxy-image')) area = 'proxy-image';

        recordError({
          code: `HTTP-${status}`,
          area,
          message: err?.message || defaultMessage,
          details: { url: req?.originalUrl }
        }).catch(() => {});
      }

      if (res.headersSent) return;
      res.status(status).json({
        ok: false,
        code: err?.code,
        error: err?.message || defaultMessage,
        ...(err?.details || {})
      });
    }
  };
}

module.exports = {
  createAsyncHandler,
};
