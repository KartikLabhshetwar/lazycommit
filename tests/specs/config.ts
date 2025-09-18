import fs from 'fs/promises';
import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from '../utils.js';

export default testSuite(({ describe }) => {
	describe('config', async ({ test, describe }) => {
		const { fixture, lazycommit } = await createFixture();
		const configPath = path.join(fixture.path, '.lazycommit');
		const groqToken = 'GROQ_API_KEY=gsk_abc';

		test('set unknown config file', async () => {
			const { stderr } = await lazycommit(['config', 'set', 'UNKNOWN=1'], {
				reject: false,
			});

			expect(stderr).toMatch('Invalid config property: UNKNOWN');
		});

		test('set invalid GROQ_API_KEY', async () => {
			const { stderr } = await lazycommit(['config', 'set', 'GROQ_API_KEY=abc'], {
				reject: false,
			});

			expect(stderr).toMatch(
				'Invalid config property GROQ_API_KEY: Must start with "gsk_"'
			);
		});

		await test('set config file', async () => {
			await lazycommit(['config', 'set', groqToken]);

			const configFile = await fs.readFile(configPath, 'utf8');
			expect(configFile).toMatch(groqToken);
		});

		await test('get config file', async () => {
			const { stdout } = await lazycommit(['config', 'get', 'GROQ_API_KEY']);
			expect(stdout).toBe(groqToken);
		});

		await test('reading unknown config', async () => {
			await fs.appendFile(configPath, 'UNKNOWN=1');

			const { stdout, stderr } = await lazycommit(['config', 'get', 'UNKNOWN'], {
				reject: false,
			});

			expect(stdout).toBe('');
			expect(stderr).toBe('');
		});

		await describe('timeout', ({ test }) => {
			test('setting invalid timeout config', async () => {
				const { stderr } = await lazycommit(['config', 'set', 'timeout=abc'], {
					reject: false,
				});

				expect(stderr).toMatch('Must be an integer');
			});

			test('setting valid timeout config', async () => {
				const timeout = 'timeout=20000';
				await lazycommit(['config', 'set', timeout]);

				const configFile = await fs.readFile(configPath, 'utf8');
				expect(configFile).toMatch(timeout);

				const get = await lazycommit(['config', 'get', 'timeout']);
				expect(get.stdout).toBe(timeout);
			});
		});

		await describe('max-length', ({ test }) => {
			test('must be an integer', async () => {
				const { stderr } = await lazycommit(
					['config', 'set', 'max-length=abc'],
					{
						reject: false,
					}
				);

				expect(stderr).toMatch('Must be an integer');
			});

			test('must be at least 20 characters', async () => {
				const { stderr } = await lazycommit(['config', 'set', 'max-length=10'], {
					reject: false,
				});

				expect(stderr).toMatch(/must be greater than 20 characters/i);
			});

			test('updates config', async () => {
				const defaultConfig = await lazycommit(['config', 'get', 'max-length']);
				expect(defaultConfig.stdout).toBe('max-length=50');

				const maxLength = 'max-length=60';
				await lazycommit(['config', 'set', maxLength]);

				const configFile = await fs.readFile(configPath, 'utf8');
				expect(configFile).toMatch(maxLength);

				const get = await lazycommit(['config', 'get', 'max-length']);
				expect(get.stdout).toBe(maxLength);
			});
		});

		await describe('provider config', ({ test }) => {
			test('set provider to openrouter', async () => {
				const provider = 'provider=openrouter';
				await lazycommit(['config', 'set', provider]);

				const configFile = await fs.readFile(configPath, 'utf8');
				expect(configFile).toMatch(provider);

				const get = await lazycommit(['config', 'get', 'provider']);
				expect(get.stdout).toBe(provider);
			});

			test('OPENROUTER_API_KEY cannot be set in config', async () => {
				const { stderr } = await lazycommit(['config', 'set', 'OPENROUTER_API_KEY=sk-or-test123'], {
					reject: false,
				});

				expect(stderr).toMatch('Invalid config property: OPENROUTER_API_KEY');
			});
		});

		await test('set config file', async () => {
			await lazycommit(['config', 'set', groqToken]);

			const configFile = await fs.readFile(configPath, 'utf8');
			expect(configFile).toMatch(groqToken);
		});

		await test('get config file', async () => {
			const { stdout } = await lazycommit(['config', 'get', 'GROQ_API_KEY']);
			expect(stdout).toBe(groqToken);
		});

		await fixture.rm();
	});
});
