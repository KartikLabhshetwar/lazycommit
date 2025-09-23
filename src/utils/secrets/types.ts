export interface SecretStore {
	name: string;
	isAvailable(): Promise<boolean>;
	get(service: string, account: string): Promise<string | null>;
	set(service: string, account: string, password: string): Promise<void>;
	delete(service: string, account: string): Promise<boolean>;
	getAll(service: string): Promise<Map<string, string>>;
}

export interface SecretManagerConfig {
	serviceName: string;
	preferredBackends?: SupportedBackend[];
	fallbackToFile?: boolean;
	fileStoragePath?: string;
}

export type SupportedBackend = 'keychain' | 'libsecret' | 'windows' | 'env' | 'file';

export interface BackendInfo {
	name: SupportedBackend;
	available: boolean;
	platform?: string;
	description: string;
}
