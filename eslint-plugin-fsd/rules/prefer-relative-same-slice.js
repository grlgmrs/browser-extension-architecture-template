'use strict';

const path = require('node:path');

const FSD_LAYERS = ['pages', 'widgets', 'features', 'entities', 'shared'];

/**
 * @param {string} pathUnderSrc - e.g. "entities/candidate/ui/details"
 * @returns {{ layer: string, slice: string | null } | null}
 */
function getLayerAndSlice(pathUnderSrc) {
  const normalized = pathUnderSrc.replace(/\\/g, '/').replace(/^\//, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0];
  if (!FSD_LAYERS.includes(first)) return null;
  const layer = first;
  const slice = layer === 'shared' ? null : segments[1] || null;
  return { layer, slice };
}

/**
 * @param {string} filename - Absolute path to current file
 * @param {string} srcDir - e.g. "src"
 * @returns {string | null} - path under src (e.g. "entities/history/ui/...")
 */
function getPathUnderSrc(filename, srcDir) {
  const normalized = filename.replace(/\\/g, '/');
  const srcSegment = '/' + srcDir + '/';
  const srcIndex = normalized.indexOf(srcSegment);
  if (srcIndex === -1) return null;
  return normalized.slice(srcIndex + srcSegment.length);
}

/**
 * @param {string} importPath - e.g. "@/entities/history/model"
 * @returns {{ pathUnderSrc: string, layer: string, slice: string | null } | null}
 */
function parseAliasImport(importPath) {
  if (!importPath.startsWith('@/') && !importPath.startsWith('@\\')) return null;
  const pathUnderSrc = importPath.slice(2).replace(/\\/g, '/').replace(/\/$/, '');
  const segments = pathUnderSrc.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const layer = segments[0];
  if (!FSD_LAYERS.includes(layer)) return null;
  const slice = layer === 'shared' ? null : segments[1] || null;
  return { pathUnderSrc, layer, slice };
}

/**
 * @param {string} fromDir - path under src, directory (e.g. "entities/history/ui/history/edit-note")
 * @param {string} toPath - path under src, file or folder (e.g. "entities/history/model")
 * @returns {string} - relative path for import (e.g. "../../../model")
 */
function relativePathUnderSrc(fromDir, toPath) {
  const relative = path.posix.relative(fromDir, toPath);
  return relative.startsWith('.') ? relative : './' + relative;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require relative imports when importing from the same FSD slice. Do not use @/ alias for same-slice imports.',
    },
    messages: {
      preferRelativeSameSlice:
        'FSD: Use a relative import for same-slice code. Use "{{ suggested }}" instead of "{{ current }}".',
    },
    schema: [
      {
        type: 'object',
        properties: {
          srcDir: { type: 'string', default: 'src' },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const srcDir = options.srcDir || 'src';
    const filename = context.physicalFilename ?? context.filename ?? '';

    const pathUnderSrc = getPathUnderSrc(filename, srcDir);
    if (!pathUnderSrc) return {};

    const fileInfo = getLayerAndSlice(pathUnderSrc);
    if (!fileInfo) return {};

    const currentDir = path.posix.dirname(pathUnderSrc);

    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        if (!source || typeof source !== 'string') return;

        const parsed = parseAliasImport(source);
        if (!parsed) return;

        const sameLayer = fileInfo.layer === parsed.layer;
        const sameSlice =
          (fileInfo.slice == null && parsed.slice == null) || fileInfo.slice === parsed.slice;
        if (!sameLayer || !sameSlice) return;

        const suggested = relativePathUnderSrc(currentDir, parsed.pathUnderSrc);
        context.report({
          node: node.source,
          messageId: 'preferRelativeSameSlice',
          data: { suggested, current: source },
        });
      },
    };
  },
};
