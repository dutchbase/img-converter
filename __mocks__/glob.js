// Jest mock for glob v10 (ships CJS+ESM dual build; mock avoids resolution uncertainty in Jest)
const glob = async (pattern, opts) => [];
const globSync = (pattern, opts) => [];
module.exports = { glob, globSync };
module.exports.default = { glob, globSync };
