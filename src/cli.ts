import { cli } from 'cleye';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import lazycommit from './commands/lazycommit.js';
import prepareCommitMessageHook from './commands/prepare-commit-msg-hook.js';
import configCommand from './commands/config.js';
import hookCommand, { isCalledFromGitHook } from './commands/hook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
const { description, version } = packageJson;

const rawArgv = process.argv.slice(2);

cli(
	{
		name: 'lazycommit',

		version,

		/**
		 * Since this is a wrapper around `git commit`,
		 * flags should not overlap with it
		 * https://git-scm.com/docs/git-commit
		 */
		flags: {
			generate: {
				type: Number,
				description:
					'Number of messages to generate (Warning: generating multiple costs more) (default: 1)',
				alias: 'g',
			},
			exclude: {
				type: [String],
				description: 'Files to exclude from AI analysis',
				alias: 'x',
			},
			all: {
				type: Boolean,
				description:
					'Automatically stage changes in tracked files for the commit',
				alias: 'a',
				default: false,
			},
			type: {
				type: String,
				description: 'Type of commit message to generate',
				alias: 't',
			},
			model: { type: String, description: 'Groq model to use' },
			locale: { type: String, description: 'Language of the generated subject' },
			maxLength: { type: Number, description: 'Maximum subject length (20–200)' },
			maxDiffChars: { type: Number, description: 'Diff context budget (1000–100000 characters)' },
			timeout: { type: Number, description: 'Request timeout in milliseconds' },
			scope: { type: String, description: 'Explicit conventional commit scope' },
			context: { type: String, description: 'Additional context about the change' },
			dryRun: { type: Boolean, description: 'Print suggestions without committing or staging', default: false },
			previewDiff: { type: Boolean, description: 'Print analysis context locally without calling AI', default: false },
			thorough: { type: Boolean, description: 'Analyze every diff batch before generating (uses more requests)', default: false },
			yes: { type: Boolean, alias: 'y', description: 'Commit the first suggestion without prompting', default: false },
			includeGenerated: { type: Boolean, description: 'Include generated and lockfile patches in analysis', default: false },
		},

		commands: [configCommand, hookCommand],

		help: {
			description,
		},

		ignoreArgv: (type) => type === 'unknown-flag' || type === 'argument',
	},
	(argv) => {
		if (isCalledFromGitHook) {
			prepareCommitMessageHook();
		} else {
			lazycommit({
				config: {
					generate: argv.flags.generate?.toString(), type: argv.flags.type,
					model: argv.flags.model, locale: argv.flags.locale,
					'max-length': argv.flags.maxLength?.toString(),
					'max-diff-chars': argv.flags.maxDiffChars?.toString(),
					timeout: argv.flags.timeout?.toString(), scope: argv.flags.scope, context: argv.flags.context,
				},
				exclude: argv.flags.exclude, all: argv.flags.all,
				dryRun: argv.flags.dryRun, previewDiff: argv.flags.previewDiff, thorough: argv.flags.thorough, yes: argv.flags.yes,
				includeGenerated: argv.flags.includeGenerated,
				// cleye removes recognized options from this array in place.
				gitArgs: rawArgv,
			});
		}
	},
	rawArgv
);
