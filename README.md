# OpenSumi CLI

🛠️ Standard Tooling for OpenSumi Extensions Development

## Develop

```base
$ npm install
$ npm run dev
```

Test command on the local:

```bash
$ ./packages/cli/bin/sumi.js <command> [options]
```

## Install

```
$ npm install @opensumi/cli -g
```

## Usage

```
$ sumi init opensumi-ext-demo
$ cd opensumi-ext-demo
$ npm run watch
$ sumi dev
```

## Commands

```md
Usage: sumi <command> [options]

Options:
  -V, --version                                          output the version number
  -h, --help                                             output usage information

Commands:
  init                                                   init a new extension powered by OpenSumi
  watch                                                  watch extension in development mode
  dev [options]                                          launch OpenSumi IDE load specified extension.
  compile                                                compile extension in production mode
  package [options]                                      Packages an extension
  install <publisher> <name> <version> [extensionDir]    installing a extension
  engine                                                 OpenSumi cli engine management
    add <version>                                        download and install a [version]
    remove <version>                                     remove specific [version] engine
    use  <version>                                       change current engine to [version]
    ls                                                   list installed engine versions
    ls-remote                                            list remote engine versions available for install
    current                                              display currently selected version

Run sumi <command> --help for detailed usage of given command.
```

## Use the specified OpenSumi version

1. List the remote engine version
```
$ sumi engine ls-remote

2.22.10-rc-1679037411.0   rc
              -> 2.23.0   latest
```

2. Add expected version

```
$ sumi engine add 2.23.0
```

## License

MIT
