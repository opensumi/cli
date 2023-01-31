import { PublishCommand } from '../../src/command/publish';
import { runCli } from '../utils';
import path from 'path';

describe('sumi publish', () => {

  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules() // most important - it clears the cache
    process.env = { ...OLD_ENV }; // make a copy
  });

  afterAll(() => {
    process.env = OLD_ENV; // restore old env
  });

  it('publish extension', async () => {
    expect(await runCli(() => [PublishCommand], [
      'publish',
      '--file', path.join(__dirname, '../features/extension.zip'),
    ])).toMatch(/name: test/);
  });

  it('publish extension with message', async () => {
    expect(await runCli(() => [PublishCommand], [
      'publish',
      '--file', path.join(__dirname, '../features/extension.zip'),
      '--message', 'this is message',
    ])).toMatch(/name: test/);
  });

  it('publish extension with engine', async () => {
    expect(await runCli(() => [PublishCommand], [
      'publish',
      '--file', path.join(__dirname, '../features/extension.zip'),
      '--engine', '>=1.38.0',
    ])).toMatch(/name: test/);
  });

  it('publish extension without ak will throw error', async () => {
    process.env.KT_EXT_ACCOUNT_ID = '';
    process.env.KT_EXT_MASTER_KEY = '';
    expect(await runCli(() => [PublishCommand], [
      'publish',
      '--file', path.join(__dirname, '../features/extension.zip'),
    ])).toMatch(/not found ak/);
  });

  it('publish extension with privateToken', async () => {
    process.env.KT_EXT_ACCOUNT_ID = '';
    process.env.KT_EXT_MASTER_KEY = '';
    expect(await runCli(() => [PublishCommand], [
      'publish',
      '--file', path.join(__dirname, '../features/extension.zip'),
      '--publisher', 'testgroup',
      '--privateToken', 'VAMvlA-Ni3imexl8-zMwRcLM',
    ])).toMatch(/publisher: testgroup/);
  });

  it('publish extension with name', async () => {
    expect(await runCli(() => [PublishCommand], [
      'publish',
      '--file', path.join(__dirname, '../features/extension.zip'),
      '--name', 'test2',
    ])).toMatch(/name: test2/);
  });
})
