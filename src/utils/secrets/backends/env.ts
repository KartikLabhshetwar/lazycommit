import { SecretStore } from '../types.js';

export class EnvBackend implements SecretStore {
	name = 'env' as const;

	async isAvailable(): Promise<boolean> {
		return true;
	}

	async get(_service: string, account: string): Promise<string | null> {
		const envKey = account.replace(/-/g, '_').toUpperCase();
		return process.env[envKey] || null;
	}

	async set(_service: string, account: string, _password: string): Promise<void> {
		throw new Error(`Cannot set environment variables dynamically. Please set ${account} in your environment.`);
	}

	async delete(_service: string, _account: string): Promise<boolean> {
		throw new Error('Cannot delete environment variables dynamically.');
	}

	async getAll(_service: string): Promise<Map<string, string>> {
		const results = new Map<string, string>();
		const accounts = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

		for (const account of accounts) {
			const value = process.env[account];
			if (value) {
				results.set(account, value);
			}
		}

		return results;
	}
}