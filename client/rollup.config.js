const commonjs = require('@rollup/plugin-commonjs');
const {nodeResolve} = require('@rollup/plugin-node-resolve');
const replace = require('@rollup/plugin-replace');

module.exports = {
  plugins: [
    nodeResolve(),
    commonjs(),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
};
