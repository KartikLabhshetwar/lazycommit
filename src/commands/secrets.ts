import { confirm, intro, outro, select, text, isCancel, spinner } from '@clack/prompts';
import * as kolorist from 'kolorist';
import { SecretsManager, migrateSecretsToSecureStorage } from '../utils/config.js';
import { KnownError } from '../utils/error.js';
import path from 'path';
import os from 'os';

const { green, red, dim, cyan, yellow } = kolorist;

export default async (
	command: 'test' | 'set' | 'migrate' | 'export',
	args?: string[]
) => {
	const manager = new SecretsManager({
		serviceName: 'lazycommit',
		preferredBackends: ['keychain', 'libsecret', 'windows', 'env', 'file'],
		fallbackToFile: true,
		fileStoragePath: path.join(os.homedir(), '.lazycommit'),
	});

	await manager.initialize();

	switch (command) {
		case 'test':
			await testBackends(manager);
			break;

		case 'set':
			if (!args || args.length < 2) {
				throw new KnownError('Usage: lazycommit secrets set <key> <value>');
			}
			await setSecret(manager, args[0], args[1]);
			break;

		case 'migrate':
			await migrateSecrets(manager);
			break;

		case 'export':
			await exportSecrets(manager, args?.[0]);
			break;

		default:
			throw new KnownError(`Unknown secrets command: ${command}`);
	}
};

async function testBackends(manager: SecretsManager): Promise<void> {
	intro(cyan('Testing available secret storage backends'));

	const backends = await manager.testBackends();
	const activeBackend = manager.getActiveBackendName();

	console.log('\nBackend availability:\n');

	for (const backend of backends) {
		const status = backend.available ? green('✓') : red('✗');
		const active = backend.name === activeBackend ? yellow(' (active)') : '';
		const platform = backend.platform ? dim(` [${backend.platform}]`) : '';

		console.log(`  ${status} ${backend.description}${platform}${active}`);
	}

	console.log();
	outro(`Currently using: ${green(activeBackend || 'none')}`);
}

async function setSecret(manager: SecretsManager, key: string, value: string): Promise<void> {
	const validKeys = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

	if (!validKeys.includes(key)) {
		throw new KnownError(`Invalid key: ${key}. Valid keys are: ${validKeys.join(', ')}`);
	}

	const s = spinner();
	s.start(`Storing ${key} securely`);

	try {
		await manager.setSecret(key, value);
		s.stop(`${green('✓')} ${key} stored securely using ${manager.getActiveBackendName()}`);
	} catch (error) {
		s.stop(`${red('✗')} Failed to store ${key}`);
		throw error;
	}
}

async function migrateSecrets(manager: SecretsManager): Promise<void> {
	intro(cyan('Migrating API keys to secure storage'));

	const shouldContinue = await confirm({
		message: 'This will move API keys from ~/.lazycommit to secure storage. Continue?',
		initialValue: true,
	});

	if (isCancel(shouldContinue) || !shouldContinue) {
		outro(yellow('Migration cancelled'));
		return;
	}

	const s = spinner();
	s.start('Migrating secrets');

	try {
		const results = await migrateSecretsToSecureStorage(manager);

		if (results.migrated.length === 0 && results.errors.length === 0) {
			s.stop(yellow('No API keys found to migrate'));
		} else {
			s.stop();

			if (results.migrated.length > 0) {
				console.log(green('\nMigrated successfully:'));
				for (const key of results.migrated) {
					console.log(`  ${green('✓')} ${key}`);
				}
			}

			if (results.errors.length > 0) {
				console.log(red('\nMigration errors:'));
				for (const error of results.errors) {
					console.log(`  ${red('✗')} ${error}`);
				}
			}

			console.log();
			outro(`Migration complete. Using: ${green(manager.getActiveBackendName() || 'file')}`);
		}
	} catch (error) {
		s.stop(`${red('✗')} Migration failed`);
		throw error;
	}
}

async function exportSecrets(manager: SecretsManager, outputPath?: string): Promise<void> {
	intro(cyan('Exporting secrets from secure storage'));

	const shouldContinue = await confirm({
		message: 'This will export your API keys to a file. Continue?',
		initialValue: false,
	});

	if (isCancel(shouldContinue) || !shouldContinue) {
		outro(yellow('Export cancelled'));
		return;
	}

	const s = spinner();
	s.start('Exporting secrets');

	try {
		const { exportSecretsFromSecureStorage } = await import('../utils/secrets/migrate.js');
		const exportPath = outputPath || path.join(os.homedir(), '.lazycommit.backup');
		await exportSecretsFromSecureStorage(manager, exportPath);
		s.stop(`${green('✓')} Secrets exported to ${exportPath}`);
	} catch (error) {
		s.stop(`${red('✗')} Export failed`);
		throw error;
	}
}