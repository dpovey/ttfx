// Re-export for TypeScript language service plugin loader
// (TS plugin resolution doesn't support package.json "exports" field)
module.exports = require("./dist/language-service.cjs");
