#!/usr/bin/env node
const chalk = require('chalk');
const program = require('commander');
const semver = require('semver');
const { zip, install, update } = require('@alipay/cloud-ide-ext-vscode-extension-builder');
const packageConfig = require('../package');
const checkVersion = require('../lib/checkVersion');

program.version(packageConfig.version).usage('<command> [options]');

// output help information on unknown commands
program.arguments('<command>').action((cmd) => {
  program.outputHelp();
  console.log(chalk.red(`Unknown command ${chalk.yellow(cmd)}`));
  console.log();
});

program
  .command('init')
  .description('init a new extension powered by kaitian')
  .on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ kaitian init');
  })
  .action(async () => {
    if (process.argv.slice(2).length > 1) {
      program.outputHelp();
      process.exit(0);
    }

    try {
      // eslint-disable-next-line global-require
      await require('../command/init')();
    }  catch (err) {
      console.error('kaitian init error:', err);
      process.exit(1);
    }
  });

program
  .command('zip [sourceDir] [targetDir] [ignoreFile]')
  .description('build a Zip file')
  .action((...args) => zip(...args).then(console.log('build completed...')));

program
  .command('install <name> <id> <version> <extensionDir>')
  .description('installing a extension')
  .action((...args) => install(...args).then(console.log('installation completed...')));

program
  .command('update')
  .description('upgrade the extension')
  .action((...args) => update(...args).then(console.log('upgrade completed...')));

// add some useful info on help
program.on('--help', () => {
  console.log();
  console.log(
    `  Run ${chalk.cyan('kaitian <command> --help')} for detailed usage of given command.`
  );
  console.log();
});

program.commands.forEach((c) => c.on('--help', () => console.log()));

program.parse(process.argv);

(async () => {
  // check node version
  checkNodeVersion();

  try {
    // check kaitian version
    await checkKaitianVersion();
  } catch (error) {
    console.log(error);
  }
})();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

function camelize(str) {
  return str.replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

// commander passes the Command object itself as options,
// extract only actual options into a fresh object.
function cleanArgs(cmd) {
  const args = {};
  if (cmd) {
    cmd.options.forEach((o) => {
      const key = camelize(o.long.replace(/^--/, ''));
      // if an option is not present and Command has a method with the same name
      // it should not be copied
      if (typeof cmd[key] !== 'function' && typeof cmd[key] !== 'undefined') {
        args[key] = cmd[key];
      }
    });
    if (cmd.parent && cmd.parent.rawArgs) {
      args.command = cmd.parent.rawArgs[2];
    }
  }
  return args;
}

function checkNodeVersion() {
  if (!semver.satisfies(process.version, packageConfig.engines.node)) {
    console.log();
    console.log(
      chalk.red(
        `You must upgrade node to ${packageConfig.engines.node} to use kaitian`
      )
    );
    console.log();
    process.exit(1);
  }
}

async function checkKaitianVersion() {
  const packageName = 'kaitian';
  const packageVersion = packageConfig.version;
  const latestVersion = await checkVersion(packageName, packageVersion);
  if (latestVersion) {
    console.log(`  latest:     + ${chalk.yellow(latestVersion)}`);
    console.log(`  installed:  + ${chalk.red(packageVersion)} \n`);
    console.log(`  how to update: ${chalk.red('npm install kaitian@latest -g')} \n`);
  }
}
