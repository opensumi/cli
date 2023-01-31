import * as path from 'path';
import * as fs from 'fs';
import importFresh from 'import-fresh'
import stripComments from 'strip-json-comments'

const configFilenames = [
  'sumi.config.js',
  'sumi.config.cjs',
  'sumi.config.json',
  'package.json',
];

interface Config {
  webAssets?: string[];
}

export function loadConfig(): Config {
  for (const filename of configFilenames) {
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      const configData = loadConfigFile(filePath);
      if (configData) {
        return configData;
      }
    }
  }
  return {};
}

export function loadConfigFile(filePath: string) {
  try {
    const extname = path.extname(filePath)
    switch (extname) {
      case '.js':
      case '.cjs':
        return importFresh(filePath);

      case '.json':
        const jsonData = JSON.parse(stripComments(fs.readFileSync(filePath, 'utf-8')));
        if (path.basename(filePath) === 'package.json') {
          return jsonData.kaitianConfig;
        }
        return jsonData;

      default:
        throw new Error(`Not support extname ${extname} to loadConfigFile`);
    }
  } catch (e) {
    e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
    throw e;
  }
}
