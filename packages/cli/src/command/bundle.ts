import { Command } from 'clipanion';
import webpack from 'webpack';
import * as cp from 'child_process';
import * as fse from 'fs-extra';
import * as path from 'path';
import formatWebpackMessages from 'react-dev-utils/formatWebpackMessages';

import parallelRunPromise from '../scripts/parallel-run-promise';
import getExtensionWebpackConfig from '../config/webpack/webpack.config.extension';
import getBrowserWebpackConfig from '../config/webpack/webpack.config.browser';
import getWebpackNodeConfig from '../config/webpack/webpack.config.node';
import getWorkerWebpackConfig from '../config/webpack/webpack.config.worker';
import { getExtPkgContent } from '../util/extension';

async function getDefaultWebpackConfigs() {
  const pkgContent = await getExtPkgContent();
  const browserEntry = path.join(process.cwd(), 'src/extend/browser/index.ts');
  const nodeEntry = path.join(process.cwd(), 'src/extend/node/index.ts');
  const vscodeEntry = path.join(process.cwd(), 'src/extension.ts');
  const workerEntry = path.join(process.cwd(), 'src/extend/worker/index.ts');

  return [
    fse.pathExistsSync(browserEntry) && getBrowserWebpackConfig,
    fse.pathExistsSync(nodeEntry) && getWebpackNodeConfig,
    fse.pathExistsSync(vscodeEntry) && getExtensionWebpackConfig,
    fse.pathExistsSync(workerEntry) && getWorkerWebpackConfig,
  ]
    .filter(n => n)
    .map(fn => fn({ cwd: process.cwd(), pkgContent }));
}

type CompilerMethod = 'run' | 'watch';

function doWebpackTasks(webpackConfigs: webpack.Configuration[], compilerMethod: CompilerMethod, options?: RunTaskOptions) {
  return webpackConfigs.map(webpackConfig => {
    return async () => {
      await runTask(webpackConfig, compilerMethod, options);
    };
  });
}

function toWebpackConfig(configs: { [config: string]: webpack.Configuration }) {
  return Object.keys(configs).map((key) => configs[key]);
}

type RunTaskOptions = {
  onSuccess?: () => void;
  useCustomConfig?: boolean;
}

async function bundle(compilerMethod: CompilerMethod, options?: RunTaskOptions) {
  let bundleTasks: (() => Promise<void>)[] = [];
  if (options && options.useCustomConfig) {
    const webpackConfigPath = path.join(process.cwd(), 'kaitian-webpack.config.js');
    if (!(await fse.pathExists(webpackConfigPath))) {
      throw new Error(`请确保 ${process.cwd()} 目录下包含自定义 webpack 配置`);
    }
    const customWebpackConfig = require(webpackConfigPath);
    bundleTasks = doWebpackTasks(toWebpackConfig(customWebpackConfig), compilerMethod);
  } else {
    const webpackConfigs = await getDefaultWebpackConfigs();
    bundleTasks = doWebpackTasks(webpackConfigs, compilerMethod);
  }

  await parallelRunPromise(bundleTasks, 1);
}

function runTask(webpackConfig: any, compilerMethod: CompilerMethod, options?: RunTaskOptions) {
  return new Promise((resolve, reject) => {
    const compiler = webpack(
      compilerMethod === 'watch' ?
      Object.assign(webpackConfig, { devtool: 'source-map', mode: 'development' }) :
      webpackConfig
    );

    const callback = (err: Error, stats: any) => {
      if (err) {
        console.error('WEBPACK', err.stack || err.toString());
        reject(err);
        return;
      }

      console.info(
        'KAITIAN',
        stats.toString({
          assets: true,
          colors: true,
          chunks: false,
          entrypoints: false,
          modules: false,
        }),
      );

      const json = stats.toJson({}, true);
      const messages = formatWebpackMessages(json);
      const isSuccessful = !messages.errors.length && !messages.warnings.length;

      if (isSuccessful) {
        // @ts-ignore
        if (stats.stats) {
          console.info('KAITIAN', 'Compiled successfully');
        } else {
          console.info(
            'KAITIAN',
            `Compiled successfully in ${(json.time / 1000).toFixed(1)}s!`,
          );
        }
        options && options.onSuccess();
      } else if (messages.errors.length) {
        console.log(messages.errors.join('\n\n'));
      } else if (messages.warnings.length) {
        console.warn('KAITIAN', 'Compiled with warnings.');
        console.log(messages.warnings.join('\n\n'));
      }

      resolve({ stats });
    };

    if (compilerMethod === 'run') {
      compiler.run(callback);
    }

    if (compilerMethod === 'watch') {
      compiler.watch({}, callback);
    }
  });
}

export class WatchCommand extends Command {
  static usage = Command.Usage({
    description: 'watch extension in development mode',
    examples: [
      [
        'Run watch mode when developing a kaitian extension project',
        'kaitian watch',
      ],
    ],
  });

  @Command.String('--onSuccess')
  public onSuccessShell?: string;
  @Command.Boolean('--config')
  public config: boolean = false;

  @Command.Path('watch')
  async execute() {
    try {
      await bundle('watch', {
        onSuccess: () => this.onSuccessShell && cp.exec(this.onSuccessShell),
        useCustomConfig: this.config,
      });
    } catch (err) {
      console.error('kaitian watch error:', err);
      process.exit(1);
    }
  }
}

export class CompileCommand extends Command {
  static usage = Command.Usage({
    description: 'compile extension in production mode',
    examples: [
      [
        'Compile code when developing a kaitian extension project',
        'kaitian compile',
      ],
    ],
  });

  @Command.Boolean('--config')
  public config: boolean = false;

  @Command.Path('compile')
  async execute() {
    try {
      await bundle('run', {
        useCustomConfig: this.config,
      });
    } catch (err) {
      console.error('kaitian watch error:', err);
      process.exit(1);
    }
  }
}
