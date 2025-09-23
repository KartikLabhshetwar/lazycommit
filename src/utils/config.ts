import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ini from 'ini';
import { fileExists } from './fs.js';
import { KnownError } from './error.js';

const commitTypes = ['', 'conventional'] as const;

export type CommitType = (typeof commitTypes)[number];

const { hasOwnProperty } = Object.prototype;
export const hasOwn = (object: unknown, key: PropertyKey) =>
	hasOwnProperty.call(object, key);

const parseAssert = (name: string, condition: any, message: string) => {
	if (!condition) {
		throw new KnownError(`Invalid config property ${name}: ${message}`);
	}
};

const configParsers = {
	provider(provider?: string) {
		if (!provider) {
			return 'groq';
		}

		parseAssert('provider', ['groq', 'openai', 'anthropic'].includes(provider), 'Must be "groq", "openai", or "anthropic"');
		return provider as 'groq' | 'openai' | 'anthropic';
	},
	GROQ_API_KEY(key?: string) {
		// Only required if provider is groq (default)
		if (!key) {
			return undefined;
		}
		parseAssert('GROQ_API_KEY', key.startsWith('gsk_'), 'Must start with "gsk_"');

		return key;
	},
	OPENAI_API_KEY(key?: string) {
		// Only required if provider is openai
		if (!key) {
			return undefined;
		}
		parseAssert('OPENAI_API_KEY', key.startsWith('sk-') || key.startsWith('sk_'), 'Must start with "sk-" or "sk_"');

		return key;
	},
	ANTHROPIC_API_KEY(key?: string) {
		// Only required if provider is anthropic
		if (!key) {
			return undefined;
		}
		parseAssert('ANTHROPIC_API_KEY', key.startsWith('sk-ant-'), 'Must start with "sk-ant-"');

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
		if (!model || model.length === 0) {
			// Default model depends on provider
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
			return 50;
		}

		parseAssert('max-length', /^\d+$/.test(maxLength), 'Must be an integer');

		const parsed = Number(maxLength);
		parseAssert(
			'max-length',
			parsed >= 20,
			'Must be greater than 20 characters'
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

	// Validate provider-specific requirements
	const finalConfig = parsedConfig as ValidConfig;
	const provider = finalConfig.provider || 'groq';

	// Set default model if not specified
	if (!finalConfig.model) {
		if (provider === 'openai') {
			finalConfig.model = 'gpt-4o-mini';
		} else if (provider === 'anthropic') {
			finalConfig.model = 'claude-3-5-sonnet-20241022';
		} else {
			finalConfig.model = 'openai/gpt-oss-20b';
		}
	}

	if (!suppressErrors) {
		if (provider === 'groq' && !finalConfig.GROQ_API_KEY) {
			throw new KnownError(
				'Please set your Groq API key via `lazycommit config set GROQ_API_KEY=<your token>`'
			);
		}
		if (provider === 'openai' && !finalConfig.OPENAI_API_KEY) {
			throw new KnownError(
				'Please set your OpenAI API key via `lazycommit config set OPENAI_API_KEY=<your token>`'
			);
		}
		if (provider === 'anthropic' && !finalConfig.ANTHROPIC_API_KEY) {
			throw new KnownError(
				'Please set your Anthropic API key via `lazycommit config set ANTHROPIC_API_KEY=<your token>`'
			);
		}
	}

	return finalConfig;
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
