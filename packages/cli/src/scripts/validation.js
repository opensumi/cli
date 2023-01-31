const semver = require('semver');
const parseSemver = require('parse-semver');

// eslint-disable-next-line no-useless-escape
// 支持 @ali/@alipay 前缀的包，只需要首次在 marketplace 创建包名时不带前缀即可
const nameRegex = /^(@.+\/)?[a-z0-9][a-z0-9\-]*$/i;
function validatePublisher(publisher) {
  if (!publisher) {
    throw new Error(
      `缺少 Publisher name，请检查 package.json 中是否包含 publisher 字段`,
    );
  }
  if (!nameRegex.test(publisher)) {
    throw new Error(
      `无效的 Publisher name '${publisher}'. Expected the identifier of a publisher, not its human-friendly name.  Learn more: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publishing-extensions`,
    );
  }
}
exports.validatePublisher = validatePublisher;
function validateExtensionName(name) {
  if (!name) {
    throw new Error(`Missing extension name`);
  }
  if (!nameRegex.test(name)) {
    throw new Error(`Invalid extension name '${name}'`);
  }
}
exports.validateExtensionName = validateExtensionName;
function validateVersion(version) {
  if (!version) {
    throw new Error(`Missing extension version`);
  }
  if (!semver.valid(version)) {
    throw new Error(`Invalid extension version '${version}'`);
  }
}
exports.validateVersion = validateVersion;
function validateEngineCompatibility(version) {
  if (!version) {
    throw new Error(`Missing vscode or sumi engine compatibility version`);
  }
  // eslint-disable-next-line no-useless-escape
  if (!/^\*$|^(\^|>=)?((\d+)|x)\.((\d+)|x)\.((\d+)|x)(\-.*)?$/.test(version)) {
    throw new Error(`Invalid vscode engine compatibility version '${version}'`);
  }
}
exports.validateEngineCompatibility = validateEngineCompatibility;
/**
 * User shouldn't use a newer version of @types/vscode than the one specified in engines.vscode
 */
function validateVSCodeTypesCompatibility(engineVersion, typeVersion) {
  if (engineVersion === '*') {
    return;
  }
  if (!typeVersion) {
    throw new Error(`Missing @types/vscode version`);
  }
  let plainEngineVersion; let plainTypeVersion;
  try {
    const engineSemver = parseSemver(`vscode@${engineVersion}`);
    plainEngineVersion = engineSemver.version;
  } catch (err) {
    throw new Error('Failed to parse semver of engines.vscode');
  }
  try {
    const typeSemver = parseSemver(`@types/vscode@${typeVersion}`);
    plainTypeVersion = typeSemver.version;
  } catch (err) {
    throw new Error('Failed to parse semver of @types/vscode');
  }
  // For all `x`, use smallest version for comparison
  plainEngineVersion = plainEngineVersion.replace(/x/g, '0');
  const [typeMajor, typeMinor, typePatch] = plainTypeVersion
    .split('.')
    .map(x => {
      try {
        // eslint-disable-next-line radix
        return parseInt(x);
      } catch (err) {
        return 0;
      }
    });
  const [engineMajor, engineMinor, enginePatch] = plainEngineVersion
    .split('.')
    .map(x => {
      try {
        // eslint-disable-next-line radix
        return parseInt(x);
      } catch (err) {
        return 0;
      }
    });
  const error = new Error(
    `@types/vscode ${typeVersion} greater than engines.vscode ${engineVersion}. Consider upgrade engines.vscode or use an older @types/vscode version`,
  );
  if (
    typeof typeMajor === 'number' &&
    typeof engineMajor === 'number' &&
    typeMajor > engineMajor
  ) {
    throw error;
  }
  if (
    typeof typeMinor === 'number' &&
    typeof engineMinor === 'number' &&
    typeMinor > engineMinor
  ) {
    throw error;
  }
  if (
    typeof typePatch === 'number' &&
    typeof enginePatch === 'number' &&
    typePatch > enginePatch
  ) {
    throw error;
  }
}
exports.validateVSCodeTypesCompatibility = validateVSCodeTypesCompatibility;
