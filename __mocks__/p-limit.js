// Jest mock for p-limit (ESM-only package — cannot be imported in Jest CJS context)
// Returns a pass-through limiter that executes functions immediately.
const pLimit = (concurrency) => {
  const limit = (fn, ...args) => fn(...args);
  return limit;
};

module.exports = pLimit;
module.exports.default = pLimit;
