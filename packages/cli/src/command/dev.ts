import path from 'path';
import cp from 'child_process';
import * as fse from 'fs-extra';
import WebSocket from 'ws';

import shellPath from 'shell-path';
import { Command } from 'clipanion';

import { engineModule } from './engine';
import chalk from 'chalk';
import { isO2Executable } from '../util/helper';

function dev(args: any) {
  const isDebugger = !!args.debug;
  const executable = !!args.execute;
  const workspaceDir = args.workspaceDir || process.cwd();
  const extensionCandidate = args.extensionDir || process.cwd();
  const serverPort = args.serverPort || 50999;

  let argv = [
    `--workspacePath=${workspaceDir}`,
    isDebugger && `--isDev=1`,
  ];

  if (isDebugger) {
    console.log(`Will start extension debug mode.`);
  }

  const extensionDevPaths: string[] = extensionCandidate.split(",");

  if (executable) {
    console.log(`Executable path: ${args.execute}`);
    //
    // extensionCandidate 在 electron 版本中用于为不同项目区分插件类型
    // 为避免两者冲突，在 electron 下使用新的 extensionDevelopmentPath 字段
    // 通过 argv 指定的 extensionCandidate 仅标识为内置插件
    // 而 extensionDevelopmentPath 则标识为开发模式插件
    //
    argv = argv.concat(extensionDevPaths.map((p) => `--extensionDevelopmentPath=${p}`));

    if (isO2Executable(args.execute)) {
      // O2 Cli: o2 /path/to/workspace
      argv[0] = workspaceDir;
    }

    const options = {
      env: { ...process.env },
      maxBuffer: 10240 * 2048,
    };

    if (options.env.KTELECTRON) {
      delete options.env.KTELECTRON;
    }

    if (isDebugger) {
      options.env.IS_DEV = '1';
    }

    console.log(`cli args: ${argv.join(' ')}`);
    const electronProcess = cp.execFile(args.execute, argv, options);
    if (electronProcess.stdout) {
      electronProcess.stdout.addListener('data', (e) => {
        console.log(e.toString().slice(0, -1));
      });
    }

    electronProcess.on('exit', (code, signal) => {
      console.log(`${args.execute} exited, code ${code}, signal ${signal}`);
    });

    electronProcess.on('error', (err) => {
      console.log(err.message);
    });

    process.on('exit', () => {
      electronProcess.kill('SIGKILL');
    });
  } else {
    // TODO: 获取当前插件的 engine 版本号
    // DEBUG_ENGINE_PATH 为本地开发调试 engine 时使用
    const currentEnginePath = process.env.DEBUG_ENGINE_PATH || engineModule.currentEnginePath;
    const nodeServerJsPath = path.join(currentEnginePath, 'node/index.js');
    const extHostedJsPath = path.join(currentEnginePath, 'hosted/ext.process.js');

    console.log(
      chalk.blue(
        `Staring with engine: ${process.env.DEBUG_ENGINE_PATH ? `debug engine ${currentEnginePath}` : engineModule.current}`
      )
    );

    console.log('🚗 -- 🏎️ -- 🚅 -- 🚄 -- 🚁 -- 🛩️ -- 🚀');

    const wss = new WebSocket.Server({ port: 50768 });
    wss.on('connection', (ws) => {
      ws.send('ping');

      ws.on('close', (code, reason) => {
        console.log('client closed', code, reason);
      });
    });

    function onDidExtensionFileChange(event: string, filename: string) {
      wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event, filename }));
        }
      });
    }

    const watchers = extensionDevPaths.map((extension) => {
      console.log(`Start watching ${extension}...`);

      return fse.watch(path.join(extension, 'src'), { recursive: true }, (event: string, filename: string) => {
        onDidExtensionFileChange(event, filename);
      });
    });

    //
    // cli engine 版本依旧使用 extensionCandidate，避免使用新的字段造成版本不兼容问题
    //
    const extensionCandidateStr = extensionDevPaths.map((p: string) => `--extensionCandidate=${p}`);
    argv = argv.concat([
      `--serverPort=${serverPort}`,
      `--workspaceDir=${workspaceDir}`,
      `--extHostPath=${extHostedJsPath}`,
      `--watchServerPort=${50768}`,
      ...extensionCandidateStr,
    ]);

    console.log("Start OpenSumi Process", "argv", argv.join(" "));

    const options = {
      env: {
        ...process.env,
        PATH: shellPath.sync(),
        VSCODE_NLS_CONFIG: process.env.VSCODE_NLS_CONFIG,
      },
    };

    // 去除 KTELECTRON 环境变量，避免误识别为桌面版
    // @ts-ignore
    if (options.env.KTELECTRON) {
      // @ts-ignore
      delete options.env.KTELECTRON;
    }

    const serverProcess = cp.fork(nodeServerJsPath, argv, options);

    serverProcess.on("exit", (code, signal) => {
      console.log(`${code}, ${signal}`);
      wss.close();
      watchers.forEach(watcher => {
        watcher.close();
      });
    });

    serverProcess.on("error", message => {
      console.log(message.message.slice(0, -1));
      watchers.forEach(watcher => {
        watcher.close();
      });
    });

    process.on('exit', () => {
      serverProcess.kill('SIGKILL');
      wss.close();
      watchers.forEach(watcher => {
        watcher.close();
      });
    });
    if (serverProcess.stdout || serverProcess.stdin) {
      serverProcess.stdout!.on("data", chunk => {
        console.log(`${chunk.toString().slice(0, -1)}`);
      });
      serverProcess.stderr!.on("error", err => {
        console.log(`${err.message.slice(0, -1)}`);
      });
    }
  }
}

export class DevCommand extends Command {
  static usage = Command.Usage({
    description: 'launch OpenSumi IDE load specified extension',
    details: `
    This command helps you load extension via launching OpenSumi IDE.
    - If the \`-d,--debug\` flag is set, debug mode will be enabled.
    - The \`-p,--serverPort\` option is used to set OpenSumi IDE server port.
    - The \`-w,--workspaceDir\` option is used to set workspace path (default is the current directory).
    - The \`-e,--extensionDir\` option is used to set extension folder path (default is the current directory), support to specify multiple plug-ins, separated by commas.
    - The \`--execute\` option is used to set OpenSumi IDE executable file directory.
    `,
  });

  @Command.Boolean('-d,--debug')
  public debug = false;

  @Command.String('-p,--serverPort')
  public serverPort!: number;

  @Command.String('-w,--workspaceDir')
  public workspaceDir!: string;

  @Command.String('-e,--extensionDir')
  public extensionDir!: string;

  @Command.String('--execute')
  public exec!: string;

  @Command.Path('dev')
  async execute() {
    dev({
      debug: this.debug,
      serverPort: this.serverPort,
      workspaceDir: this.workspaceDir,
      extensionDir: this.extensionDir,
      execute: this.exec,
    });
  }
}
