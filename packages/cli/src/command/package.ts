// @ts-nocheck
import { Command } from 'clipanion';
import { buildWebAssetsMeta, validateMeta, rmMeta } from './../util/analysis'

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const _ = require('lodash');
const yazl = require('yazl');
const glob = require('glob');
const minimatch = require('minimatch');
const denodeify = require('denodeify');
const url = require('url');
const mime = require('mime');
const urljoin = require('url-join');
const nlsCore = require('../scripts/nls');
const util = require('../scripts/utils');
const validation = require('../scripts/validation');
const npm = require('../scripts/npm');

const readFile = denodeify(fs.readFile);
const unlink = denodeify(fs.unlink);
const stat = denodeify(fs.stat);
const exec = denodeify(cp.exec, (err, stdout, stderr) => [
  err,
  { stdout, stderr },
]);
const promiseifyGlob = denodeify(glob);
const resourcesPath = path.join(path.dirname(__dirname), '..', 'resources');
const vsixManifestTemplatePath = path.join(
  resourcesPath,
  'extension.vsixmanifest',
);
const contentTypesTemplatePath = path.join(
  resourcesPath,
  '[Content_Types].xml',
);
const MinimatchOptions = { dot: true };
function read(file) {
  if (file.contents) {
    return Promise.resolve(file.contents).then(b =>
      typeof b === 'string' ? b : b.toString('utf8'),
    );
  } else {
    return readFile(file.localPath, 'utf8');
  }
}
exports.read = read;
class BaseProcessor {
  constructor(manifest) {
    this.manifest = manifest;
    this.assets = [];
    this.vsix = Object.create(null);
  }

  onFile(file) {
    return Promise.resolve(file);
  }

  onEnd() {
    return Promise.resolve(null);
  }
}
exports.BaseProcessor = BaseProcessor;
function getUrl(url) {
  if (!url) {
    return null;
  }
  if (typeof url === 'string') {
    return url;
  }
  return url.url;
}
function getRepositoryUrl(url) {
  const result = getUrl(url);
  // eslint-disable-next-line no-useless-escape
  if (/^[^\/]+\/[^\/]+$/.test(result)) {
    return `https://github.com/${result}.git`;
  }
  return result;
}
// Contributed by Mozilla develpoer authors
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function toExtensionTags(extensions) {
  return extensions
    .map(s => s.replace(/\W/g, ''))
    .filter(s => !!s)
    .map(s => `__ext_${s}`);
}
function toLanguagePackTags(translations, languageId) {
  return (translations || [])
    .map(({ id }) => [`__lp_${id}`, `__lp-${languageId}_${id}`])
    .reduce((r, t) => [...r, ...t], []);
}
/* This list is also maintained by the Marketplace team.
 * Remember to reach out to them when adding new domains.
 */
const TrustedSVGSources = [
  'api.bintray.com',
  'api.travis-ci.com',
  'api.travis-ci.org',
  'app.fossa.io',
  'badge.buildkite.com',
  'badge.fury.io',
  'badge.waffle.io',
  'badgen.net',
  'badges.frapsoft.com',
  'badges.gitter.im',
  'badges.greenkeeper.io',
  'cdn.travis-ci.com',
  'cdn.travis-ci.org',
  'ci.appveyor.com',
  'circleci.com',
  'cla.opensource.microsoft.com',
  'codacy.com',
  'codeclimate.com',
  'codecov.io',
  'coveralls.io',
  'david-dm.org',
  'deepscan.io',
  'dev.azure.com',
  'docs.rs',
  'flat.badgen.net',
  'gemnasium.com',
  'githost.io',
  'gitlab.com',
  'godoc.org',
  'goreportcard.com',
  'img.shields.io',
  'isitmaintained.com',
  'marketplace.visualstudio.com',
  'nodesecurity.io',
  'opencollective.com',
  'snyk.io',
  'travis-ci.com',
  'travis-ci.org',
  'visualstudio.com',
  'vsmarketplacebadge.apphb.com',
  'www.bithound.io',
  'www.versioneye.com',
];
function isHostTrusted(host) {
  return TrustedSVGSources.indexOf(host.toLowerCase()) > -1;
}
function isGitHubRepository(repository) {
  return /^https:\/\/github\.com\/|^git@github\.com:/.test(repository || '');
}
class ManifestProcessor extends BaseProcessor {
  constructor(manifest) {
    super(manifest);
    const flags = ['Public'];
    if (manifest.preview) {
      flags.push('Preview');
    }
    const repository = getRepositoryUrl(manifest.repository);
    const isGitHub = isGitHubRepository(repository);
    let enableMarketplaceQnA;
    let customerQnALink;
    if (manifest.qna === 'marketplace') {
      enableMarketplaceQnA = true;
    } else if (typeof manifest.qna === 'string') {
      customerQnALink = manifest.qna;
    } else if (manifest.qna === false) {
      enableMarketplaceQnA = false;
    }
    this.vsix = {
      ...this.vsix,
      id: manifest.name,
      displayName: manifest.displayName || manifest.name,
      version: manifest.version,
      publisher: manifest.publisher,
      engine: manifest.engines.kaitian,
      description: manifest.description || '',
      categories: (manifest.categories || []).join(','),
      flags: flags.join(' '),
      links: {
        repository,
        bugs: getUrl(manifest.bugs),
        homepage: manifest.homepage,
      },
      galleryBanner: manifest.galleryBanner || {},
      badges: manifest.badges,
      githubMarkdown: manifest.markdown !== 'standard',
      enableMarketplaceQnA,
      customerQnALink,
      extensionDependencies: _(manifest.extensionDependencies || [])
        .uniq()
        .join(','),
      extensionPack: _(manifest.extensionPack || [])
        .uniq()
        .join(','),
      localizedLanguages:
        manifest.contributes && manifest.contributes.localizations
          ? manifest.contributes.localizations
            .map(
              loc =>
                loc.localizedLanguageName ||
                loc.languageName ||
                loc.languageId,
            )
            .join(',')
          : '',
    };
    if (isGitHub) {
      this.vsix.links.github = repository;
    }
  }

  async onEnd() {
    // just pack
  }
}
class TagsProcessor extends BaseProcessor {
  onEnd() {
    const keywords = this.manifest.keywords || [];
    const contributes = this.manifest.contributes;
    const activationEvents = this.manifest.activationEvents || [];
    const doesContribute = name =>
      contributes && contributes[name] && contributes[name].length > 0;
    const colorThemes = doesContribute('themes')
      ? ['theme', 'color-theme']
      : [];
    const iconThemes = doesContribute('iconThemes')
      ? ['theme', 'icon-theme']
      : [];
    const snippets = doesContribute('snippets') ? ['snippet'] : [];
    const keybindings = doesContribute('keybindings') ? ['keybindings'] : [];
    const debuggers = doesContribute('debuggers') ? ['debuggers'] : [];
    const json = doesContribute('jsonValidation') ? ['json'] : [];
    const localizationContributions = (
      (contributes && contributes.localizations) ||
      []
    ).reduce(
      (r, l) => [
        ...r,
        `lp-${l.languageId}`,
        ...toLanguagePackTags(l.translations, l.languageId),
      ],
      [],
    );
    const languageContributions = (
      (contributes && contributes['languages']) ||
      []
    ).reduce(
      (r, l) => [
        ...r,
        l.id,
        ...(l.aliases || []),
        ...toExtensionTags(l.extensions || []),
      ],
      []
    );
    const languageActivations = activationEvents
      .map(e => /^onLanguage:(.*)$/.exec(e))
      .filter(r => !!r)
      .map(r => r[1]);
    const grammars = ((contributes && contributes['grammars']) || []).map(
      g => g.language,
    );
    const description = this.manifest.description || '';
    const descriptionKeywords = Object.keys(TagsProcessor.Keywords).reduce(
      (r, k) =>
        r.concat(
          new RegExp(`\\b(?:${escapeRegExp(k)})(?!\\w)`, 'gi').test(
            description,
          )
            ? TagsProcessor.Keywords[k]
            : [],
        ),
      [],
    );
    const tags = [
      ...keywords,
      ...colorThemes,
      ...iconThemes,
      ...snippets,
      ...keybindings,
      ...debuggers,
      ...json,
      ...localizationContributions,
      ...languageContributions,
      ...languageActivations,
      ...grammars,
      ...descriptionKeywords,
    ];
    this.vsix.tags = _(tags)
      .uniq() // deduplicate
      .compact() // remove falsey values
      .join(',');
    return Promise.resolve(null);
  }
}
exports.TagsProcessor = TagsProcessor;
TagsProcessor.Keywords = {
  git: ['git'],
  npm: ['node'],
  spell: ['markdown'],
  bootstrap: ['bootstrap'],
  lint: ['linters'],
  linting: ['linters'],
  react: ['javascript'],
  js: ['javascript'],
  node: ['javascript', 'node'],
  'c++': ['c++'],
  Cplusplus: ['c++'],
  xml: ['xml'],
  angular: ['javascript'],
  jquery: ['javascript'],
  php: ['php'],
  python: ['python'],
  latex: ['latex'],
  ruby: ['ruby'],
  java: ['java'],
  erlang: ['erlang'],
  sql: ['sql'],
  nodejs: ['node'],
  'c#': ['c#'],
  css: ['css'],
  javascript: ['javascript'],
  ftp: ['ftp'],
  haskell: ['haskell'],
  unity: ['unity'],
  terminal: ['terminal'],
  powershell: ['powershell'],
  laravel: ['laravel'],
  meteor: ['meteor'],
  emmet: ['emmet'],
  eslint: ['linters'],
  tfs: ['tfs'],
  rust: ['rust'],
};
class MarkdownProcessor extends BaseProcessor {
  constructor(manifest, name, regexp, assetType, options = {}) {
    super(manifest);
    this.name = name;
    this.regexp = regexp;
    this.assetType = assetType;
    const guess = this.guessBaseUrls();
    this.baseContentUrl = options.baseContentUrl || (guess && guess.content);
    this.baseImagesUrl =
      options.baseImagesUrl ||
      options.baseContentUrl ||
      (guess && guess.images);
    this.repositoryUrl = guess && guess.repository;
    this.isGitHub = isGitHubRepository(this.repositoryUrl);
  }

  async onFile(file) {
    const path = util.normalize(file.path);
    if (!this.regexp.test(path)) {
      return Promise.resolve(file);
    }
    this.assets.push({ type: this.assetType, path });
    let contents = await read(file);
    if (/This is the README for your extension /.test(contents)) {
      throw new Error(
        `Make sure to edit the README.md file before you package or publish your extension.`,
      );
    }
    // eslint-disable-next-line no-useless-escape
    const markdownPathRegex = /(!?)\[([^\]\[]*|!\[[^\]\[]*]\([^\)]+\))\]\(([^\)]+)\)/g;
    const urlReplace = (_, isImage, title, link) => {
      const isLinkRelative = !/^\w+:\/\//.test(link) && link[0] !== '#';
      if (!this.baseContentUrl && !this.baseImagesUrl) {
        const asset = isImage ? 'image' : 'link';
        if (isLinkRelative) {
          throw new Error(
            `Couldn't detect the repository where this extension is published. The ${asset} '${link}' will be broken in ${this.name}. Please provide the repository URL in package.json or use the --baseContentUrl and --baseImagesUrl options.`,
          );
        }
      }
      // eslint-disable-next-line no-param-reassign
      title = title.replace(markdownPathRegex, urlReplace);
      const prefix = isImage ? this.baseImagesUrl : this.baseContentUrl;
      if (!prefix || !isLinkRelative) {
        return `${isImage}[${title}](${link})`;
      }
      return `${isImage}[${title}](${urljoin(prefix, link)})`;
    };
    // Replace Markdown links with urls
    contents = contents.replace(markdownPathRegex, urlReplace);
    // Replace <img> links with urls
    contents = contents.replace(
      /<img.+?src=["']([/.\w\s-]+)['"].*?>/g,
      (all, link) => {
        const isLinkRelative = !/^\w+:\/\//.test(link) && link[0] !== '#';
        const prefix = this.baseImagesUrl;
        if (!prefix || !isLinkRelative) {
          return all;
        }
        return all.replace(link, urljoin(prefix, link));
      },
    );
    const markdownIssueRegex = /(\s|\n)([\w\d_-]+\/[\w\d_-]+)?#(\d+)\b/g;
    const issueReplace = (all, prefix, ownerAndRepositoryName, issueNumber) => {
      let result = all;
      let owner;
      let repositoryName;
      if (ownerAndRepositoryName) {
        [owner, repositoryName] = ownerAndRepositoryName.split('/', 2);
      }
      if (this.isGitHub) {
        if (owner && repositoryName && issueNumber) {
          // Issue in external repository
          const issueUrl = urljoin(
            'https://github.com',
            owner,
            repositoryName,
            'issues',
            issueNumber,
          );
          result =
            `${prefix}[${owner}/${repositoryName}#${issueNumber}](${issueUrl})`;
        } else if (!owner && !repositoryName && issueNumber) {
          // Issue in own repository
          result =
            `${prefix
            }[#${issueNumber}](${urljoin(
              this.repositoryUrl,
              'issues',
              issueNumber,
            )})`;
        }
      }
      return result;
    };
    // Replace Markdown issue references with urls
    contents = contents.replace(markdownIssueRegex, issueReplace);
    // $('img').each((_, img) => {
    // 	const src = decodeURI(img.attribs.src);
    // 	const srcUrl = url.parse(src);
    // 	if (/^data:$/i.test(srcUrl.protocol) && /^image$/i.test(srcUrl.host) && /\/svg/i.test(srcUrl.path)) {
    // 		throw new Error(`SVG data URLs are not allowed in ${this.name}: ${src}`);
    // 	}
    // 	if (!/^https:$/i.test(srcUrl.protocol)) {
    // 		throw new Error(`Images in ${this.name} must come from an HTTPS source: ${src}`);
    // 	}
    // 	if (/\.svg$/i.test(srcUrl.pathname) && !isHostTrusted(srcUrl.host)) {
    // 		throw new Error(`SVGs are restricted in ${this.name}; please use other file image formats, such as PNG: ${src}`);
    // 	}
    // });
    // $('svg').each(() => {
    // 	throw new Error(`SVG tags are not allowed in ${this.name}.`);
    // });
    return {
      path: file.path,
      contents: Buffer.from(contents, 'utf8'),
    };
  }

  // GitHub heuristics
  guessBaseUrls() {
    let repository = null;
    if (typeof this.manifest.repository === 'string') {
      repository = this.manifest.repository;
    } else if (
      this.manifest.repository &&
      typeof this.manifest.repository['url'] === 'string'
    ) {
      repository = this.manifest.repository['url'];
    }
    if (!repository) {
      return null;
    }
    const regex = /github\.com\/([^/]+)\/([^/]+)(\/|$)/;
    const match = regex.exec(repository);
    if (!match) {
      return null;
    }
    const account = match[1];
    const repositoryName = match[2].replace(/\.git$/i, '');
    return {
      content: `https://github.com/${account}/${repositoryName}/blob/master`,
      images: `https://github.com/${account}/${repositoryName}/raw/master`,
      repository: `https://github.com/${account}/${repositoryName}`,
    };
  }
}
exports.MarkdownProcessor = MarkdownProcessor;
class ReadmeProcessor extends MarkdownProcessor {
  constructor(manifest, options = {}) {
    super(
      manifest,
      'README.md',
      /^extension\/readme.md$/i,
      'Microsoft.VisualStudio.Services.Content.Details',
      options,
    );
  }
}
exports.ReadmeProcessor = ReadmeProcessor;
class ChangelogProcessor extends MarkdownProcessor {
  constructor(manifest, options = {}) {
    super(
      manifest,
      'CHANGELOG.md',
      /^extension\/changelog.md$/i,
      'Microsoft.VisualStudio.Services.Content.Changelog',
      options,
    );
  }
}
exports.ChangelogProcessor = ChangelogProcessor;
class LicenseProcessor extends BaseProcessor {
  constructor(manifest) {
    super(manifest);
    this.didFindLicense = false;
    const match = /^SEE LICENSE IN (.*)$/.exec(manifest.license || '');
    if (!match || !match[1]) {
      this.filter = name => /^extension\/license(\.(md|txt))?$/i.test(name);
    } else {
      const regexp = new RegExp(`^extension/${match[1]}$`);
      this.filter = regexp.test.bind(regexp);
    }
    this.vsix.license = null;
  }

  onFile(file) {
    if (!this.didFindLicense) {
      let normalizedPath = util.normalize(file.path);
      if (this.filter(normalizedPath)) {
        if (!path.extname(normalizedPath)) {
          file.path += '.txt';
          normalizedPath += '.txt';
        }
        this.assets.push({
          type: 'Microsoft.VisualStudio.Services.Content.License',
          path: normalizedPath,
        });
        this.vsix.license = normalizedPath;
        this.didFindLicense = true;
      }
    }
    return Promise.resolve(file);
  }
}
class IconProcessor extends BaseProcessor {
  constructor(manifest) {
    super(manifest);
    this.didFindIcon = false;
    this.icon = manifest.icon ? `extension/${manifest.icon}` : null;
    this.vsix.icon = null;
  }

  onFile(file) {
    const normalizedPath = util.normalize(file.path);
    if (normalizedPath === this.icon) {
      this.didFindIcon = true;
      this.assets.push({
        type: 'Microsoft.VisualStudio.Services.Icons.Default',
        path: normalizedPath,
      });
      this.vsix.icon = this.icon;
    }
    return Promise.resolve(file);
  }

  onEnd() {
    if (this.icon && !this.didFindIcon) {
      return Promise.reject(
        new Error(
          `The specified icon '${this.icon}' wasn't found in the extension.`,
        ),
      );
    }
    return Promise.resolve(null);
  }
}
class NLSProcessor extends BaseProcessor {
  constructor(manifest) {
    super(manifest);
    this.translations = Object.create(null);
    if (
      !manifest.contributes ||
      !manifest.contributes.localizations ||
      manifest.contributes.localizations.length === 0
    ) {
      return;
    }
    const localizations = manifest.contributes.localizations;
    const translations = Object.create(null);
    // take last reference in the manifest for any given language
    for (const localization of localizations) {
      // eslint-disable-next-line no-restricted-syntax
      for (const translation of localization.translations) {
        if (translation.id === 'vscode' && !!translation.path) {
          const translationPath = util.normalize(
            // eslint-disable-next-line no-useless-escape
            translation.path.replace(/^\.[\/\\]/, ''),
          );
          translations[
            localization.languageId.toUpperCase()
          ] = `extension/${translationPath}`;
        }
      }
    }
    // invert the map for later easier retrieval
    for (const languageId of Object.keys(translations)) {
      this.translations[translations[languageId]] = languageId;
    }
  }

  onFile(file) {
    const normalizedPath = util.normalize(file.path);
    const language = this.translations[normalizedPath];
    if (language) {
      this.assets.push({
        type: `Microsoft.VisualStudio.Code.Translation.${language}`,
        path: normalizedPath,
      });
    }
    return Promise.resolve(file);
  }
}
exports.NLSProcessor = NLSProcessor;
class ValidationProcessor extends BaseProcessor {
  constructor() {
    // eslint-disable-next-line prefer-rest-params
    super(...arguments);
    this.files = new Map();
    this.duplicates = new Set();
  }

  async onFile(file) {
    const lower = file.path.toLowerCase();
    const existing = this.files.get(lower);
    if (existing) {
      this.duplicates.add(lower);
      existing.push(file.path);
    } else {
      this.files.set(lower, [file.path]);
    }
    return file;
  }

  async onEnd() {
    if (this.duplicates.size === 0) {
      return;
    }
    const messages = [
      `The following files have the same case insensitive path, which isn't supported by the VSIX format:`,
    ];
    for (const lower of this.duplicates) {
      for (const filePath of this.files.get(lower)) {
        messages.push(`  - ${filePath}`);
      }
    }
    throw new Error(messages.join('\n'));
  }
}
exports.ValidationProcessor = ValidationProcessor;
function validateManifest(manifest) {
  validation.validatePublisher(manifest.publisher);
  validation.validateExtensionName(manifest.name);
  if (!manifest.version) {
    throw new Error('Manifest missing field: version');
  }
  validation.validateVersion(manifest.version);
  if (!manifest.engines) {
    throw new Error('Manifest missing field: engines');
  }

  if (!manifest.engines['kaitian']) {
    throw new Error('Manifest missing field: engines.kaitian');
  }

  (manifest.badges || []).forEach(badge => {
    const decodedUrl = decodeURI(badge.url);
    const srcUrl = url.parse(decodedUrl);
    if (!/^https:$/i.test(srcUrl.protocol)) {
      throw new Error(
        `Badge URLs must come from an HTTPS source: ${badge.url}`,
      );
    }
    if (/\.svg$/i.test(srcUrl.pathname) && !isHostTrusted(srcUrl.host)) {
      throw new Error(
        `Badge SVGs are restricted. Please use other file image formats, such as PNG: ${badge.url}`,
      );
    }
  });
  Object.keys(manifest.dependencies || {}).forEach(dep => {
    if (dep === 'vscode') {
      throw new Error(
        `You should not depend on 'vscode' in your 'dependencies'. Did you mean to add it to 'devDependencies'?`,
      );
    }
  });
  return manifest;
}
exports.validateManifest = validateManifest;
function readManifest(cwd = process.cwd(), nls = true) {
  const manifestPath = path.join(cwd, 'package.json');
  const manifestNLSPath = path.join(cwd, 'package.nls.json');
  const manifest = readFile(manifestPath, 'utf8')
    .catch(() =>
      // eslint-disable-next-line prefer-promise-reject-errors
      Promise.reject(`Extension manifest not found: ${manifestPath}`),
    )
    .then(manifestStr => {
      try {
        return Promise.resolve(JSON.parse(manifestStr));
      } catch (e) {
        return Promise.reject(
          `Error parsing 'package.json' manifest file: not a valid JSON file.`,
        );
      }
    })
    .then(validateManifest);
  if (!nls) {
    return manifest;
  }
  const manifestNLS = readFile(manifestNLSPath, 'utf8')
    .catch(err =>
      err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve('{}'),
    )
    .then(raw => {
      try {
        return Promise.resolve(JSON.parse(raw));
      } catch (e) {
        return Promise.reject(
          `Error parsing JSON manifest translations file: ${manifestNLSPath}`,
        );
      }
    });
  return Promise.all([manifest, manifestNLS]).then(
    ([manifest, translations]) => {
      return nlsCore.patchNLS(manifest, translations);
    },
  );
}
exports.readManifest = readManifest;
function toVsixManifest(vsix) {
  return readFile(vsixManifestTemplatePath, 'utf8')
    .then(vsixManifestTemplateStr => _.template(vsixManifestTemplateStr))
    .then(vsixManifestTemplate => vsixManifestTemplate(vsix));
}
exports.toVsixManifest = toVsixManifest;
const defaultExtensions = {
  '.json': 'application/json',
  '.vsixmanifest': 'text/xml',
};
function toContentTypes(files) {
  const extensions = Object.keys(
    _.keyBy(files, f => path.extname(f.path).toLowerCase()),
  )
    .filter(e => !!e)
    .reduce((r, e) => ({ ...r, [e]: mime.lookup(e) }), {});
  const allExtensions = { ...extensions, ...defaultExtensions };
  const contentTypes = Object.keys(allExtensions).map(extension => ({
    extension,
    contentType: allExtensions[extension],
  }));
  return readFile(contentTypesTemplatePath, 'utf8')
    .then(contentTypesTemplateStr => _.template(contentTypesTemplateStr))
    .then(contentTypesTemplate => contentTypesTemplate({ contentTypes }));
}
exports.toContentTypes = toContentTypes;
const defaultIgnore = [
  '.vscodeignore',
  '.sumiignore',
  'package-lock.json',
  'yarn.lock',
  '.editorconfig',
  '.npmrc',
  '.yarnrc',
  '.gitattributes',
  '*.todo',
  'tslint.yaml',
  '.eslintrc*',
  '.babelrc*',
  '.prettierrc',
  'ISSUE_TEMPLATE.md',
  'CONTRIBUTING.md',
  'PULL_REQUEST_TEMPLATE.md',
  'CODE_OF_CONDUCT.md',
  '.github',
  '.travis.yml',
  'appveyor.yml',
  '**/.git/**',
  '**/*.vsix',
  '**/*.zip',
  '**/.DS_Store',
  '**/*.vsixmanifest',
  '**/.vscode-test/**',
];
function collectAllFiles(cwd, useYarn = false, dependencyEntryPoints, noProd) {
  return npm.getDependencies(cwd, useYarn, dependencyEntryPoints, noProd).then(deps => {
    const promises = deps.map(dep => {
      return promiseifyGlob('**', {
        cwd: dep,
        nodir: true,
        dot: true,
        ignore: 'node_modules/**',
      }).then(files =>
        files
          .map(f => path.relative(cwd, path.join(dep, f)))
          .map(f => f.replace(/\\/g, '/')),
      );
    });
    return Promise.all(promises).then(util.flatten);
  });
}
function resolveIgnoreFile(cwd) {
  if (fs.existsSync(path.join(cwd, '.sumiignore'))) {
    return path.join(cwd, '.sumiignore');
  } else if (fs.existsSync(path.join(cwd, '.vscodeignore'))) {
    return path.join(cwd, '.vscodeignore');
  } else {
    console.log(`
    为了优化构建性能，建议您在项目中创建 .sumiignore 文件排除运行时不必要的文件.
    `);
    return null;
  }
}
function collectFiles(cwd, useYarn = false, dependencyEntryPoints, _ignoreFile, noProd) {
  return collectAllFiles(cwd, useYarn, dependencyEntryPoints, noProd).then(files => {
    files = files.filter(f => !/\r$/m.test(f));
    const ignoreFile = _ignoreFile || resolveIgnoreFile(cwd);
    let ignoreFiles;
    if (ignoreFile) {
      ignoreFiles = readFile(
        ignoreFile || resolveIgnoreFile(cwd),
        'utf8',
      )
        .catch(err =>
          // eslint-disable-next-line no-nested-ternary
          err.code !== 'ENOENT'
            ? Promise.reject(err)
            : ignoreFile
              ? Promise.reject(err)
              : Promise.resolve(''),
        )
        // Parse raw ignore by splitting output into lines and filtering out empty lines and comments
        .then(rawIgnore =>
          rawIgnore
            .split(/[\n\r]/)
            .map(s => s.trim())
            .filter(s => !!s)
            .filter(i => !/^\s*#/.test(i)),
        )
        // Add '/**' to possible folder names
        .then(ignore => [
          ...ignore,
          ...ignore
            .filter(i => !/(^|\/)[^/]*\*[^/]*$/.test(i))
            .map(i => (/\/$/.test(i) ? `${i}**` : `${i}/**`)),
        ]);
    } else {
      ignoreFiles = Promise.resolve([]);
    }
    return (
      // Combine with default ignore list
      ignoreFiles
        .then(ignore => [...defaultIgnore, ...ignore, '!package.json'])
        // Split into ignore and negate list
        .then(
          ignore =>
					ignore.reduce<[string[], string[]]>(
						(r, e) => (!/^\s*!/.test(e) ? [[...r[0], e], r[1]] : [r[0], [...r[1], e]]),
						[[], []]
					),
        )
        .then(r => ({ ignore: r[0], negate: r[1] }))
        // Filter out files
        .then(({ ignore, negate }) =>
          files.filter(
            f =>
              !ignore.some(i => minimatch(f, i, MinimatchOptions)) ||
              negate.some(i => minimatch(f, i.substr(1), MinimatchOptions)),
          ),
        )
    );
  });
}
function processFiles(processors, files) {
  const processedFiles = files.map(file =>
    util.chain(file, processors, (file, processor) => processor.onFile(file)),
  );
  return Promise.all(processedFiles).then(files => {
    return util.sequence(processors.map(p => () => p.onEnd())).then(() => {
      const assets = _.flatten(processors.map(p => p.assets));
      const vsix = processors.reduce((r, p) => ({ ...r, ...p.vsix }), {
        assets,
      });
      return Promise.all([toVsixManifest(vsix), toContentTypes(files)]).then(
        result => {
          return [
            {
              path: 'extension.vsixmanifest',
              contents: Buffer.from(result[0], 'utf8'),
            },
            {
              path: '[Content_Types].xml',
              contents: Buffer.from(result[1], 'utf8'),
            },
            ...files,
          ];
        },
      );
    });
  });
}
exports.processFiles = processFiles;
function createDefaultProcessors(manifest, options = {}) {
  return [
    new ManifestProcessor(manifest),
    new TagsProcessor(manifest),
    new ReadmeProcessor(manifest, options),
    new ChangelogProcessor(manifest, options),
    new LicenseProcessor(manifest),
    new IconProcessor(manifest),
    new NLSProcessor(manifest),
    new ValidationProcessor(manifest),
  ];
}
exports.createDefaultProcessors = createDefaultProcessors;
function collect(manifest, options = {}) {
  const cwd = options.cwd || process.cwd();
  const useYarn = options.useYarn || false;
  const packagedDependencies = options.dependencyEntryPoints || undefined;
  const ignoreFile = options.ignoreFile || undefined;
  const processors = createDefaultProcessors(manifest, options);
  return collectFiles(cwd, useYarn, packagedDependencies, ignoreFile, options.noProd).then(
    fileNames => {
      const files = fileNames.map(f => ({
        path: `extension/${f}`,
        localPath: path.join(cwd, f),
      }));
      return processFiles(processors, files);
    },
  );
}
exports.collect = collect;
function writeZipFile(files, packagePath) {
  return unlink(packagePath)
    .catch(err =>
      err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(null),
    )
    .then(
      () =>
        new Promise((c, e) => {
          const zip = new yazl.ZipFile();
          files.forEach(f =>
            f.contents
              ? zip.addBuffer(
                typeof f.contents === 'string'
                  ? Buffer.from(f.contents, 'utf8')
                  : f.contents,
                f.path,
              )
              : zip.addFile(f.localPath, f.path),
          );
          zip.end();
          const zipStream = fs.createWriteStream(packagePath);
          zip.outputStream.pipe(zipStream);
          zip.outputStream.once('error', e);
          zipStream.once('error', e);
          zipStream.once('finish', () => c());
        }),
    );
}

function getDefaultPackageName(manifest) {
  // remove `@private` in package.json#name
  const name = manifest.name
    .replace(/^@(\w+)\/(.+)/, (_: any, p1: string, p2: string) => [p1, p2].join('-'));
  return `${manifest.publisher}-${name}-${manifest.version}.zip`;
}

async function prepublishOnly(cwd, manifest, useYarn = false) {

  // 如果没有 scripts 字段，则不处理
  if (!manifest.scripts) {
    return
  }

  const hasPrepublishOnlyScript = !!manifest.scripts['prepublishOnly']

  const hasPrepublishScript = !!manifest.scripts['prepublish']

  const hasVSCodePrepublishScript = !!manifest.scripts['vscode:prepublish']

  // 如果没有 prepublishOnly/prepublish/vscode:prepublish 脚本命令，则不处理
  if (!hasPrepublishOnlyScript && !hasPrepublishScript && !hasVSCodePrepublishScript) {
    return;
  }
  const npmScript = `${useYarn ? 'yarn' : 'npm'} run ${
    hasPrepublishOnlyScript ? 'prepublishOnly' :
    hasPrepublishScript ? 'prepublish': 'vscode:prepublish'
  }`;
  console.warn(
    `Executing prepublishOnly script '${
    useYarn ? 'yarn' : 'npm'
    } run prepublishOnly'...`,
  );
  const { stdout, stderr } = await exec(npmScript,
    { cwd, maxBuffer: 5000 * 1024 },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
}
async function getPackagePath(cwd, manifest, options = {}) {
  if (!options.packagePath) {
    return path.join(cwd, getDefaultPackageName(manifest));
  }
  try {
    const _stat = await stat(options.packagePath);
    if (_stat.isDirectory()) {
      return path.join(options.packagePath, getDefaultPackageName(manifest));
    } else {
      return options.packagePath;
    }
  } catch {
    return options.packagePath;
  }
}
async function pack(options = {}) {
  try {
    const cwd = options.cwd || process.cwd();
    await buildWebAssetsMeta();
    const manifest = await readManifest(cwd);
    if (!options.skipCompile) {
      await prepublishOnly(cwd, manifest, options.useYarn);
    }
    const files = await collect(manifest, options);
    await validateMeta();
    const jsFiles = files.filter(f => /\.js$/i.test(f.path));
    if (files.length > 5000 || jsFiles.length > 100) {
      console.log(
        `此插件由 ${files.length} 个文件组成，其中包含 ${jsFiles.length} 个 JavaScript 文件，出于性能原因，建议您仅打包必要运行文件，您还可以通过配置 .sumiignore 或 .vscodeignore 文件来排除不必要的文件`,
      );
    }
    const packagePath = await getPackagePath(cwd, manifest, options);
    await writeZipFile(files, path.resolve(packagePath));
    return { manifest, packagePath, files };
  } catch (e) {
    throw e
  } finally {
    // 删除临时生成的 meta 文件
    await rmMeta();
  }

}
exports.pack = pack;
async function packageCmd(options = {}) {
  const { packagePath, files } = await pack(options);
  const stats = await stat(packagePath);
  let size = 0;
  let unit = '';
  if (stats.size > 1048576) {
    size = Math.round(stats.size / 10485.76) / 100;
    unit = 'MB';
  } else {
    size = Math.round(stats.size / 10.24) / 100;
    unit = 'KB';
  }
  util.log.done(
    `Packaged: ${packagePath} (${files.length} files, ${size}${unit})`,
  );
}
exports.packageCommand = packageCmd;
/**
 * Lists the files included in the extension's package. Does not run prepublishOnly.
 */
function listFiles(
  cwd = process.cwd(),
  useYarn = false,
  packagedDependencies,
  ignoreFile,
) {
  return readManifest(cwd).then(() =>
    collectFiles(cwd, useYarn, packagedDependencies, ignoreFile),
  );
}
exports.listFiles = listFiles;
/**
 * Lists the files included in the extension's package. Runs prepublishOnly.
 */
function ls(
  cwd = process.cwd(),
  useYarn = false,
  packagedDependencies,
  ignoreFile,
) {
  return readManifest(cwd)
    .then(manifest => prepublishOnly(cwd, manifest, useYarn))
    .then(() => collectFiles(cwd, useYarn, packagedDependencies, ignoreFile))
    .then(files => files.forEach(f => console.log(`${f}`)));
}
exports.ls = ls;

export class PackageCommand extends Command {
  static usage = Command.Usage({
    description: 'launch Kaitian IDE load specified extension',
    details: `
    This command helps you load extension via launching Kaitian IDE.
    - If the \`--skipCompile\` flag is set, kaitian cli will skip run prepublishOnly to compile.
    - If the \`--yarn\` flag is set, kaitian cli will use yarn instead of npm.
    - The \`--ignoreFile\` option is used to set an alternative file for .sumiignore.
    - The \`-o, --out\` option is used to specify path for .vsix extension file output.
    `,
  });

  @Command.String('-o,--out')
  public out!: string;

  @Command.Boolean('--yarn')
  public yarn = false;

  @Command.String('--ignoreFile')
  public ignoreFile!: string;

  @Command.Boolean('--skipCompile')
  public skipCompile = false;

  @Command.String('--baseContentUrl')
  public baseContentUrl!: string;

  @Command.String('--baseImagesUrl')
  public baseImagesUrl!: string;

  @Command.Boolean('--no-prod')
  public noProd!: boolean = false;

  @Command.Path('package')
  async execute() {
    await packageCmd({
      packagePath: this.out,
      baseContentUrl: this.baseContentUrl,
      baseImagesUrl: this.baseImagesUrl,
      useYarn: this.yarn,
      ignoreFile: this.ignoreFile,
      skipCompile: this.skipCompile,
      noProd: this.noProd,
    });
  }
}
