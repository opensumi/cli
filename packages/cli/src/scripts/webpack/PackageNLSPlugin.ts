import webpack from 'webpack';
import * as path from 'path';
import * as fs from 'fs-extra';

function getNlsBundleFileName(language: string) {
  return `nls.bundle.${language}.json`;
}

function getPackageJsonNlsFileName(language: string) {
  return `package.nls.${language}.json`;
}

const NLS_METADATA_FILENAME = 'nls.metadata.json';

const PACKAGE_JSON_NLS = 'package.i18n.json';

const I18N_SUFFIX = '.i18n.json';

export class PackageNLSPlugin {
  constructor(private outDir: string) {
  }

  apply(compiler: webpack.Compiler): void {
    compiler.hooks.emit.tap('NLSBundlePlugin', (compilation) => {
      const projectRoot = path.join(process.cwd());
      const i18nBase = path.join(projectRoot, 'i18n');

      if (!fs.pathExistsSync(i18nBase)) {
        return;
      }

      if (
        !compilation.assets[NLS_METADATA_FILENAME] ||
        compilation.assets[NLS_METADATA_FILENAME].size() === 0
      ) {
        // 没有生成 nls.metadata.json
        return;
      }

      //
      // 先读取 nls.metadata.json 中的内容作为 fallback，生成 nls.bundle.json
      //
      try {
        const metadata = JSON.parse(compilation.assets[NLS_METADATA_FILENAME].source().toString('utf-8'));
        const defaultBundle = {};

        for (const key of Object.keys(metadata)) {
          defaultBundle[key] = metadata[key].messages;
        }

        const rawDefaultBundle = JSON.stringify(defaultBundle);
        // @ts-ignore
        // 生成 nls.bundle.json
        compilation.assets['nls.bundle.json'] = {
          source: () => rawDefaultBundle,
          size: () => rawDefaultBundle.length,
        };

        const languageBundleKeys = fs.readdirSync(i18nBase);

        // 遍历目录生成 nls.bundle.{language}.json
        for (const language of languageBundleKeys) {
          const languageBundle = {};

          const absolutePath = path.join(i18nBase, language);
          const packageNlsFilePath = path.join(absolutePath, PACKAGE_JSON_NLS);

          for (const relativePath of Object.keys(metadata)) {
            if(!languageBundle[relativePath]) {
              languageBundle[relativePath] = [];
            }
            
            const rawKeys = metadata[relativePath].keys;
            const i18nFilePath = path.join(absolutePath, this.outDir, `${relativePath}${I18N_SUFFIX}`);

            //
            // 根据 nls.metadata.json 中的 key 拼接 i18n 文件路径
            //
            if (fs.existsSync(i18nFilePath)) {
              try {
                const content = fs.readJSONSync(i18nFilePath);
                for(const key of rawKeys) {
                  languageBundle[relativePath].push(content[key]);
                }
              } catch(err) {
                console.error(`Read ${i18nFilePath} err`, err);
                return;
              }
            }
          }

          // 将 i18n/{language} 下的 package.nls.json copy 到根目录 package.nls.{language}.json
          if (fs.existsSync(packageNlsFilePath)) {
            try {
              fs.copyFileSync(packageNlsFilePath, path.join(projectRoot, getPackageJsonNlsFileName(language)));
            } catch(err) {
              console.error(`Copy ${packageNlsFilePath} err`, err);
              return;
            }
          }

          const fileName = getNlsBundleFileName(language);
          const rawBundle = JSON.stringify(languageBundle);
          // @ts-ignore
          compilation.assets[fileName] = {
            source: () => rawBundle,
            size: () => rawBundle.length,
          };
        }
      } catch (err) {
        console.error('Bundle nls file error', err);
      }

    });
  }
}
