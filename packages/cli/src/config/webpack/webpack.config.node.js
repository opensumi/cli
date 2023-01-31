const withDefaults = require('./shared.webpack.config');
const path = require('path');

module.exports = (options) => withDefaults({
	context: path.resolve(options.cwd),
	entry: {
		'SUMI-NODE': path.join(options.cwd, 'src/extend/node/index.ts'),
	},
	output: {
		filename: 'index.js',
		path: path.join(options.cwd, 'out', 'node')
	},
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve('ts-loader'),
            options: {
              compilerOptions: {
                // type: 'run' | 'watch'
                sourceMap: options.compilerMethod === 'watch',
              },
            },
          },
        ],
      },
    ],
  }
});
