import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ini from 'ini';
import { fileExists } from '../fs.js';
import { SecretsManager } from './manager.js';

export async function migrateSecretsToSecureStorage(
	secretsManager: SecretsManager,
	dryRun = false
): Promise<{
	migrated: string[];
	errors: string[];
}> {
	const oldConfigPath = path.join(os.homedir(), '.lazycommit');
	const results = {
		migrated: [] as string[],
		errors: [] as string[],
	};

	const configExists = await fileExists(oldConfigPath);
	if (!configExists) {
		return results;
	}

	try {
		const configContent = await fs.readFile(oldConfigPath, 'utf8');
		const oldConfig = ini.parse(configContent);

		const apiKeys = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
		let configModified = false;

		for (const keyName of apiKeys) {
			if (oldConfig[keyName]) {
				try {
					if (!dryRun) {
						await secretsManager.setSecret(keyName, oldConfig[keyName]);
						delete oldConfig[keyName];
						configModified = true;
					}
					results.migrated.push(keyName);
				} catch (error) {
					results.errors.push(`Failed to migrate ${keyName}: ${error}`);
				}
			}
		}

		if (configModified && !dryRun) {
			const newContent = ini.stringify(oldConfig);
			await fs.writeFile(oldConfigPath, newContent, 'utf8');
		}
	} catch (error) {
		results.errors.push(`Failed to read config file: ${error}`);
	}

	return results;
}

export async function exportSecretsFromSecureStorage(
	secretsManager: SecretsManager,
	outputPath?: string
): Promise<void> {
	const secrets = await secretsManager.getAllSecrets();
	const config: Record<string, string> = {};

	for (const [key, value] of secrets) {
		config[key] = value;
	}

	const configPath = outputPath || path.join(os.homedir(), '.lazycommit.backup');
	const content = ini.stringify(config);
	await fs.writeFile(configPath, content, { encoding: 'utf8', mode: 0o600 });
}