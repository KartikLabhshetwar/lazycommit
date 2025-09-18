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
        description: 'Number of messages to generate (Warning: generating multiple costs more) (default: 1)',
        alias: 'g',
      },
      exclude: {
        type: [String],
        description: 'Files to exclude from AI analysis',
        alias: 'x',
      },
      all: {
        type: Boolean,
        description: 'Automatically stage changes in tracked files for the commit',
        alias: 'a',
        default: false,
      },
      type: {
        type: String,
        description: 'Type of commit message to generate',
        alias: 't',
      },
      provider: {
        type: String,
        description: 'AI provider to use (groq, openrouter)',
        alias: 'p',
      },
      model: {
        type: String,
        description: 'AI model to use',
        alias: 'm',
      },
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
      lazycommit(
        argv.flags.generate,
        argv.flags.exclude,
        argv.flags.all,
        argv.flags.type,
        argv.flags.provider,
        argv.flags.model,
        rawArgv
      );
    }
  },
  rawArgv
);
