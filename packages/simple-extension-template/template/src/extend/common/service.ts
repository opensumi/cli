
export interface INodeService {
  sayHello(): Promise<string>;
}

export const HELLO_COMMAND = 'HelloOpenSumi';
