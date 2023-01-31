'use strict';

import webpack from "webpack";

const path = require('path');
const fs = require('fs');
const { merge } = require('webpack-merge');
const { NLSBundlePlugin } = require('vscode-nls-dev/lib/webpack-bundler');
const { DefinePlugin } = require('webpack');

import { PackageNLSPlugin } from './PackageNLSPlugin';

interface ExtensionBundleConfig extends webpack.Configuration {
  extensionDir: string;
}

export function createNodeDefaults(extConfig: ExtensionBundleConfig) {
  const { extensionDir, ...restConfig } = extConfig;
  const pkgPath = path.join(extensionDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const id = `${pkg.publisher}.${pkg.name}`;

  let defaultConfig: webpack.Configuration = {
    target: 'node',
    entry: extConfig.entry || {
      extension: path.join(extensionDir, 'src/extension.ts'),
    },
    node: {
      __dirname: false,
    },
    resolve: {
      mainFields: ['module', 'main'],
      extensions: ['.ts', '.js'],
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
                base: path.join(extensionDir, 'src'),
              },
            },
            {
              loader: require.resolve('ts-loader'),
              options: {
                compilerOptions: {
                  sourceMap: true,
                },
              },
            },
          ],
        },
      ],
    },
    externals: {
      vscode: 'commonjs vscode',
      sumi: 'commonjs sumi',
    },
    output: {
      filename: '[name].js',
      path: path.join(extensionDir, 'out'),
      libraryTarget: 'commonjs',
    },
    devtool: false,
    plugins: [
      new NLSBundlePlugin(id),
      new PackageNLSPlugin('out')
    ],
  };

  return merge(defaultConfig, restConfig);
}

export function createBrowserDefaults(extConfig: ExtensionBundleConfig) {
  const { extensionDir, ...restConfig } = extConfig;
  let defaultConfig: webpack.Configuration = {
    mode: 'production',
    target: 'web',
    resolve: {
      mainFields: ['module', 'main'],
      extensions: ['.ts', '.tsx', '.js', '.json', '.less'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
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
          test: /\.css$/,
          use: [
            require.resolve('style-loader'),
            require.resolve('css-loader'),
          ],
        },
        {
          test: /\.module.less$/,
          use: [{
              loader: require.resolve('style-loader'),
            },
            {
              loader: require.resolve('css-loader'),
              options: {
                sourceMap: false,
                modules: {
                  localIdentName: "[local]___[hash:base64:5]"
                }
              }
            },
            {
              loader: require.resolve('less-loader'),
              options: {
                lessOptions: {
                  javascriptEnabled: true,
                }
              }
            }
          ]
        },
        {
          test: /^(?!.*\.module\.less$).*\.less$/,
          use: [
            require.resolve('style-loader'),
            require.resolve('css-loader'),
            {
              loader: require.resolve('less-loader'),
              options: {
                lessOptions: {
                  javascriptEnabled: true,
                }
              }
            },
          ],
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
          use: [{
            loader: require.resolve('file-loader'),
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/'
            }
          }]
        },
      ],
    },
    externals: {
      'react': 'React',
      'react-dom': 'ReactDOM',
      'sumi-browser': 'sumi-browser',
    },
    performance: {
      hints: false,
    },
    output: {
      filename: 'index.js',
      path: path.join(extensionDir, 'out', 'browser'),
      libraryTarget: 'umd',
    },
    devtool: false,
    plugins: [
    ],
  };

  return merge(defaultConfig, restConfig);
}

export function createWorkerDefaults(extConfig: ExtensionBundleConfig) {
  const { extensionDir, ...restConfig } = extConfig;
  let defaultConfig: webpack.Configuration = {
    target: 'webworker',
    resolve: {
      mainFields: ['module', 'main'],
      extensions: ['.ts', '.js'],
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
      vscode: 'vscode',
      sumi: 'sumi',
      'sumi-worker': 'sumi-worker'
    },
    performance: {
      hints: false,
    },
    output: {
      filename: 'index.js',
      path: path.join(extensionDir, 'out', 'worker'),
      libraryTarget: 'commonjs',
    },
    devtool: false,
    plugins: [
      new DefinePlugin({ WEBWORKER: JSON.stringify(true) }),
    ],
  };

  return merge(defaultConfig, restConfig);
}
