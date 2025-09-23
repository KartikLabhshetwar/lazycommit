import { SecretStore, SecretManagerConfig, SupportedBackend, BackendInfo } from './types.js';
import { KeychainBackend } from './backends/keychain.js';
import { LibSecretBackend } from './backends/libsecret.js';
import { WindowsCredentialBackend } from './backends/windows.js';
import { EnvBackend } from './backends/env.js';
import { FileBackend } from './backends/file.js';

export class SecretsManager {
	private backends: Map<SupportedBackend, SecretStore> = new Map();
	private activeBackend: SecretStore | null = null;
	private config: SecretManagerConfig;
	private initialized = false;

	constructor(config: SecretManagerConfig) {
		this.config = {
			...config,
			preferredBackends: config.preferredBackends || ['keychain', 'libsecret', 'windows', 'env', 'file'],
			fallbackToFile: config.fallbackToFile ?? true,
		};
		this.registerBackends();
	}

	private registerBackends(): void {
		this.backends.set('keychain', new KeychainBackend());
		this.backends.set('libsecret', new LibSecretBackend());
		this.backends.set('windows', new WindowsCredentialBackend());
		this.backends.set('env', new EnvBackend());
		this.backends.set('file', new FileBackend(this.config.fileStoragePath));
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		const preferredOrder = this.config.preferredBackends!;

		for (const backendName of preferredOrder) {
			const backend = this.backends.get(backendName);
			if (backend && await backend.isAvailable()) {
				this.activeBackend = backend;
				if (process.env.DEBUG) {
					console.debug(`Using ${backendName} for secrets storage`);
				}
				break;
			}
		}

		if (!this.activeBackend && this.config.fallbackToFile) {
			this.activeBackend = this.backends.get('file')!;
			if (process.env.DEBUG) {
				console.debug('Using file backend as fallback for secrets storage');
			}
		}

		if (!this.activeBackend) {
			throw new Error('No suitable secrets backend available');
		}

		this.initialized = true;
	}

	async getSecret(account: string): Promise<string | null> {
		if (!this.initialized) {
			await this.initialize();
		}
		return this.activeBackend!.get(this.config.serviceName, account);
	}

	async setSecret(account: string, value: string): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
		await this.activeBackend!.set(this.config.serviceName, account, value);
	}

	async deleteSecret(account: string): Promise<boolean> {
		if (!this.initialized) {
			await this.initialize();
		}
		return this.activeBackend!.delete(this.config.serviceName, account);
	}

	async getAllSecrets(): Promise<Map<string, string>> {
		if (!this.initialized) {
			await this.initialize();
		}
		return this.activeBackend!.getAll(this.config.serviceName);
	}

	async testBackends(): Promise<BackendInfo[]> {
		const results: BackendInfo[] = [];
		const backendDescriptions: Record<SupportedBackend, string> = {
			keychain: 'macOS Keychain',
			libsecret: 'Linux Secret Service',
			windows: 'Windows Credential Manager',
			env: 'Environment Variables',
			file: 'File Storage (~/.lazycommit)',
		};

		for (const [name, backend] of this.backends) {
			const available = await backend.isAvailable();
			results.push({
				name,
				available,
				platform: this.getPlatformForBackend(name),
				description: backendDescriptions[name],
			});
		}

		return results;
	}

	private getPlatformForBackend(backend: SupportedBackend): string | undefined {
		const platformMap: Record<SupportedBackend, string | undefined> = {
			keychain: 'darwin',
			libsecret: 'linux',
			windows: 'win32',
			env: undefined,
			file: undefined,
		};
		return platformMap[backend];
	}

	getActiveBackendName(): string | null {
		return this.activeBackend?.name || null;
	}
}
