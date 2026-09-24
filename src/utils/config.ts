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
	GROQ_API_KEY(key?: string) {
		if (!key) {
			throw new KnownError(
				'Please set your Groq API key via `lazycommit config set GROQ_API_KEY=<your token>`'
			);
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
			/^[a-z]{2,8}(?:[-_][a-z0-9]{2,8})*$/i.test(locale),
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

		let valid = false;
		try { valid = ['http:', 'https:'].includes(new URL(url).protocol); } catch {}
		parseAssert('proxy', valid, 'Must be a valid HTTP/HTTPS URL');

		return url;
	},
	scope(value = '') {
		parseAssert('scope', value === '' || /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,39}$/.test(value), 'Use up to 40 letters, digits, dots, slashes, underscores or hyphens');
		return value;
	},
	context(value = '') {
		parseAssert('context', value.length <= 2000 && !/[\r\n\x00]/.test(value), 'Use one line of at most 2000 characters');
		return value;
	},
	'max-diff-chars'(value = '16000') {
		const parsed = Number(value);
		parseAssert('max-diff-chars', /^\d+$/.test(value) && parsed >= 1000 && parsed <= 100000, 'Must be an integer between 1000 and 100000');
		return parsed;
	},
	model(model?: string) {
		if (!model || model.length === 0) {
			return 'openai/gpt-oss-20b';
		}

		parseAssert('model', /^\S+$/.test(model), 'Cannot contain whitespace');
		return model;
	},
	timeout(timeout?: string) {
		if (!timeout) {
			return 10_000;
		}

		parseAssert('timeout', /^\d+$/.test(timeout), 'Must be an integer');

		const parsed = Number(timeout);
		parseAssert('timeout', Number.isSafeInteger(parsed) && parsed >= 500 && parsed <= 300_000, 'Must be between 500 and 300000ms');

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

export type RawConfig = {
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
		const input = value === undefined ? undefined : String(value);

		if (suppressErrors) {
			try {
				parsedConfig[key] = parser(input);
			} catch {}
		} else {
			parsedConfig[key] = parser(input);
		}
	}

	if (!suppressErrors && parsedConfig.scope && parsedConfig.type !== 'conventional') {
		throw new KnownError('A scope requires --type conventional.');
	}
	return parsedConfig as ValidConfig;
};

export const setConfigs = async (keyValues: [key: string, value: string][]) => {
	const config = await readConfigFile();

	for (const [key, value] of keyValues) {
		if (!hasOwn(configParsers, key)) {
			throw new KnownError(`Invalid config property: ${key}`);
		}

		if (typeof value !== 'string') throw new KnownError(`Expected ${key}=<value>`);
		const parsed = configParsers[key as ConfigKeys](value);
		config[key as ConfigKeys] = parsed as any;
	}

	await fs.writeFile(configPath, ini.stringify(config), { encoding: 'utf8', mode: 0o600 });
	await fs.chmod(configPath, 0o600);
};
