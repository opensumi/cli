import * as opensumi from "sumi";   // opensumi node API (extends vscode)

export function activate(context: opensumi.ExtensionContext) {
  const { componentProxy, registerExtendModuleService } = context;

  registerExtendModuleService({
    async sayHello() {
      await componentProxy.Leftview.updateTitle('Hello OpenSumi Extension');
      await opensumi.layout.toggleBottomPanel();
      return "Hello OpenSumi Extension";
    }
  });
}
