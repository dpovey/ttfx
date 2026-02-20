export * from "./api.js";

import { register } from "./macros.js";

// Auto-register when this module is imported by the transformer
register();
