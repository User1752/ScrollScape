'use strict';

const { safeId, isSafeUrl } = require('../helpers');

function requireValidIdParam(paramName) {
  return (req, res, next) => {
    if (!safeId(req.params[paramName])) {
      return res.status(400).json({ ok: false, error: `Invalid parameter: ${paramName}` });
    }
    next();
  };
}

function requireValidIdBody(fieldName) {
  return (req, res, next) => {
    if (!req.body || !safeId(req.body[fieldName])) {
      return res.status(400).json({ ok: false, error: `Invalid or missing field in body: ${fieldName}` });
    }
    next();
  };
}

function requireSafeUrlBody(fieldName) {
  return (req, res, next) => {
    if (!req.body || !isSafeUrl(req.body[fieldName])) {
      return res.status(400).json({ ok: false, error: `Invalid or unsafe URL in body: ${fieldName}` });
    }
    next();
  };
}

function requireSafeUrlQuery(paramName) {
  return (req, res, next) => {
    if (!req.query || !isSafeUrl(req.query[paramName])) {
      return res.status(400).json({ ok: false, error: `Invalid or unsafe URL in query: ${paramName}` });
    }
    next();
  };
}

module.exports = {
  requireValidIdParam,
  requireValidIdBody,
  requireSafeUrlBody,
  requireSafeUrlQuery,
};
