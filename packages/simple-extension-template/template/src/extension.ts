// You can also replace `vscode` as `sumi`.
import * as vscode from 'vscode';
import { HELLO_COMMAND } from './extend/common/service';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(HELLO_COMMAND, async () => {
      vscode.window.showInformationMessage('Hello OpenSumi');
    })
  );
}

export function deactivate() {}
