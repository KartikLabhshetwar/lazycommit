import fs from 'fs/promises';
import { intro, outro, spinner } from '@clack/prompts';
import { black, green, red, bgCyan } from 'kolorist';
import { getStagedDiff, getIndexTree, hasStagedChanges } from '../utils/git.js';
import { getConfig } from '../utils/config.js';
import { generateMessages } from '../utils/groq.js';
import { KnownError, handleCliError } from '../utils/error.js';

const [messageFilePath, commitSource] = process.argv.slice(2);

export default () =>
	(async () => {
		if (!messageFilePath) {
			throw new KnownError(
				'Commit message file path is missing. This file should be called from the "prepare-commit-msg" git hook'
			);
		}

		// If a commit message is passed in, ignore
		if (commitSource) {
			return;
		}

		if (!await hasStagedChanges()) return;

		const { env } = process;
		const config = await getConfig({
			GROQ_API_KEY: env.GROQ_API_KEY,
			proxy:
				env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
		});

		const staged = await getStagedDiff([], config['max-diff-chars']);
		if (!staged) return;
		intro(bgCyan(black(' lazycommit ')));
		const s = spinner();
		s.start('The AI is analyzing your changes');
		let messages: string[];
		try { messages = await generateMessages(config, staged.diff); }
		finally { s.stop('Changes analyzed'); }
		if (await getIndexTree() !== staged.tree) throw new KnownError('Staged changes changed during generation. Please retry the commit.');

		/**
		 * When `--no-edit` is passed in, the base commit message is empty,
		 * and even when you use pass in comments via #, they are ignored.
		 *
		 * Note: `--no-edit` cannot be detected in argvs so this is the only way to check
		 */
		const baseMessage = await fs.readFile(messageFilePath, 'utf8');
		const supportsComments = baseMessage !== '';
		const hasMultipleMessages = messages.length > 1 && supportsComments;

		let instructions = '';

		if (supportsComments) {
			instructions = `# 🤖 AI generated commit${
				hasMultipleMessages ? 's' : ''
			}\n`;
		}

		if (hasMultipleMessages) {
			if (supportsComments) {
				instructions +=
					'# Select one of the following messages by uncommenting:\n';
			}
			instructions += `\n${messages
				.map((message) => `# ${message}`)
				.join('\n')}`;
		} else {
			if (supportsComments) {
				instructions += '# Edit the message below and commit:\n';
			}
			instructions += `\n${messages[0]}\n`;
		}

		await fs.appendFile(messageFilePath, instructions);
		outro(`${green('✔')} Saved commit message!`);
	})().catch((error) => {
		outro(`${red('✖')} ${error.message}`);
		handleCliError(error);
		process.exit(1);
	});
