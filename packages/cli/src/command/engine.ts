import path from 'path';
import fs from 'fs';

import execa from 'execa';
import chalk from 'chalk';
import rimraf from 'rimraf';
import ora from 'ora';
import { Command } from 'clipanion';
import inquirer from 'inquirer';
import semver from 'semver';

import { safeParseJson } from '../util/json';
import { ensureDir } from '../util/fs';

import { opensumiInfraDir, npmClient, enginePkgName } from '../const';
import { opensumiConfiguration } from '../config';

export const SUPPORTED_DISTTAGS = ['latest', 'rc', 'next'];
export const ENGINE_NAME = '@opensumi/cli-engine';

const fsPromise = fs.promises;

const engineDir = path.resolve(opensumiInfraDir, 'engines');

function getEngineFolderPath(version: string) {
  return path.join(engineDir, version);
}

async function updatePkgJSONFile(targetDir: string, version: string) {
  const pkgJsonDesc = {
    name: '@opensumi/engine',
    version,
    dependencies: {
      [enginePkgName]: version,
    }
  };
  const json = JSON.stringify(pkgJsonDesc, null, 2);
  const pkgJSONFilePath = path.join(targetDir, 'package.json');
  await fsPromise.writeFile(pkgJSONFilePath, json, 'utf8');
}

export function whenReady(target: any, propertyKey: string, desc: PropertyDescriptor) {
  const origin = target[propertyKey];
  desc.value = async function(...params: any[]) {
    await this['ready'];
    return await origin.apply(this, params);
  };
}

class EngineModule {
  protected ready: Promise<any>;

  constructor() {
    this.ready = this.init();
  }

  get currentEnginePath() {
    if (!this.current) {
      console.warn(chalk.yellow('Please install an engine firstly'));
      process.exit(1);
    }

    return path.join(engineDir, this.current, 'node_modules', enginePkgName, 'lib');
  }

  get current() {
    return opensumiConfiguration.content.engine || '';
  }

  set current(value: string) {
    const config = opensumiConfiguration.content;
    opensumiConfiguration.content = { ...config, engine: value };
  }

  @whenReady
  public async add(v?: string) {
    const version = await this.checkValidVersionStr(v);
    const engineDir = getEngineFolderPath(version);
    // 这里从完备性上来说还要检查 node_modules 和 package.json
    if (fs.existsSync(engineDir)) {
      console.log('Engine', version, 'was already installed');
      return;
    }
    if (!fs.existsSync(engineDir)) {
      await fsPromise.mkdir(engineDir);
    }
    const spinner = ora(`Adding ${ENGINE_NAME}@v${version}`).start();
    return this.installEngine(engineDir, version).then(async () => {
      spinner.succeed(`${ENGINE_NAME}@v${version} was installed`);
      if (!await this.getCurrent()) {
        await this.setCurrent(version);
      }
    }).catch(async () => {
      spinner.fail(`${ENGINE_NAME}@v${version} is invalid`);
      await fsPromise.rm(engineDir, {recursive: true});
    });
  }

  public async remove(v?: string) {
    const version = await this.checkValidVersionStr(v);
    const engineDir = getEngineFolderPath(version);
    if (!fs.existsSync(engineDir)) {
      console.warn('${ENGINE_NAME}@v', version, 'was not existed');
      return;
    }
    const spinner = ora(`Removing ${ENGINE_NAME}@v${version}`).start();
    await rimraf(engineDir);
    spinner.succeed(`${ENGINE_NAME}@v${version} was removed`);
    // 重新 init
    this.ready = this.init();
  }

  @whenReady
  public async list() {
    const engineList = await this.getInstalledEngines();
    const stdoutList = engineList
      .map(version => {
        let result = version;
        let color = 'blue';
        // installed mark
        if (this.current === version) {
          result = '-> ' + result;
          color = 'green';
        }
        return chalk[color](result.padStart(25))
      })
      .join('\n');
    console.log(stdoutList);
  }

  @whenReady
  public async listRemote() {
    const engineList = await this.getRemoteEngines() || [];
    const taggedVersion = await this.getTaggedVersions();
    const reversedTaggedVersionDesc = Object.keys(taggedVersion)
      .reduce((prev, distTag) => {
        const version = taggedVersion[distTag];
        prev[version] = (prev[version] || []).concat(distTag);
        return prev;
      }, {} as { [key: string]: string[] });

    // installed
    const installedEngineList = await this.getInstalledEngines();

    const stdoutList = engineList
      .map(version => {
        let result = version;
        let color: string = '';
        const distTags = reversedTaggedVersionDesc[version];
        // installed mark
        if (installedEngineList.includes(version)) {
          color = 'blue';
        }

        // installed mark
        if (this.current === version) {
          result = '-> ' + result;
          color = 'green';
        }

        result = result.padStart(25);

        // dist-tag mark
        if (Array.isArray(distTags) && distTags.length) {
          result = result + '   ' + distTags.join(',');
        }

        return color ? chalk[color](result) : result;
      })
      .join('\n');
    // installed
    // tagged
    console.log(stdoutList);
  }

  @whenReady
  public async use(v?: string) {
    const version = await this.checkEngineVersion(v);
    await this.setCurrent(version);
  }

  // memoized for 5s
  public async getInstalledEngines() {
    await ensureDir(opensumiInfraDir);
    await ensureDir(engineDir);
    const files = await fsPromise.readdir(engineDir);
    const fileNameList = await Promise.all(files.map(async (fileName) => {
      const filePath = path.join(engineDir, fileName);
      try {
        const stat = await fsPromise.stat(filePath);
        const hasNodeModuels = await fsPromise.stat(path.join(filePath, 'node_modules'));
        return stat.isDirectory() && hasNodeModuels ? fileName : '';
      } catch(e) {
        return '';
      }
    }));
    const engineVersionList = fileNameList
      .filter(n => !!n)
      .sort((v1, v2) => semver.compare(v1, v2));
    return engineVersionList;
  }

  public async getTaggedVersions() {
    const { stdout } = await execa(npmClient, ['dist-tag', 'ls', enginePkgName]);
    const result = stdout
      .split('\n')
      .reduce((prev, cur) => {
        if (cur.length) {
          const [ distTagStr, versionStr] = cur.split(':');
          const distTag = distTagStr.trim();
          const version = versionStr.trim();
          prev[distTag] = version;
        }
        return prev;
      }, {} as {
        [key: string]: string;
      });

    return result;
  }

  private async getCurrent() {
    return await opensumiConfiguration.getEngineVersion() || '';
  }

  private async setCurrent(value: string) {
    await opensumiConfiguration.updateContent({ engine: value });
    console.log(`Set v${value} as the current engine`);
  }

  private async installEngine(targetDir: string, version: string) {
    await updatePkgJSONFile(targetDir, version);
    await execa.commandSync(`${npmClient} install`, { cwd: targetDir });
  }

  private async init() {
    const engineList = await this.getInstalledEngines();
    if (!engineList.length) {
      console.warn('No engine installed');
      console.warn('Please exec `sumi engine add <version>`');
    }

    const config = await opensumiConfiguration.getContent();
    if (!config.engine || !engineList.includes(config.engine)) {
      // fallback to the first in engineList
      const current = engineList[0];
      await opensumiConfiguration.replaceContent({ ...config, engine: current });
      // console.warn(`We are using ${ENGINE_NAME}@v${current }`);
    }
  }

  private async getRemoteEngines(): Promise<string[] | undefined> {
    // check remote version in ${npmClient}
    const { stdout } = await execa(npmClient, ['view', enginePkgName, 'versions']);
    if (stdout.length) {
      // stdout looks like this: [ '16.12.0', '16.13.0' ]
      const versionList = safeParseJson<string[]>(stdout.replace(/\'/g, '"'));
      if (versionList) {
        return versionList.sort((v1, v2) => semver.compare(v1, v2));
      }
    }
    return undefined;
  }

  private async checkValidVersionStr(version?: string): Promise<string> {
    // empty checking
    if (!version) {
      throw new Error('Please input a valid version');
    }
    version = version.trim();
    if (SUPPORTED_DISTTAGS.includes(version)) {
      const versions = await this.getTaggedVersions();
      version = versions[version];
    }
    return version;
  }

  private async checkEngineVersion(v?: string): Promise<string> {
    let version = await this.checkValidVersionStr(v);

    // check installed versions
    const engineList = await this.getInstalledEngines();
    if (engineList.includes(version)) {
      return version;
    }

    // check remote version in ${npmClient}
    const versionList = await this.getRemoteEngines();
    if (!versionList) {
      throw new Error(`${npmClient} view ${enginePkgName} versions return empty result`);
    }

    if (!versionList.includes(version)) {
      throw new Error(`${enginePkgName}@${v} is invalid`);
    }

    console.log(chalk.yellow(`This version ${version} has not been installed locally`));
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>({
      type: 'confirm',
      name: 'confirm',
      message: `Download ${ENGINE_NAME}@v${version} now?`,
    });

    if (confirm) {
      await this.add(version);
    }

    return version;
  }
}

export const engineModule = new EngineModule();

export class EngineLsCommand extends Command {
  static usage = Command.Usage({
    description: 'List installed engine versions',
  });

  @Command.Path('engine', 'ls')
  async execute() {
    engineModule.list();
  }
}

export class EngineLsRemoteCommand extends Command {
  static usage = Command.Usage({
    description: 'List remote engine versions available for install',
  });

  @Command.Path('engine', 'ls-remote')
  async execute() {
    engineModule.listRemote();
  }
}

export class EngineCurrentCommand extends Command {
  static usage = Command.Usage({
    description: 'display currently selected version',
  });

  @Command.Path('engine', 'current')
  async execute() {
    console.log(engineModule.current);
  }
}

export class EngineUseCommand extends Command {
  static usage = Command.Usage({
    description: 'Change current engine to [version]',
  });

  @Command.String({ required: true })
  public version!: string;

  @Command.Path('engine', 'use')
  async execute() {
    await engineModule.use(this.version);
  }
}

export class EngineInstallCommand extends Command {
  static usage = Command.Usage({
    description: 'Download and install a [version]',
  });

  @Command.String()
  public version!: string;

  @Command.Path('engine', 'install')
  @Command.Path('engine', 'add')
  async execute() {
    await engineModule.add(this.version);
    await engineModule.use(this.version);
  }
}

export class EngineUninstallCommand extends Command {
  static usage = Command.Usage({
    description: 'Remove specific [version] engine',
  });

  @Command.String()
  public version!: string;

  @Command.Path('engine', 'uninstall')
  @Command.Path('engine', 'remove')
  async execute() {
    await engineModule.remove(this.version);
  }
}
