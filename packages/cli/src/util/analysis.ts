import { get, uniq, flattenDeep } from 'lodash';
import { promisify, isFunction } from 'util';
import * as fs from 'fs';
import * as path from 'path';

import { safeParseJson } from './json';
import { loadConfig } from './load-config';

export const execBasePath = process.cwd();

export const metaFilePath = path.resolve(execBasePath, './sumi-meta.json');

export const useKeyPathDirect = Symbol('useKeyPath');

const isURL = (str: string): boolean => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

const touchedFiles: Set<string> = new Set();

export const ANALYSIS_ENTRY_LIST = [
  'package.json',
].map(entry => path.resolve(execBasePath, entry));

export const getIconAssetsFromIconThemeJSON = (themeDesc: any) => {
  const nextKey = 'path';
  if (Array.isArray(themeDesc)) {
    return flattenDeep(themeDesc.map(iconTheme => {
      const nextPath = iconTheme[nextKey];
      const nextMatch = "iconPath";
      const nextFile: string = fs.readFileSync(path.resolve(execBasePath, nextPath), 'utf-8');
      const nextDir = path.dirname(path.resolve(execBasePath, nextPath))
      const result = [...nextFile.matchAll(new RegExp(`"${nextMatch}":\\s*"(\\S+)"`, 'g'))].map(g => path.resolve(nextDir, g[1]))
      return [...result, path.resolve(execBasePath, nextPath)]
    }))
  }
}


export const ANALYSIS_FIELD_PATH: { [key: string]: string | symbol | Function } = ['contributes', 'kaitianContributes'].reduce((preResult, curPrefix) => ({
  ...preResult,
  [`${curPrefix}.iconThemes`]: getIconAssetsFromIconThemeJSON,
  [`${curPrefix}.productIconThemes`]: getIconAssetsFromIconThemeJSON,
  [`${curPrefix}.configuration`]: (value: any) => {
    const nextKey = 'properties.iconPath';
    if (Array.isArray(value)) {
      return flattenDeep(value.map(font => {
        return get(font, nextKey)
      }))
    }
  },
  [`${curPrefix}.grammars`]: 'path',
  [`${curPrefix}.themes`]: (value: any) => {
    const nextKey = 'path';
    if (Array.isArray(value)) {
      return value.filter(v => v[nextKey]).map(v => v[nextKey]);
    }
    return []
  },
  [`${curPrefix}.snippets`]: 'path',
  [`${curPrefix}.jsonValidation`]: 'url',
  [`${curPrefix}.browserMain`]: useKeyPathDirect,
  [`${curPrefix}.workerMain`]: useKeyPathDirect,
}), {})

const getAppendResource = (obj: any, dirPath: string): string[] => {
  const fields = ['include'];
  return fields.reduce((pre: string[], cur: string) => {
    const next = get(obj, cur);
    if (typeof next === 'undefined') {
      return pre;
    }
    return flattenDeep(pre.concat(path.resolve(dirPath, next)));
  }, [])
}

const analysisSingleFile = (filepath: string): string[] => {

  // 不是 json 就跳过
  if (!filepath || !filepath.includes('.json')) {
    return []
  }

  // 循环依赖
  if (touchedFiles.has(filepath)) {
    return [];
  }

  touchedFiles.add(filepath);

  const dirPath = path.dirname(filepath);

  const fileJsonObj = safeParseJson(fs.readFileSync(filepath, 'utf-8'));

  const appendPath = getAppendResource(fileJsonObj, dirPath);

  const appendResource: string[] = appendPath.concat(flattenDeep(appendPath.length === 0 ? [] : appendPath.map(p => analysisSingleFile(path.resolve(dirPath, p)))));

  return appendResource.concat(Object.keys(ANALYSIS_FIELD_PATH)
    .reduce((preResult: string[], curPickPath: string) => {

      const extraDesc = ANALYSIS_FIELD_PATH[curPickPath];

      const isFunctionPath = isFunction(extraDesc);
      const isArrayPath = !isFunctionPath && (extraDesc !== useKeyPathDirect);

      let result: string | string[];

      if (isFunctionPath) {
        result = (extraDesc as Function)(get(fileJsonObj, curPickPath))
        result = Array.isArray(result) ? result.concat(flattenDeep(result.map((file: string) => analysisSingleFile(file)))) : result
      } else if (isArrayPath) {
        result = get(fileJsonObj, curPickPath, []).filter((i: any) => i[extraDesc as string]).map((i: any) => i[extraDesc as string]);
      } else {
        result = get(fileJsonObj, curPickPath)
      }

      const skip = typeof result === 'undefined' || result.length === 0 || (Array.isArray(result) && result.filter(Boolean).length === 0);

      const rawPath2AbsolutePath = (p: string) => isURL(p) ? p : path.resolve(dirPath, p);

      return skip ? preResult : flattenDeep(preResult.concat(
        Array.isArray(result)
          ? (result as string[]).map((p) => rawPath2AbsolutePath(p))
          : [rawPath2AbsolutePath(result as string)]
      ))
    }, []));
}

const replaceAbsolutePath2relative = (str: string) => {
  return isURL(str) ? str : path.relative(execBasePath, str);
}

export const validateMeta = async () => {
  const metaJSON = safeParseJson(await promisify(fs.readFile)(metaFilePath, 'utf-8')) || {};

  const webAssets: string[] = metaJSON["web-assets"];

  const notExists: string[] = [];

  for (const assetPath of webAssets) {
    if (isURL(assetPath)) {
      continue;
    }
    if (!await promisify(fs.exists)(assetPath)) {
      notExists.push(assetPath)
    }
  }

  if (notExists.length > 0) {
    throw Error(`assets not exist:
      \t${notExists.join('\n\t')}
    `)
  }
  return true;
}


// main
export const buildWebAssetsMeta = async () => {

  const initialPaths = [
    path.resolve(execBasePath, 'package.json')
  ]

  const { webAssets } = loadConfig() || {};
  const customPaths = (Array.isArray(webAssets) ? webAssets : [])
    .filter(p => p && typeof p === 'string')
    .map(p => isURL(p) ? p : path.resolve(p));

  const result = uniq(initialPaths.concat(customPaths).concat(flattenDeep( await Promise.all(ANALYSIS_ENTRY_LIST.map(filePath => analysisSingleFile(filePath)))))
    .map(p => replaceAbsolutePath2relative(p)));

  const preFileContent = await (async () => {
    try {
      const fileStr = await promisify(fs.readFile)(metaFilePath, 'utf-8');
      return safeParseJson(fileStr);
    } catch {
      return {};
    }
  })();

  await promisify(fs.writeFile)(metaFilePath, JSON.stringify({
    ...preFileContent,
    "web-assets": result
  }, null, 2))
}


export const rmMeta = async () => {
  if(await promisify(fs.exists)(metaFilePath)) {
    await promisify(fs.unlink)(metaFilePath)
  }
}
