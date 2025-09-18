import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ini from 'ini';
import { fileExists } from './fs.js';
import { KnownError } from './error.js';

const commitTypes = ['', 'conventional'] as const;

export type CommitType = (typeof commitTypes)[number];

export const hasOwn = (object: unknown, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(object, key);

const parseAssert = (name: string, condition: unknown, message: string) => {
  if (!condition) {
    throw new KnownError(`Invalid config property ${name}: ${message}`);
  }
};

const configParsers = {
  GROQ_API_KEY(key?: string) {
    if (!key) {
      return undefined;
    }
    parseAssert('GROQ_API_KEY', key.startsWith('gsk_'), 'Must start with "gsk_"');

    return key;
  },
  locale(locale?: string) {
    if (!locale) {
      return 'en';
    }

    parseAssert('locale', locale, 'Cannot be empty');
    parseAssert(
      'locale',
      /^[a-z-]+$/i.test(locale),
      'Must be a valid locale (letters and dashes/underscores). You can consult the list of codes in: https://wikipedia.org/wiki/List_of_ISO_639-1_codes'
    );
    return locale;
  },
  generate(count?: string) {
    if (!count) {
      return 1;
    }

    parseAssert('generate', /^\d+$/.test(count), 'Must be an integer');

    const parsed = Number(count);
    parseAssert('generate', parsed > 0, 'Must be greater than 0');
    parseAssert('generate', parsed <= 5, 'Must be less or equal to 5');

    return parsed;
  },
  type(type?: string) {
    if (!type) {
      return '';
    }

    parseAssert('type', commitTypes.includes(type as CommitType), 'Invalid commit type');

    return type as CommitType;
  },
  proxy(url?: string) {
    if (!url || url.length === 0) {
      return undefined;
    }

    parseAssert('proxy', /^https?:\/\//.test(url), 'Must be a valid URL');

    return url;
  },
  model(model?: string) {
    if (!model || model.length === 0) {
      return 'openai/gpt-oss-120b';
    }

    return model;
  },
  timeout(timeout?: string) {
    if (!timeout) {
      return 10_000;
    }

    parseAssert('timeout', /^\d+$/.test(timeout), 'Must be an integer');

    const parsed = Number(timeout);
    parseAssert('timeout', parsed >= 500, 'Must be greater than 500ms');

    return parsed;
  },
  'max-length'(maxLength?: string) {
    if (!maxLength) {
      return 50;
    }

    parseAssert('max-length', /^\d+$/.test(maxLength), 'Must be an integer');

    const parsed = Number(maxLength);
    parseAssert('max-length', parsed >= 20, 'Must be greater than 20 characters');

    return parsed;
  },
  'chunk-size'(chunkSize?: string) {
    if (!chunkSize) {
      return 4000;
    }

    parseAssert('chunk-size', /^\d+$/.test(chunkSize), 'Must be an integer');

    const parsed = Number(chunkSize);
    parseAssert('chunk-size', parsed >= 1000, 'Must be at least 1000 tokens');
    parseAssert('chunk-size', parsed <= 8000, 'Must be at most 8000 tokens (Groq limit)');

    return parsed;
  },
  provider(provider?: string) {
    if (!provider) {
      return 'groq';
    }

    parseAssert('provider', provider === 'groq' || provider === 'openrouter', 'Must be either "groq" or "openrouter"');

    return provider as 'groq' | 'openrouter';
  },
} as const;

type ConfigKeys = keyof typeof configParsers;

type RawConfig = {
  [key in ConfigKeys]?: string;
};

export type ValidConfig = {
  [Key in ConfigKeys]: ReturnType<(typeof configParsers)[Key]>;
};

const configPath = path.join(os.homedir(), '.lazycommit');

const readConfigFile = async (): Promise<RawConfig> => {
  const configExists = await fileExists(configPath);
  if (!configExists) {
    return Object.create(null);
  }

  const configString = await fs.readFile(configPath, 'utf8');
  return ini.parse(configString);
};

export const getConfig = async (cliConfig?: RawConfig, suppressErrors?: boolean): Promise<ValidConfig> => {
  const config = await readConfigFile();
  const parsedConfig: Record<string, unknown> = {};

  for (const key of Object.keys(configParsers) as ConfigKeys[]) {
    const parser = configParsers[key];
    const value = cliConfig?.[key] ?? config[key];

    if (suppressErrors) {
      try {
        parsedConfig[key] = parser(value);
      } catch {}
    } else {
      parsedConfig[key] = parser(value);
    }
  }

  return parsedConfig as ValidConfig;
};

export const setConfigs = async (keyValues: [key: string, value: string][]) => {
  const config = await readConfigFile();

  for (const [key, value] of keyValues) {
    if (!hasOwn(configParsers, key)) {
      throw new KnownError(`Invalid config property: ${key}`);
    }

    const parsed = configParsers[key as ConfigKeys](value);
    (config as Record<string, unknown>)[key] = parsed;
  }

  await fs.writeFile(configPath, ini.stringify(config), 'utf8');
};

export const getApiKey = (config: ValidConfig): string => {
  const provider = config.provider;
  let key: string | undefined;

  switch (provider) {
    case 'groq':
      // Groq can use config file or environment variable
      key = process.env.GROQ_API_KEY || config.GROQ_API_KEY;
      if (!key) {
        throw new KnownError(
          'No Groq API key found. Recommended: Set environment variable GROQ_API_KEY=<your-key>\n' +
            'Alternative: `lazycommit config set GROQ_API_KEY=<your-key>`'
        );
      }
      break;
    case 'openrouter':
      // OpenRouter only uses environment variable
      key = process.env.OPENROUTER_API_KEY;
      if (!key) {
        throw new KnownError('No OpenRouter API key found. Set the OPENROUTER_API_KEY environment variable.');
      }
      // Validate OpenRouter key format
      if (!key.startsWith('sk-or-')) {
        throw new KnownError('Invalid OpenRouter API key format. Must start with "sk-or-"');
      }
      break;
    default:
      throw new KnownError(`Unsupported provider: ${provider}`);
  }

  return key;
};

export const getDefaultModel = (provider: 'groq' | 'openrouter'): string => {
  switch (provider) {
    case 'openrouter':
      return 'openai/gpt-4o-mini';
    case 'groq':
    default:
      return 'openai/gpt-oss-120b';
  }
};

export const getModelForProvider = (config: ValidConfig): string => {
  // If model is explicitly set and not default, use it
  if (config.model !== 'openai/gpt-oss-120b') {
    return config.model;
  }

  // Otherwise, use provider-appropriate default
  return getDefaultModel(config.provider);
};
