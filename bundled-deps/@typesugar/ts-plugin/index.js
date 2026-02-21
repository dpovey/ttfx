// Re-export the language service plugin from @typesugar/transformer
// TypeScript expects the factory function directly, not wrapped in { default }
const plugin = require("@typesugar/transformer/language-service");
module.exports = plugin.default || plugin;
