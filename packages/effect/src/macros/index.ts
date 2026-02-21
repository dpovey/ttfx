/**
 * Effect Macros
 *
 * Attribute macros for defining Effect services and layers.
 *
 * @module
 */

export {
  serviceAttribute,
  service,
  serviceRegistry,
  registerService,
  getService,
  type ServiceInfo,
  type ServiceMethodInfo,
} from "./service.js";

export {
  layerAttribute,
  layer,
  layerRegistry,
  registerLayer,
  getLayer,
  getLayersForService,
  type LayerInfo,
} from "./layer.js";

export { resolveLayerMacro, resolveLayer } from "./resolve-layer.js";
