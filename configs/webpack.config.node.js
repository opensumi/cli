const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const path = require('path');

const tsConfigPath = path.join(__dirname, './tsconfig.json');
const srcDir = path.join(__dirname, '../packages/node');
const distDir = path.join(__dirname, '../scripts/node');

module.exports = {
  entry: path.join(srcDir, './index.ts'),
  target: 'node',
  output: {
    filename: 'server.js',
    path: distDir,
  },
  node: false,
  mode: 'development',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
      }),
    ],
  },
  module: {
    // https://github.com/webpack/webpack/issues/196#issuecomment-397606728
    exprContextCritical: false,
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          configFile: tsConfigPath,
        },
      },
    ],
  },
  externals: [
    function(context, request, callback) {
      if (
        [
          'node-pty',
          'oniguruma',
          'nsfw',
          'spdlog',
          '@ali/vscode-ripgrep',
          'canvas',
        ].indexOf(request) !== -1
      ) {
        return callback(null,  `commonjs ${request}`);
      }
      callback();
    },
  ],
  resolveLoader: {
    modules: [path.join(__dirname, '../node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    mainFields: ['loader', 'main'],
    moduleExtensions: ['-loader'],
  },
};
