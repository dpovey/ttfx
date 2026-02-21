"use strict";

// Language service plugin - delegates to @typesugar/transformer
// This file is used for local development when dist/ doesn't exist.
// For production use, the built dist/index.js is the entry point.

const transformerPlugin = require("@typesugar/transformer/language-service");
module.exports = transformerPlugin.default || transformerPlugin;
