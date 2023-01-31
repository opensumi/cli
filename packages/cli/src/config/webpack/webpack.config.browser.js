const withDefaults = require('./shared.webpack.config').browser;
const path = require('path');

module.exports = (options) => withDefaults({
	context: path.resolve(options.cwd),
	entry: {
		'KAITIAN-BROWSER': path.join(options.cwd, 'src/extend/browser/index.ts'),
	},
	output: {
		filename: 'index.js',
		path: path.join(options.cwd, 'out', 'browser')
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM',
    'sumi-browser': 'commonjs sumi-browser',
  }
});
