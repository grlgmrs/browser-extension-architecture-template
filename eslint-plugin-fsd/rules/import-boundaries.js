'use strict';

/**
 * FSD layer order (top → down): app → pages → widgets → features → entities → shared.
 * Lower index = higher layer. A file may only import from its layer or layers with higher index.
 */
const LAYER_ORDER = {
  app: 0,
  pages: 1,
  widgets: 2,
  features: 3,
  entities: 4,
  shared: 5,
};

const FSD_LAYERS = Object.keys(LAYER_ORDER);

/**
 * @param {string} path - Path under src (e.g. "entities/candidate/ui/details")
 * @returns {{ layer: string, slice: string | null } | null} - layer name and slice if in a sliced layer
 */
function getLayerAndSlice(path) {
  const normalized = path.replace(/\\/g, '/').replace(/^\//, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0];
  if (!FSD_LAYERS.includes(first)) return null;
  const layer = first;
  const slice = ['shared'].includes(layer) ? null : segments[1] || null;
  return { layer, slice };
}

/**
 * @param {string} importPath - e.g. "@/entities/user" or "@/entities/user/model/store"
 * @returns {{ layer: string, slice: string | null, isBarrel: boolean } | null}
 */
function parseImportPath(importPath) {
  if (!importPath.startsWith('@/') && !importPath.startsWith('@\\')) return null;
  const withoutAlias = importPath.slice(2).replace(/\\/g, '/').replace(/\/$/, '');
  const segments = withoutAlias.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const layer = segments[0];
  if (!FSD_LAYERS.includes(layer)) return null;
  const slice = ['shared'].includes(layer) ? null : segments[1] || null;
  // FSD @x is the cross-reference public API - treat as barrel
  const isAtX = withoutAlias.includes('/@x/');
  const isBarrel = isAtX
    ? true
    : slice === null
    ? true
    : segments.length === 2 || (segments.length === 3 && segments[2] === 'index');
  return { layer, slice, isBarrel, isAtX };
}

/**
 * @param {string} filename - Absolute path to current file
 * @param {string} [srcDir] - e.g. "src"
 */
function getFileLayerAndSlice(filename, srcDir = 'src') {
  const normalized = filename.replace(/\\/g, '/');
  const srcSegment = '/' + srcDir + '/';
  const srcIndex = normalized.indexOf(srcSegment);
  if (srcIndex === -1) return null;
  const pathUnderSrc = normalized.slice(srcIndex + srcSegment.length);
  return getLayerAndSlice(pathUnderSrc);
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce Feature-Sliced Design import boundaries: layer order and no deep cross-slice imports.',
    },
    messages: {
      layerViolation:
        'FSD: "{{ target }}" is on a higher layer than "{{ current }}". Import only from the same layer or lower (shared ← entities ← features ← widgets ← pages).',
      deepImport:
        'FSD: Import from slice barrel "{{ barrel }}" instead of deep path "{{ current }}". Cross-slice and cross-layer imports must use the slice public API (e.g. @/entities/user, not @/entities/user/model/...).',
      sameLayerCrossSlice:
        'FSD: Same-layer cross-slice imports must use the @x cross-reference API. Use "{{ suggested }}" instead of "{{ current }}".',
    },
    schema: [
      {
        type: 'object',
        properties: {
          srcDir: { type: 'string', default: 'src' },
          allowDeepSameSlice: { type: 'boolean', default: true },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const srcDir = options.srcDir || 'src';
    const allowDeepSameSlice = options.allowDeepSameSlice !== false;
    const filename = context.physicalFilename ?? context.filename ?? '';

    const fileInfo = getFileLayerAndSlice(filename, srcDir);

    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        if (!source || typeof source !== 'string') return;

        const parsed = parseImportPath(source);
        if (!parsed) return;

        const { layer: targetLayer, slice: targetSlice, isBarrel, isAtX } = parsed;

        if (fileInfo) {
          const currentOrder = LAYER_ORDER[fileInfo.layer];
          const targetOrder = LAYER_ORDER[targetLayer];
          if (targetOrder < currentOrder) {
            context.report({
              node: node.source,
              messageId: 'layerViolation',
              data: { target: targetLayer, current: fileInfo.layer },
            });
          }

          // Same layer, different slice: must use @x cross-reference API
          const sameLayer = fileInfo.layer === targetLayer;
          const crossSlice = fileInfo.slice != null && targetSlice != null && fileInfo.slice !== targetSlice;
          if (sameLayer && crossSlice && !isAtX) {
            const suggested = `@/${targetLayer}/${targetSlice}/@x/${fileInfo.slice}`;
            context.report({
              node: node.source,
              messageId: 'sameLayerCrossSlice',
              data: { suggested, current: source },
            });
          }
        }

        if (!isBarrel && (targetSlice || ['entities', 'features', 'widgets', 'pages', 'app'].includes(parsed.layer))) {
          const isSameSlice =
            allowDeepSameSlice && fileInfo && fileInfo.layer === parsed.layer && fileInfo.slice === targetSlice;
          if (!isSameSlice) {
            const barrel = parsed.slice != null ? `@/${parsed.layer}/${parsed.slice}` : `@/${parsed.layer}`;
            context.report({
              node: node.source,
              messageId: 'deepImport',
              data: { barrel, current: source },
            });
          }
        }
      },
    };
  },
};
