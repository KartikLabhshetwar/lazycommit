import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ini from 'ini';
import { fileExists } from './fs.js';
import { KnownError } from './error.js';

const commitTypes = ['', 'conventional'] as const;
const providers = ['groq', 'openrouter'] as const;

export type CommitType = (typeof commitTypes)[number];
export type Provider = (typeof providers)[number];

const { hasOwnProperty } = Object.prototype;
export const hasOwn = (object: unknown, key: PropertyKey) =>
	hasOwnProperty.call(object, key);

const parseAssert = (name: string, condition: any, message: string) => {
	if (!condition) {
		throw new KnownError(`Invalid config property ${name}: ${message}`);
	}
};

const configParsers = {
	GROQ_API_KEY(key?: string) {
		// Optional - only required if provider is groq
		if (!key) {
			return undefined;
		}
		parseAssert('GROQ_API_KEY', key.startsWith('gsk_'), 'Must start with "gsk_"');
		return key;
	},
	OPENROUTER_API_KEY(key?: string) {
		// Optional - only required if provider is openrouter
		if (!key) {
			return undefined;
		}
		parseAssert('OPENROUTER_API_KEY', key.startsWith('sk-or-'), 'Must start with "sk-or-"');
		return key;
	},
	provider(provider?: string) {
		if (!provider) {
			return 'groq' as Provider; // Default to groq for backward compatibility
		}
		parseAssert(
			'provider',
			providers.includes(provider as Provider),
			`Must be one of: ${providers.join(', ')}`
		);
		return provider as Provider;
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

		parseAssert(
			'type',
			commitTypes.includes(type as CommitType),
			'Invalid commit type'
		);

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
		// Model default depends on provider, handled in getConfig
		if (!model || model.length === 0) {
			return undefined;
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
			return 100;
		}

		parseAssert('max-length', /^\d+$/.test(maxLength), 'Must be an integer');

		const parsed = Number(maxLength);
		parseAssert(
			'max-length',
			parsed >= 20,
			'Must be greater than 20 characters'
		);
		parseAssert(
			'max-length',
			parsed <= 200,
			'Must be less than or equal to 200 characters'
		);

		return parsed;
	},
} as const;

type ConfigKeys = keyof typeof configParsers;

type RawConfig = {
	[key in ConfigKeys]?: string;
};

export type ValidConfig = {
	[Key in ConfigKeys]: ReturnType<(typeof configParsers)[Key]>;
};

// Default models per provider
const defaultModels: Record<Provider, string> = {
	groq: 'llama-3.1-8b-instant',
	openrouter: 'anthropic/claude-3.5-sonnet',
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

export const getConfig = async (
	cliConfig?: RawConfig,
	suppressErrors?: boolean
): Promise<ValidConfig> => {
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

	// Set default model based on provider if not specified
	const provider = parsedConfig.provider as Provider;
	if (!parsedConfig.model) {
		parsedConfig.model = defaultModels[provider];
	}

	// Validate that the required API key is set for the selected provider
	if (!suppressErrors) {
		if (provider === 'groq' && !parsedConfig.GROQ_API_KEY) {
			throw new KnownError(
				'Please set your Groq API key via `lazycommit config set GROQ_API_KEY=<your token>`\nGet your key from https://console.groq.com/keys'
			);
		}
		if (provider === 'openrouter' && !parsedConfig.OPENROUTER_API_KEY) {
			throw new KnownError(
				'Please set your OpenRouter API key via `lazycommit config set OPENROUTER_API_KEY=<your token>`\nGet your key from https://openrouter.ai/keys'
			);
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
		config[key as ConfigKeys] = parsed as any;
	}

	await fs.writeFile(configPath, ini.stringify(config), 'utf8');
};
