import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ini from 'ini';
import { SecretStore } from '../types.js';
import { fileExists } from '../../fs.js';

export class FileBackend implements SecretStore {
	name = 'file' as const;
	private filePath: string;

	constructor(filePath?: string) {
		this.filePath = filePath || path.join(os.homedir(), '.lazycommit');
	}

	async isAvailable(): Promise<boolean> {
		return true;
	}

	private async readConfig(): Promise<Record<string, any>> {
		const exists = await fileExists(this.filePath);
		if (!exists) {
			return {};
		}

		try {
			const content = await fs.readFile(this.filePath, 'utf8');
			return ini.parse(content);
		} catch {
			return {};
		}
	}

	private async writeConfig(config: Record<string, any>): Promise<void> {
		const content = ini.stringify(config);
		await fs.writeFile(this.filePath, content, 'utf8');
	}

	async get(_service: string, account: string): Promise<string | null> {
		const config = await this.readConfig();
		return config[account] || null;
	}

	async set(_service: string, account: string, password: string): Promise<void> {
		const config = await this.readConfig();
		config[account] = password;
		await this.writeConfig(config);
	}

	async delete(_service: string, account: string): Promise<boolean> {
		const config = await this.readConfig();
		if (account in config) {
			delete config[account];
			await this.writeConfig(config);
			return true;
		}
		return false;
	}

	async getAll(_service: string): Promise<Map<string, string>> {
		const config = await this.readConfig();
		const results = new Map<string, string>();
		const accounts = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

		for (const account of accounts) {
			if (config[account]) {
				results.set(account, config[account]);
			}
		}

		return results;
	}
}