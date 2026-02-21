// Self-contained language service plugin for typesugar
// TypeScript expects the factory function directly, not wrapped in { default }
const plugin = require("./language-service.cjs");
module.exports = plugin.default || plugin;
