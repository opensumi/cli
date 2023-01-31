import { Cli } from 'clipanion';
import chalk from 'chalk';
import semver from 'semver';

import { opensumiInfraDir } from './const';
import { ensureDirSync } from './util/fs';
import { DevCommand } from './command/dev';
import { InitCommand } from './command/init';
import { LoginCommand } from './command/login';
import { PackageCommand } from './command/package';
import { PublishCommand } from './command/publish';
import { HelpCommand, VersionCommand } from './command/help';
import { WatchCommand, CompileCommand } from './command/bundle';
import { EngineUninstallCommand, EngineLsCommand, EngineLsRemoteCommand, EngineCurrentCommand, EngineUseCommand, EngineInstallCommand, engineModule } from './command/engine';

const pkg = require('../package.json');

(async () => {
  // check node version
  checkNodeVersion();
  preJobs();
})();

const cli = new Cli({
  binaryLabel: 'OpenSumi Extension Development Utility',
  binaryName: 'sumi',
  binaryVersion: pkg.version,
});

[
  InitCommand,
  DevCommand,
  CompileCommand,
  WatchCommand,
  PackageCommand,
  EngineLsCommand,
  EngineLsRemoteCommand,
  EngineCurrentCommand,
  EngineUseCommand,
  EngineInstallCommand,
  EngineUninstallCommand,
  HelpCommand,
  VersionCommand,
  // PublishCommand,
  // LoginCommand,
].forEach((command) => {
  cli.register(command);
});

cli.runExit(process.argv.slice(2), Cli.defaultContext);

function checkNodeVersion() {
  if (!semver.satisfies(process.version, pkg.engines.node)) {
    console.log(
      `\n`,
      chalk.red(
        `You must upgrade node to ${pkg.engines.node} to use OpenSumi Cli`,
      ),
      `\n`,
    );
    process.exit(1);
  }
}

function preJobs() {
  ensureDirSync(opensumiInfraDir);
}
