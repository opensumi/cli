import { ClientApp, IClientAppOpts } from '@ali/ide-core-browser';
import { Injector } from '@ali/common-di';

export async function renderApp(opts: IClientAppOpts) {
  const { hostname } = window.location;
  const specificIp = [
    '0.0.0.0',
    '127.0.0.1',
    'localhost',
  ].every(n => n !== hostname);

  const guessedConfig = {} as any;
  if (!specificIp) {
    const port = (window as any).KAITIAN_SDK_CONFIG.port;

    guessedConfig.wsPath = `ws://${hostname}:${port}`;
    guessedConfig.staticServicePath = `http://${hostname}:${port}`;
    guessedConfig.webviewEndpoint = `http://${hostname}:${port}/webview`;
  };

  const injector = new Injector();
  const extensions: string[] = [...(window as any).KAITIAN_SDK_CONFIG.extensionCandidate].filter(Boolean);
  opts.extensionCandidate = extensions.map((e) => ({ path: e, isBuiltin: true }));
  opts.workspaceDir = (window as any).KAITIAN_SDK_CONFIG.ideWorkspaceDir;
  opts.coreExtensionDir = (window as any).KAITIAN_SDK_CONFIG.extensionDir;
  opts.extensionDir = (window as any).KAITIAN_SDK_CONFIG.extensionDir;
  
  opts.wsPath = guessedConfig.wsPath || (window as any).KAITIAN_SDK_CONFIG.wsPath;
  opts.staticServicePath = guessedConfig.staticServicePath || (window as any).KAITIAN_SDK_CONFIG.staticServicePath;
  opts.webviewEndpoint = guessedConfig.webviewEndpoint || (window as any).KAITIAN_SDK_CONFIG.webviewEndpoint;

  opts.extWorkerHost = './worker-host.js';

  opts.injector = injector;
  const app = new ClientApp(opts);

  console.log(opts, 'opts');

  await app.start(document.getElementById('main')!, 'web');
}
