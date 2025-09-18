import fs from 'fs/promises';
import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from '../../utils.js';

export default testSuite(({ describe }) => {
  describe('OpenRouter config', async ({ test, describe }) => {
    const { fixture, lazycommit } = await createFixture();
    const configPath = path.join(fixture.path, '.lazycommit');

    test('OPENROUTER_API_KEY cannot be set in config', async () => {
      const { stderr } = await lazycommit(['config', 'set', 'OPENROUTER_API_KEY=sk-or-abc123'], {
        reject: false,
      });

      expect(stderr).toMatch('Invalid config property: OPENROUTER_API_KEY');
    });

    test('OPENROUTER_API_KEY with invalid format should be rejected by getApiKey', async () => {
      // This tests the validation in getApiKey function
      const { getApiKey } = await import('../../../src/utils/config.js');
      const config = {
        provider: 'openrouter' as const,
        locale: 'en',
        generate: 1,
        type: '' as const,
        proxy: undefined,
        model: 'openai/gpt-4o-mini',
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
        GROQ_API_KEY: undefined,
      };

      // Set invalid key in environment
      const originalEnv = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = 'invalid-key';

      try {
        expect(() => getApiKey(config)).toThrow('Invalid OpenRouter API key format');
      } finally {
        // Restore original environment
        if (originalEnv) {
          process.env.OPENROUTER_API_KEY = originalEnv;
        } else {
          delete process.env.OPENROUTER_API_KEY;
        }
      }
    });

    await describe('provider', ({ test }) => {
      test('defaults to groq', async () => {
        const { stdout } = await lazycommit(['config', 'get', 'provider']);
        expect(stdout).toBe('provider=groq');
      });

      test('set provider to openrouter', async () => {
        const provider = 'provider=openrouter';
        await lazycommit(['config', 'set', provider]);

        const configFile = await fs.readFile(configPath, 'utf8');
        expect(configFile).toMatch(provider);

        const get = await lazycommit(['config', 'get', 'provider']);
        expect(get.stdout).toBe(provider);
      });

      test('rejects invalid provider', async () => {
        const { stderr } = await lazycommit(['config', 'set', 'provider=invalid'], {
          reject: false,
        });

        expect(stderr).toMatch('Must be either "groq" or "openrouter"');
      });
    });

    await describe('model defaults', ({ test }) => {
      test('defaults to groq model when provider is groq', async () => {
        await lazycommit(['config', 'set', 'provider=groq']);

        const { stdout } = await lazycommit(['config', 'get', 'model']);
        expect(stdout).toBe('model=openai/gpt-oss-120b');
      });

      test('allows custom model setting', async () => {
        const customModel = 'model=llama-3.1-70b-versatile';
        await lazycommit(['config', 'set', customModel]);

        const configFile = await fs.readFile(configPath, 'utf8');
        expect(configFile).toMatch(customModel);

        const get = await lazycommit(['config', 'get', 'model']);
        expect(get.stdout).toBe(customModel);
      });
    });

    await fixture.rm();
  });
});
