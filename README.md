# OpenSumi CLI

🛠️ Standard Tooling for OpenSumi Extensions Development

## Install

```
$ npm install @opensumi/cli -g
```

#### Quick Start
```
$ sumi init opensumi-ext-demo
$ cd opensumi-ext-demo
$ npm run watch
$ sumi dev
```

## Usage

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

   2.1.0
-> 2.20.0   latest
```

2. Add expected version

```
$ sumi engine add 2.20.0
```

## License

MIT
