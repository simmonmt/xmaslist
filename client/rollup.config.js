const commonjs = require('@rollup/plugin-commonjs');
const {nodeResolve} = require('@rollup/plugin-node-resolve');
const replace = require('@rollup/plugin-replace');

module.exports = {
  onwarn: function(warning, warn) {
    // Suppress specific warnings for packages we include, as we can't really
    // fix them. This could be generalized to suppress anything that's not in
    // our code, but lets try this smaller hammer first.

    if (warning.code ==='EVAL' &&
        warning.loc.file.includes('google-protobuf')) {
      return;
    }

    if (warning.code === 'CIRCULAR_DEPENDENCY' &&
        warning.cycle[0].includes('lorem-ipsum')) {
      return;
    }

    // Other warning suppression

    // We don't need a name -- the contents of index.tsx are to be executed
    // immediately (and will be as long as there's no exported name).
    if (warning.code === 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') {
      return;
    }

    // This warning fires on a check to see if 'this' is defined. Nothing to
    // be fixed upstream -- the code is being properly defensive.
    if (warning.code === 'THIS_IS_UNDEFINED' &&
        warning.loc.file.includes('universal-cookie/es6/Cookies.js')) {
      return;
    }

    // Use the default handler for everything else.
    warn(warning);
  },

  plugins: [
    nodeResolve(),
    commonjs(),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
};
