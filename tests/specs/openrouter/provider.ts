import { testSuite, expect } from 'manten';
import { getApiKey, getModelForProvider } from '../../../src/utils/config.js';
import type { ValidConfig } from '../../../src/utils/config.js';

export default testSuite(({ describe }) => {
  describe('Provider abstraction', ({ test }) => {
    test('getApiKey returns groq key from config when provider is groq', async () => {
      const config = {
        GROQ_API_KEY: 'gsk_test123',
        provider: 'groq' as const,
        locale: 'en',
        generate: 1,
        type: '',
        proxy: undefined,
        model: 'openai/gpt-oss-120b',
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
      } satisfies ValidConfig;

      // Ensure no environment variable is set
      const originalEnv = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      try {
        const apiKey = getApiKey(config);
        expect(apiKey).toBe('gsk_test123');
      } finally {
        // Restore original environment
        if (originalEnv) {
          process.env.GROQ_API_KEY = originalEnv;
        }
      }
    });

    test('getApiKey prefers environment variable over config for groq', async () => {
      const config = {
        GROQ_API_KEY: 'gsk_config123',
        provider: 'groq' as const,
        locale: 'en',
        generate: 1,
        type: '',
        proxy: undefined,
        model: 'openai/gpt-oss-120b',
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
      } satisfies ValidConfig;

      // Set environment variable
      const originalEnv = process.env.GROQ_API_KEY;
      process.env.GROQ_API_KEY = 'gsk_env456';

      try {
        const apiKey = getApiKey(config);
        expect(apiKey).toBe('gsk_env456'); // Should prefer environment
      } finally {
        // Restore original environment
        if (originalEnv) {
          process.env.GROQ_API_KEY = originalEnv;
        } else {
          delete process.env.GROQ_API_KEY;
        }
      }
    });

    test('getApiKey returns openrouter key from environment when provider is openrouter', async () => {
      const config = {
        GROQ_API_KEY: 'gsk_test123',
        provider: 'openrouter' as const,
        locale: 'en',
        generate: 1,
        type: '',
        proxy: undefined,
        model: 'openai/gpt-4o-mini',
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
      } satisfies ValidConfig;

      // Set environment variable
      const originalEnv = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = 'sk-or-test456';

      try {
        const apiKey = getApiKey(config);
        expect(apiKey).toBe('sk-or-test456');
      } finally {
        // Restore original environment
        if (originalEnv) {
          process.env.OPENROUTER_API_KEY = originalEnv;
        } else {
          delete process.env.OPENROUTER_API_KEY;
        }
      }
    });

    test('getApiKey throws error when groq key is missing from both environment and config', async () => {
      const config = {
        GROQ_API_KEY: undefined,
        provider: 'groq' as const,
        locale: 'en',
        generate: 1,
        type: '',
        proxy: undefined,
        model: 'openai/gpt-oss-120b',
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
      } satisfies ValidConfig;

      // Ensure no environment variable is set
      const originalEnv = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      try {
        expect(() => getApiKey(config)).toThrow('No Groq API key found');
      } finally {
        // Restore original environment
        if (originalEnv) {
          process.env.GROQ_API_KEY = originalEnv;
        }
      }
    });

    test('getApiKey throws error when openrouter key is missing from environment', async () => {
      const config = {
        GROQ_API_KEY: 'gsk_test123',
        provider: 'openrouter' as const,
        locale: 'en',
        generate: 1,
        type: '',
        proxy: undefined,
        model: 'openai/gpt-4o-mini',
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
      } satisfies ValidConfig;

      // Ensure environment variable is not set
      const originalEnv = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        expect(() => getApiKey(config)).toThrow('No OpenRouter API key found');
      } finally {
        // Restore original environment
        if (originalEnv) {
          process.env.OPENROUTER_API_KEY = originalEnv;
        }
      }
    });

    test('getModelForProvider returns provider-appropriate model', async () => {
      const groqConfig = {
        GROQ_API_KEY: 'gsk_test123',
        OPENROUTER_API_KEY: undefined,
        provider: 'groq' as const,
        locale: 'en',
        generate: 1,
        type: '',
        proxy: undefined,
        model: 'openai/gpt-oss-120b', // default groq model
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
      } satisfies ValidConfig;

      const openrouterConfig = {
        GROQ_API_KEY: undefined,
        OPENROUTER_API_KEY: 'sk-or-test456',
        provider: 'openrouter' as const,
        locale: 'en',
        generate: 1,
        type: '',
        proxy: undefined,
        model: 'openai/gpt-oss-120b', // default groq model but provider is openrouter
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
      } satisfies ValidConfig;

      expect(getModelForProvider(groqConfig)).toBe('openai/gpt-oss-120b');
      expect(getModelForProvider(openrouterConfig)).toBe('openai/gpt-4o-mini');
    });

    test('getModelForProvider respects explicit model setting', async () => {
      const config = {
        GROQ_API_KEY: undefined,
        OPENROUTER_API_KEY: 'sk-or-test456',
        provider: 'openrouter' as const,
        locale: 'en',
        generate: 1,
        type: '',
        proxy: undefined,
        model: 'anthropic/claude-3.5-sonnet', // explicit model choice
        timeout: 10000,
        'max-length': 50,
        'chunk-size': 4000,
      } satisfies ValidConfig;

      expect(getModelForProvider(config)).toBe('anthropic/claude-3.5-sonnet');
    });
  });
});
