import os from 'os';
import lodash from 'lodash';
import qs from 'querystring';
import { Command } from 'clipanion';

import { marketplaceApiAddress } from '../const';
import { getExtPkgContent } from '../util/extension';
import { ITeamAccount, opensumiConfiguration } from '../config';

const yauzl = require('yauzl');
const formstream = require('formstream');

const chalk = require('chalk');
const urllib = require('urllib');

const { pack } = require('./package');

function readManifestFromPackage(packagePath) {
  return new Promise((c, e) => {
    yauzl.open(packagePath, (err, zipfile) => {
      if (err) {
        return e(err);
      }
      const onEnd = () => e(new Error('Manifest not found'));
      zipfile.once('end', onEnd);
      zipfile.on('entry', entry => {
        if (!/^extension\/package\.json$/i.test(entry.fileName)) {
          return;
        }
        zipfile.removeListener('end', onEnd);
        zipfile.openReadStream(entry, (err, stream) => {
          if (err) {
            return e(err);
          }
          const buffers:any = [];
          stream.on('data', buffer => buffers.push(buffer));
          stream.once('error', e);
          stream.once('end', () => {
            try {
              c(JSON.parse(Buffer.concat(buffers).toString('utf8')));
            } catch (err) {
              e(err);
            }
          });
        });
      });
    });
  });
}

export class PublishCommand extends Command {
  static usage = Command.Usage({
    description: 'publish the extension',
    details: `
    This command helps you publish your extension via CLI.
    - The \`--file\` option is used to publish the extension package located at the specified path.
    - The \`--ignoreFile\` option is used to set an alternative file for .sumiignore.
    - If the \`--skipCompile\` flag is set, OpenSumi CLI will skip run prepublishOnly to compile.
    `,
    examples: [
      [
        'Examples:',
        'sumi publish --file=./my-extension-1.0.0.zip.'
      ],
    ],
  });

  @Command.String('--file')
  public file!: string;

  @Command.Boolean('--skipCompile')
  public skipCompile = false;

  @Command.String('--ignoreFile')
  public ignoreFile!: string;

  @Command.String('--privateToken')
  public privateToken?: string;

  @Command.String('--publisher')
  public publisher?: string;

  @Command.String('--name')
  public name?: string;

  @Command.Boolean('--useYarn')
  public useYarn = false;

  @Command.String('--message')
  public message?: string;

  @Command.String('--engine')
  public engine?: string;

  @Command.Path('publish')
  async execute() {
    const packageJson = await getExtPkgContent();

    await this.publish(this.file, {
      ignoreFile: this.ignoreFile,
      skipCompile: this.skipCompile,
      privateToken: this.privateToken,

      // 保留 --publisher
      publisher: this.publisher || lodash.get(packageJson, 'publisher'),
      name: this.name,
      useYarn: this.useYarn,
      message: this.message,
      engine: this.engine,
    });
  }

  private async publishToMarketplace(pkgContent, options) {
    const { name, publisher, message, engine } = options;
    const { packagePath, manifest } = pkgContent;
    this.success(`Uploading ${manifest.name} to marketplace...`);

    const form = formstream();
    form.file('file', packagePath);
    // 处理部分内部包带有 @ali/alipay 前缀导致 name 跟插件市场的 name 不一致的问题
    form.field('name', name || manifest.kaitianExtensionId || manifest.name);
    const headers = await this.getHeaders(options);

    if (!headers) {
      this.error('not found ak');
      return;
    }

    const query = qs.stringify({
      publisher,
      message,
      engine,
    });

    try {
      const res = await urllib.request(
        `${process.env.KT_EXT_ENDPOINT || marketplaceApiAddress}/extension/upload?${query}`,
        {
          method: 'POST',
          timeout: 2 * 60 * 1000,
          dataType: 'json',
          headers: {
            ...form.headers(),
            ...headers,
          },
          stream: form,
        },
      );

      if (res.status === 200) {
        this.success(`publisher: ${res.data.publisher}`);
        this.success(`name: ${res.data.name}`);
        this.success(`extensionReleaseId: ${res.data.extensionReleaseId}`);
        this.success('Done.');
      } else {
        this.error(res.data.error || res.data.message);
      }
    } catch (err) {
      this.error(err.message);
    }
  }

  private async publish(packagePath: string, options: {
    ignoreFile: string,
    skipCompile?: boolean,
    privateToken?: string,
    publisher?: string,
    name?: string,
    useYarn: boolean,
    message?: string,
    engine?: string,
  }) {
    const { ignoreFile, skipCompile, useYarn } = options;
    let promise;
    if (packagePath) {
      promise = readManifestFromPackage(packagePath).then(manifest => ({
        manifest,
        packagePath
      }));
    } else {
      const cwd = process.cwd();

      promise = getExtPkgContent().then(pkg => {
        return pack({
          cwd,
          packagePath: os.tmpdir(),
          useYarn,
          skipCompile,
          ignoreFile,
        });
      });
    }

    const pkgContent = await promise;
    await this.publishToMarketplace(pkgContent, options);
  }

  private async getHeaders(options) {
    const { privateToken, publisher } = options;

    const usePrivateTokenUpload = privateToken && publisher;

    if (usePrivateTokenUpload) {
      return {
        'x-private-token': privateToken,
      };
    }

    let teamAccount: ITeamAccount | undefined = undefined;
    if (process.env.KT_EXT_ACCOUNT_ID && process.env.KT_EXT_MASTER_KEY) {
      teamAccount = {
        accountId: process.env.KT_EXT_ACCOUNT_ID,
        masterKey: process.env.KT_EXT_MASTER_KEY,
      }
    } else {
      teamAccount = publisher && await opensumiConfiguration.getTeamAccount(publisher);
    }

    if (teamAccount) {
      return {
        'x-account-id': teamAccount.accountId,
        'x-master-key': teamAccount.masterKey,
      };
    }

  }

  private success(msg: string) {
    this.context.stdout.write(`${chalk.green(msg)}\n`);
  }

  private error(msg: string) {
    this.context.stderr.write(`${chalk.red(msg)}\n`);
  }
}
