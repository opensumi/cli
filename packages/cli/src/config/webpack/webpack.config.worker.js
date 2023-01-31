const withDefaults = require('./shared.webpack.config').worker;
const path = require('path');

module.exports = (options) => withDefaults({
	context: path.join(options.cwd),
	entry: {
		'KAITIAN-WORKER': path.join(options.cwd, 'src/extend/worker/index.ts'),
	},
	output: {
		filename: 'index.js',
		path: path.join(options.cwd, 'out', 'worker')
  },
  externals: {
    'sumi-worker': 'commonjs sumi-worker',
  }
});
