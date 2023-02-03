# OpenSumi CLI

A simple CLI for develop OpenSumi extension.

--------------------

## Install

```
$ npm install @opensumi/cli -g
```

## Example

#### Add cli engine
```
$ sumi engine ls-remote

   2.1.0
-> 2.1.1   latest
```

```
$ sumi engine add <version>

Engine@v<version> was installed
```

#### Start Development
```
$ mkdir opensumi-ext-demo && cd opensumi-ext-demo
$ sumi init
$ npm run watch
$ sumi dev
```

## Usage

```md
Usage: sumi <command> [options]

Options:
  -V, --version                                        output the version number
  -h, --help                                           output usage information

Commands:
  init                                                 init a new extension powered by OpenSumi
  watch                                                watch extension in development mode
  dev [options]                                        launch OpenSumi IDE load specified extension.
  compile                                              compile extension in production mode
  package [options]                                    Packages an extension
  install <publisher> <name> <version> [extensionDir]  installing a extension
  engine                                               OpenSumi cli engine management
    add <version>                                      download and install a [version]
    remove <version>                                   remove specific [version] engine
    use  <version>                                     change current engine to [version]
    ls                                                 list installed engine versions
    ls-remote                                          list remote engine versions available for install
    current                                            display currently selected version
  Run sumi <command> --help for detailed usage of given command.
```

## License

MIT
