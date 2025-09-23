import { SecretStore } from '../types.js';

export class WindowsCredentialBackend implements SecretStore {
	name = 'windows' as const;

	async isAvailable(): Promise<boolean> {
		if (process.platform !== 'win32') {
			return false;
		}

		try {
			const { Entry } = await import('@napi-rs/keyring');
			// Test if we can create an Entry
			const testEntry = new Entry('lazycommit-test', 'availability-check');
			const result = testEntry.getPassword();
			return result === null || typeof result === 'string';
		} catch {
			return false;
		}
	}

	async get(service: string, account: string): Promise<string | null> {
		try {
			const { Entry } = await import('@napi-rs/keyring');
			const entry = new Entry(service, account);
			const password = entry.getPassword();
			return password;
		} catch {
			return null;
		}
	}

	async set(service: string, account: string, password: string): Promise<void> {
		const { Entry } = await import('@napi-rs/keyring');
		const entry = new Entry(service, account);
		entry.setPassword(password);
	}

	async delete(service: string, account: string): Promise<boolean> {
		try {
			const { Entry } = await import('@napi-rs/keyring');
			const entry = new Entry(service, account);
			entry.deletePassword();
			return true;
		} catch {
			return false;
		}
	}

	async getAll(service: string): Promise<Map<string, string>> {
		const results = new Map<string, string>();
		const accounts = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

		for (const account of accounts) {
			const value = await this.get(service, account);
			if (value) {
				results.set(account, value);
			}
		}

		return results;
	}
}