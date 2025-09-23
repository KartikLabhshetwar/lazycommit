import { testSuite, expect } from 'manten';
import { SecretsManager } from '../../src/utils/secrets/manager.js';
import { FileBackend } from '../../src/utils/secrets/backends/file.js';
import { EnvBackend } from '../../src/utils/secrets/backends/env.js';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

export default testSuite(({ describe }) => {
	describe('Secrets Manager', ({ test }) => {
		test('initializes with available backend', async () => {
			const manager = new SecretsManager({
				serviceName: 'lazycommit-test',
				preferredBackends: ['env', 'file'],
				fallbackToFile: true,
			});

			await manager.initialize();
			const activeBackend = manager.getActiveBackendName();
			expect(activeBackend).toBeTruthy();
			expect(['env', 'file', 'keychain']).toContain(activeBackend);
		});

		test('tests all backends', async () => {
			const manager = new SecretsManager({
				serviceName: 'lazycommit-test',
			});

			const backends = await manager.testBackends();
			expect(backends).toBeInstanceOf(Array);
			expect(backends.length).toBeGreaterThan(0);

			// At least env and file should always be available
			const envBackend = backends.find(b => b.name === 'env');
			expect(envBackend?.available).toBe(true);

			const fileBackend = backends.find(b => b.name === 'file');
			expect(fileBackend?.available).toBe(true);
		});

		test('stores and retrieves secrets', async () => {
			const testPath = path.join(os.tmpdir(), '.lazycommit-test-' + Date.now());
			const manager = new SecretsManager({
				serviceName: 'lazycommit-test',
				preferredBackends: ['file'],
				fileStoragePath: testPath,
			});

			await manager.initialize();

			// Store a secret
			await manager.setSecret('TEST_KEY', 'test_value_123');

			// Retrieve it
			const retrieved = await manager.getSecret('TEST_KEY');
			expect(retrieved).toBe('test_value_123');

			// Delete it
			const deleted = await manager.deleteSecret('TEST_KEY');
			expect(deleted).toBe(true);

			// Verify it's gone
			const afterDelete = await manager.getSecret('TEST_KEY');
			expect(afterDelete).toBeNull();

			// Cleanup
			await fs.unlink(testPath).catch(() => {});
		});
	});

	describe('File Backend', ({ test }) => {
		test('reads and writes INI format', async () => {
			const testPath = path.join(os.tmpdir(), '.lazycommit-test-' + Date.now());
			const backend = new FileBackend(testPath);

			expect(await backend.isAvailable()).toBe(true);

			// Store multiple secrets
			await backend.set('lazycommit', 'GROQ_API_KEY', 'gsk_test');
			await backend.set('lazycommit', 'OPENAI_API_KEY', 'sk-test');

			// Retrieve them
			const groqKey = await backend.get('lazycommit', 'GROQ_API_KEY');
			expect(groqKey).toBe('gsk_test');

			const openaiKey = await backend.get('lazycommit', 'OPENAI_API_KEY');
			expect(openaiKey).toBe('sk-test');

			// Get all
			const all = await backend.getAll('lazycommit');
			expect(all.get('GROQ_API_KEY')).toBe('gsk_test');
			expect(all.get('OPENAI_API_KEY')).toBe('sk-test');

			// Cleanup
			await fs.unlink(testPath).catch(() => {});
		});

		test('maintains backward compatibility', async () => {
			const testPath = path.join(os.tmpdir(), '.lazycommit-test-' + Date.now());

			// Write a legacy config file
			const legacyConfig = `GROQ_API_KEY=gsk_legacy123
provider=groq
locale=en
generate=1`;
			await fs.writeFile(testPath, legacyConfig, 'utf8');

			const backend = new FileBackend(testPath);

			// Should be able to read the legacy key
			const key = await backend.get('lazycommit', 'GROQ_API_KEY');
			expect(key).toBe('gsk_legacy123');

			// Other settings should be preserved
			const provider = await backend.get('lazycommit', 'provider');
			expect(provider).toBe('groq');

			// Cleanup
			await fs.unlink(testPath).catch(() => {});
		});
	});

	describe('Environment Backend', ({ test }) => {
		test('reads from environment variables', async () => {
			const backend = new EnvBackend();
			expect(await backend.isAvailable()).toBe(true);

			// Set a test env var
			const originalValue = process.env.TEST_API_KEY;
			process.env.TEST_API_KEY = 'test_env_value';

			const value = await backend.get('service', 'TEST_API_KEY');
			expect(value).toBe('test_env_value');

			// Restore original value
			if (originalValue !== undefined) {
				process.env.TEST_API_KEY = originalValue;
			} else {
				delete process.env.TEST_API_KEY;
			}
		});

		test('cannot set or delete env vars', async () => {
			const backend = new EnvBackend();

			await expect(backend.set('service', 'key', 'value')).rejects.toThrow();
			await expect(backend.delete('service', 'key')).rejects.toThrow();
		});

		test('returns all API keys from env', async () => {
			const backend = new EnvBackend();

			// Save original values
			const originals = {
				GROQ_API_KEY: process.env.GROQ_API_KEY,
				OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			};

			// Set test values
			process.env.GROQ_API_KEY = 'gsk_env_test';
			process.env.OPENAI_API_KEY = 'sk-env_test';

			const all = await backend.getAll('service');
			expect(all.get('GROQ_API_KEY')).toBe('gsk_env_test');
			expect(all.get('OPENAI_API_KEY')).toBe('sk-env_test');

			// Restore original values
			for (const [key, value] of Object.entries(originals)) {
				if (value !== undefined) {
					process.env[key] = value;
				} else {
					delete process.env[key];
				}
			}
		});
	});
});