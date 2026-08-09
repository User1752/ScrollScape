'use strict';

/**
 * Races `promise` against a timeout of `ms`. Rejects with `message` if the
 * timeout wins; the original promise is left to settle on its own (its
 * eventual result/rejection is simply not awaited) rather than being
 * cancelled, since fetch-based operations here have no abort hook wired
 * through to this level.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, message) {
  const timeout = new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.finally(() => clearTimeout(timer));
  });
  return Promise.race([promise, timeout]);
}

module.exports = { withTimeout };
