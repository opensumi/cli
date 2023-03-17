import path from 'path';
import os from 'os';

export const npmClient = process.env.NPM_CLIENT || 'npm';

export const enginePkgName = '@opensumi/cli-engine';

export const defaultTemplatePkg = '@opensumi/simple-extension-template';

export const templateConfigFile = 'sumi-template.config.js';

export const opensumiInfraDir = path.resolve(os.homedir(), '.sumi-cli');

export const configYmlPath = path.resolve(opensumiInfraDir, 'config.yml');

export const marketplaceApiAddress = '';

export const marketplaceAccountId = '';

export const marketplaceMasterKey = '';
