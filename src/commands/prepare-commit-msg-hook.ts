import fs from 'fs/promises';
import { intro, outro, spinner } from '@clack/prompts';
import { black, green, red, bgCyan } from 'kolorist';
import { getStagedDiff, buildCompactSummary } from '../utils/git.js';
import { getConfig } from '../utils/config.js';
import { generateCommitMessageFromSummary } from '../utils/ai.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { getHierarchicalCommitContext, formatCommitContext } from '../utils/commit-context.js';

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

		// All staged files can be ignored by our filter
		const staged = await getStagedDiff();
		if (!staged) {
			return;
		}

		intro(bgCyan(black(' lazycommit ')));

		const { env } = process;
		const config = await getConfig({
			GROQ_API_KEY: env.GROQ_API_KEY,
			OPENAI_API_KEY: env.OPENAI_API_KEY,
			ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
			provider: env.LAZYCOMMIT_PROVIDER,
			proxy:
				env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
		});

		const s = spinner();
		s.start('The AI is analyzing your changes');
		let messages: string[];
		try {
			// Get commit context for better AI generation
			const commitContext = await getHierarchicalCommitContext(10);
			const contextString = formatCommitContext(commitContext);

			const compact = await buildCompactSummary();
			if (compact) {
				// Include context if available
				const enhancedPrompt = contextString
					? `${compact}\n\n${contextString}`
					: compact;
				messages = await generateCommitMessageFromSummary(
					config,
					enhancedPrompt,
					config.generate,
					config['max-length'],
					config.type
				);
			} else {
				// Fallback to simple file list if summary fails
				const fileList = staged!.files.join(', ');
				const fallbackPrompt = `Generate a commit message for these files: ${fileList}`;
				messages = await generateCommitMessageFromSummary(
					config,
					fallbackPrompt,
					config.generate,
					config['max-length'],
					config.type
				);
			}
		} finally {
			s.stop('Changes analyzed');
		}

		/**
		 * When `--no-edit` is passed in, the base commit message is empty,
		 * and even when you use pass in comments via #, they are ignored.
		 *
		 * Note: `--no-edit` cannot be detected in argvs so this is the only way to check
		 */
		const baseMessage = await fs.readFile(messageFilePath, 'utf8');
		const supportsComments = baseMessage !== '';
		const hasMultipleMessages = messages.length > 1;

		let commitMessage = '';

		if (hasMultipleMessages) {
			// Multiple messages - comment them all out for selection
			if (supportsComments) {
				commitMessage = `# 🤖 AI generated commits\n`;
				commitMessage += '# Select one of the following messages by uncommenting:\n\n';
			}
			commitMessage += messages
				.map((message) => `# ${message}`)
				.join('\n');
		} else {
			// Single message - use it directly
			commitMessage = messages[0];
			if (supportsComments) {
				commitMessage = `${messages[0]}\n\n# 🤖 AI generated commit message`;
			}
		}

		// Prepend the commit message to the existing content
		const newContent = baseMessage ? `${commitMessage}\n\n${baseMessage}` : commitMessage;
		await fs.writeFile(messageFilePath, newContent);
		outro(`${green('✔')} Saved commit message!`);
	})().catch((error) => {
		outro(`${red('✖')} ${error.message}`);
		handleCliError(error);
		process.exit(1);
	});
