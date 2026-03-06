// Jest mock for client-zip (ESM-only package — cannot be imported in Jest CJS context)
const downloadZip = () => new Response(new Blob());
module.exports = { downloadZip };
module.exports.default = { downloadZip };
