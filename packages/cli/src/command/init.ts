import path from 'path';
import fs from 'fs';
import { Command } from 'clipanion';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import execa from 'execa';
import copy from 'kopy';

import { npmClient, opensumiInfraDir, defaultTemplatePkg, templateConfigFile } from '../const';

type PureInitOptions = {
  templateData: string
  targetPath: string,
  targetTemplatePkg: string,
}

const fsPromise = fs.promises;

const spinner = ora();

const templateDir = path.resolve(opensumiInfraDir, 'template');

async function ensurePkgJSONFile(targetDir: string) {
  if (!fs.existsSync(targetDir)) {
    await fsPromise.mkdir(targetDir);
  }

  const targetPkgJSONPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(targetPkgJSONPath)) {
    return;
  }
  const json = JSON.stringify({
    name: '@opensumi/extension-template',
  }, null, 2);
  await fsPromise.writeFile(targetPkgJSONPath, json, 'utf8');
}

function logMsg() {
  console.log(`
    Extension initialization succeeded
    Execute the following commands to start extension development:

    ${chalk.yellow('  npm install')}
    ${chalk.yellow('  npm run watch')}

    Compile extension.
    ${chalk.yellow('  npm run compile')}

    Package extension.
    ${chalk.yellow('  sumi package')}

    Happy hacking!
  `);
}

export async function pureInit(pureInitOptions: PureInitOptions) {
  const {
    targetPath,
    targetTemplatePkg,
    templateData: templateDataStr = '',
  } = pureInitOptions;

  const templateData = templateDataStr.split('&').reduce((pre: any, curStr: string) => {
    const [key, value] = curStr.split('=');
    return {
      ...pre,
      [key]: value
    }
  } , {})
  await ensurePkgJSONFile(templateDir)

  await execa.commandSync(`${npmClient} i ${targetTemplatePkg} -S`, { cwd: templateDir });

  try {
    const targetTemplatePath = path.resolve(templateDir, 'node_modules', targetTemplatePkg);
    const { move } = require(path.resolve(targetTemplatePath, templateConfigFile));

    const targetDir = targetPath || process.cwd();

    await copy(path.resolve(targetTemplatePath, 'template'), targetDir, {
      data: templateData,
      move,
    })
  } catch(err) {
    console.log(err.stack)
  }
}

// opensumi init --name {name} --displayName {displayName} --publisher {publisher}
async function init(targetPath: string, targetTemplatePkg: string) {
  await ensurePkgJSONFile(templateDir);
  spinner.start(`Downloading template package ${targetTemplatePkg}`);
  // TODO: fetch latest version for package and update when necessary
  await execa.commandSync(`${npmClient} i ${targetTemplatePkg} -S`, { cwd: templateDir });
  spinner.succeed('Done!');

  try {
    const targetTemplatePath = path.resolve(templateDir, 'node_modules', targetTemplatePkg);
    const { questions, move } = require(path.resolve(targetTemplatePath, templateConfigFile));

    const answers = await inquirer.prompt<any>(questions);

    const targetDir = targetPath || process.cwd();

    await copy(path.resolve(targetTemplatePath, 'template'), targetDir, {
      data: answers,
      move,
    });
    logMsg();
  } catch (err) {
    console.log(err.stack);
  }
}

export class InitCommand extends Command {
  static usage = Command.Usage({
    description: 'init a new extension powered by opensumi',
    examples: [
      [
        'Initialize a opensumi extension project in target-folder',
        'cd target-folder && sumi init',
      ],
    ],
  });

  @Command.String('--scaffold')
  public scaffold = defaultTemplatePkg;

  @Command.String({ required: false })
  public targetDir?: string;

  get realTargetDir() {
    if (this.targetDir) {
      if (this.targetDir === '.') {
        return process.cwd();
      } else if (this.targetDir.startsWith('..')) {
        return path.join(process.cwd(), this.targetDir);
      }
      return this.targetDir;
    }

    return process.cwd();
  }
  @Command.String('--targetPath')
  public targetPath?: string = this.realTargetDir;

  @Command.String('--templateData')
  public templateData?: string;

  @Command.Path('init')
  async execute() {

    const isPureInit = [
      this.templateData,
    ].every(filed => !!filed);

    try {
      isPureInit
      ? (await pureInit({
        templateData: this.templateData,
        targetPath: this.targetPath,
        targetTemplatePkg: this.scaffold,
      } as PureInitOptions))
      : (await init(this.realTargetDir, this.scaffold));
    } catch (err) {
      console.error('sumi init error:', err);
      process.exit(1);
    }
  }
}
