'use strict';

const path = require('path');
const fs = require('fs');
const merge = require('merge-options');
const { NLSBundlePlugin } = require('vscode-nls-dev/lib/webpack-bundler');
const { DefinePlugin } = require('webpack');

function withNodeDefaults(extConfig) {
  const folderName = path.resolve(extConfig.context).split(/[\\\/]/)[0];
  const pkgPath = path.join(folderName, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const id = `${pkg.publisher}.${pkg.name}`;

  let defaultConfig = {
    mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    target: 'node', // extensions run in a node context
    node: {
      __dirname: false, // leave the __dirname-behaviour intact
    },
    resolve: {
      mainFields: ['module', 'main'],
      extensions: ['.ts', '.js'], // support ts-files and js-files
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              // vscode-nls-dev loader:
              // * rewrite nls-calls
              loader: require.resolve('vscode-nls-dev/lib/webpack-loader'),
              options: {
                base: path.join(extConfig.context, 'src'),
              },
            },
            {
              loader: require.resolve('ts-loader'),
              options: {
                compilerOptions: {
                  sourceMap: false,
                },
              },
            },
          ],
        },
      ],
    },
    externals: {
      vscode: 'commonjs vscode', // ignored because it doesn't exist
      kaitian: 'commonjs kaitian', // ignored because it doesn't exist
    },
    output: {
      filename: '[name].js',
      path: path.join(extConfig.context, 'out'),
      libraryTarget: 'commonjs',
    },
    devtool: 'none',
    plugins: [
      new NLSBundlePlugin(id),
    ],
  };

  return merge(defaultConfig, extConfig);
}

function withBrowserDefaults(extConfig) {
  let defaultConfig = {
    mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    target: 'webworker', // extensions run in a webworker context
    resolve: {
      mainFields: ['module', 'main'],
      extensions: ['.ts', '.js', '.less', '.css', '.tsx', '.jsx'], // support ts-files and js-files
    },
    module: {
      rules: [
        {
          test: /\.tsx$/,
          exclude: /node_modules/,
          use: [
            {
              loader: require.resolve('ts-loader'),
              options: {
                compilerOptions: {
                  sourceMap: false,
                },
              },
            },
          ],
        },
        {
          test: /\.less$/,
          use: [
            require.resolve('style-loader'),
            require.resolve('css-loader'),
            {
              loader: require.resolve('less-loader'),
              options: {
                lessOptions: {
                  javascriptEnabled: true,
                }
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: [
            require.resolve('style-loader'),
            require.resolve('css-loader'),
          ],
        },
      ],
    },
    externals: {
      vscode: 'commonjs vscode', // ignored because it doesn't exist
      kaitian: 'commonjs kaitian', // ignored because it doesn't exist
      'kaitian-browser': 'commonjs kaitian-browser', // ignored because it doesn't exist
    },
    performance: {
      hints: false,
    },
    output: {
      filename: '[name].js',
      path: path.join(extConfig.context, 'out', 'browser'),
      libraryTarget: 'commonjs',
    },
    devtool: 'none',
    plugins: [
    ],
  };

  return merge(defaultConfig, extConfig);
}

function withWorkerDefaults(extConfig) {
  let defaultConfig = {
    mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    target: 'webworker', // extensions run in a webworker context
    resolve: {
      mainFields: ['module', 'main'],
      extensions: ['.ts', '.js'], // support ts-files and js-files
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
                  sourceMap: false,
                },
              },
            },
          ],
        },
      ],
    },
    externals: {
      vscode: 'commonjs vscode', // ignored because it doesn't exist
      kaitian: 'commonjs kaitian', // ignored because it doesn't exist
    },
    performance: {
      hints: false,
    },
    output: {
      // all output goes into `dist`.
      // packaging depends on that and this must always be like it
      filename: '[name].js',
      path: path.join(extConfig.context, 'out', 'worker'),
      libraryTarget: 'commonjs',
    },
    // yes, really source maps
    devtool: 'null',
    plugins: [
      // new CopyWebpackPlugin([
      // 	{ from: 'src', to: '.', ignore: ['**/test/**', '*.ts'] }
      // ]),
      new DefinePlugin({ WEBWORKER: JSON.stringify(true) }),
    ],
  };

  return merge(defaultConfig, extConfig);
}

module.exports = withNodeDefaults;
module.exports.node = withNodeDefaults;
module.exports.browser = withBrowserDefaults;
module.exports.worker = withWorkerDefaults;