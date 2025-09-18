import fs from 'fs/promises';
import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from '../../utils.js';

export default testSuite(({ describe }) => {
  describe('Provider CLI flags', async ({ test }) => {
    const { fixture, lazycommit } = await createFixture({
      files: {
        'test.txt': 'test content',
      },
    });

    const configPath = path.join(fixture.path, '.lazycommit');

    // Set up a basic API key for testing
    await lazycommit(['config', 'set', 'GROQ_API_KEY=gsk_test123']);

    await test('--provider flag updates config', async () => {
      await lazycommit(['--provider', 'openrouter'], {
        reject: false,
      });

      const configFile = await fs.readFile(configPath, 'utf8');
      expect(configFile).toMatch('provider=openrouter');

      const get = await lazycommit(['config', 'get', 'provider']);
      expect(get.stdout).toBe('provider=openrouter');
    });

    await test('--model flag updates config', async () => {
      await lazycommit(['--model', 'anthropic/claude-3.5-sonnet'], {
        reject: false,
      });

      const configFile = await fs.readFile(configPath, 'utf8');
      expect(configFile).toMatch('model=anthropic/claude-3.5-sonnet');

      const get = await lazycommit(['config', 'get', 'model']);
      expect(get.stdout).toBe('model=anthropic/claude-3.5-sonnet');
    });

    await test('short flags work', async () => {
      await lazycommit(['-p', 'groq', '-m', 'llama-3.1-70b-versatile'], {
        reject: false,
      });

      const configFile = await fs.readFile(configPath, 'utf8');
      expect(configFile).toMatch('provider=groq');
      expect(configFile).toMatch('model=llama-3.1-70b-versatile');
    });

    await test('multiple flags can be set together', async () => {
      await lazycommit(['--provider', 'openrouter', '--model', 'openai/gpt-4o'], {
        reject: false,
      });

      const configFile = await fs.readFile(configPath, 'utf8');
      expect(configFile).toMatch('provider=openrouter');
      expect(configFile).toMatch('model=openai/gpt-4o');
    });

    await fixture.rm();
  });
});
