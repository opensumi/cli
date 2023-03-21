import * as sumi from 'sumi';   // sumi node API (extends vscode)
import { HELLO_COMMAND } from '../common/service';

export function activate(context: sumi.ExtensionContext) {
  const { componentProxy, registerExtendModuleService } = context;

  registerExtendModuleService({
    async sayHello() {
      await componentProxy.Leftview.updateTitle('Hello sumi Extension');
      sumi.commands.executeCommand(HELLO_COMMAND);
      return 'Hello sumi Extension';
    }
  });
}
