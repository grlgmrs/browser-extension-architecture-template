'use strict';

const importBoundaries = require('./rules/import-boundaries.js');
const preferRelativeSameSlice = require('./rules/prefer-relative-same-slice.js');

module.exports = {
  rules: {
    'import-boundaries': importBoundaries,
    'prefer-relative-same-slice': preferRelativeSameSlice,
  },
};
