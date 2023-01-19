import path from 'path';
import os from 'os';

export const npmClient = 'npm';

export const enginePkgName = '@opensumi/opensumi-cli-engine';

export const defaultTemplatePkg = '@opensumi/simple-extension-template';

export const templateConfigFile = 'opensumi-template.config.js';

export const opensumiInfraDir = path.resolve(os.homedir(), '.opensumi-cli');

export const marketplaceApiAddress = '';

export const configYmlPath = path.resolve(opensumiInfraDir, 'config.yml');

export const marketplaceAccountId = '';

export const marketplaceMasterKey = '';
