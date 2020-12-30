const withDefaults = require('./shared.webpack.config');
const path = require('path');

module.exports = (options) => withDefaults({
	context: path.resolve(options.cwd),
	entry: {
		'KAITIAN-NODE': path.join(options.cwd, 'src/extend/node/index.ts'),
	},
	output: {
		filename: 'index.js',
		path: path.join(options.cwd, 'out', 'node')
	}
});