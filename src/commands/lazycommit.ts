import { execa } from 'execa';
import { black, dim, green, red, bgCyan } from 'kolorist';
import { intro, outro, spinner, select, confirm, isCancel, log } from '@clack/prompts';
import { assertGitRepo, getStagedDiff, getDetectedMessage, getDiffSummary, buildCompactSummary } from '../utils/git.js';
import { getConfig, setConfigs } from '../utils/config.js';
import { generateCommitMessageFromChunks, generateCommitMessageFromSummary } from '../utils/ai-provider.js';
import { KnownError, handleCliError } from '../utils/error.js';

const ASCII_LOGO = `╔──────────────────────────────────────────────────────────────────────────────────────╗
│                                                                                      │
│ ██╗      █████╗ ███████╗██╗   ██╗ ██████╗ ██████╗ ███╗   ███╗███╗   ███╗██╗████████╗ │
│ ██║     ██╔══██╗╚══███╔╝╚██╗ ██╔╝██╔════╝██╔═══██╗████╗ ████║████╗ ████║██║╚══██╔══╝ │
│ ██║     ███████║  ███╔╝  ╚████╔╝ ██║     ██║   ██║██╔████╔██║██╔████╔██║██║   ██║    │
│ ██║     ██╔══██║ ███╔╝    ╚██╔╝  ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██║   ██║    │
│ ███████╗██║  ██║███████╗   ██║   ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║   ██║    │
│ ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝   ╚═╝    │
│                                                                                      │
╚──────────────────────────────────────────────────────────────────────────────────────╝`;

export default async (
  generate: number | undefined,
  excludeFiles: string[],
  stageAll: boolean,
  commitType: string | undefined,
  provider: string | undefined,
  model: string | undefined,
  rawArgv: string[]
) =>
  (async () => {
    console.log(ASCII_LOGO);
    console.log();
    intro(bgCyan(black(' lazycommit ')));
    await assertGitRepo();

    // Update config file with CLI flags if provided
    const configUpdates: [string, string][] = [];
    if (provider) configUpdates.push(['provider', provider]);
    if (model) configUpdates.push(['model', model]);

    if (configUpdates.length > 0) {
      await setConfigs(configUpdates);
      // If only config flags were provided (no staged files), exit early
      if (!stageAll) {
        const detectingFiles = spinner();
        detectingFiles.start('Detecting staged files');
        const staged = await getStagedDiff(excludeFiles);
        if (!staged) {
          detectingFiles.stop('Configuration updated successfully');
          outro('✅ Configuration updated');
          return;
        }
      }
    }

    const detectingFiles = spinner();

    if (stageAll) {
      // This should be equivalent behavior to `git commit --all`
      await execa('git', ['add', '--update']);
    }

    detectingFiles.start('Detecting staged files');
    const staged = await getStagedDiff(excludeFiles);

    if (!staged) {
      detectingFiles.stop('Detecting staged files');
      throw new KnownError(
        'No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.'
      );
    }

    // Check if diff is very large and show summary
    const diffSummary = await getDiffSummary(excludeFiles);
    const isLargeDiff = staged.diff.length > 50000; // ~12.5k chars (~3k tokens)

    if (isLargeDiff && diffSummary) {
      detectingFiles.stop(
        `${getDetectedMessage(staged.files)} (${diffSummary.totalChanges.toLocaleString()} changes):\n${staged.files
          .map((file) => `     ${file}`)
          .join('\n')}\n\n⚠️  Large diff detected - using chunked processing`
      );
    } else {
      detectingFiles.stop(
        `${getDetectedMessage(staged.files)}:\n${staged.files.map((file) => `     ${file}`).join('\n')}`
      );
    }

    const { env } = process;

    const config = await getConfig({
      GROQ_API_KEY: env.GROQ_API_KEY,
      proxy: env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
      generate: generate?.toString(),
      type: commitType?.toString(),
      provider: provider,
      model: model,
    });

    // Check if we need to prompt for setup
    const hasGroqKey = !!(env.GROQ_API_KEY || config.GROQ_API_KEY);
    const hasOpenRouterKey = !!env.OPENROUTER_API_KEY;
    const hasAnyKey = hasGroqKey || hasOpenRouterKey;

    if (!hasAnyKey) {
      console.log();
      log.warn('No API key found. Please run setup first:');
      log.step('lazycommit setup');
      console.log();
      outro('Or set your API key manually:');
      log.step('export GROQ_API_KEY=your_key  # or');
      log.step('export OPENROUTER_API_KEY=your_key');
      process.exit(1);
    }

    const s = spinner();
    s.start('The AI is analyzing your changes');
    let messages: string[];

    try {
      if (isLargeDiff) {
        const compact = await buildCompactSummary(excludeFiles, 25);
        if (compact) {
          messages = await generateCommitMessageFromSummary(
            config,
            config.locale,
            compact,
            config.generate,
            config['max-length'],
            config.type,
            config.timeout,
            config.proxy
          );
        } else {
          messages = await generateCommitMessageFromChunks(
            config,
            config.locale,
            staged.diff,
            config.generate,
            config['max-length'],
            config.type,
            config.timeout,
            config.proxy,
            config['chunk-size']
          );
        }
      } else {
        messages = await generateCommitMessageFromChunks(
          config,
          config.locale,
          staged.diff,
          config.generate,
          config['max-length'],
          config.type,
          config.timeout,
          config.proxy,
          config['chunk-size']
        );
      }
    } finally {
      s.stop('Changes analyzed');
    }

    if (messages.length === 0) {
      throw new KnownError('No commit messages were generated. Try again.');
    }

    let message: string;
    if (messages.length === 1) {
      [message] = messages;
      const confirmed = await confirm({
        message: `Use this commit message?\n\n   ${message}\n`,
      });

      if (!confirmed || isCancel(confirmed)) {
        outro('Commit cancelled');
        return;
      }
    } else {
      const selected = await select({
        message: `Pick a commit message to use: ${dim('(Ctrl+c to exit)')}`,
        options: messages.map((value) => ({ label: value, value })),
      });

      if (isCancel(selected)) {
        outro('Commit cancelled');
        return;
      }

      message = selected as string;
    }

    await execa('git', ['commit', '-m', message, ...rawArgv]);

    outro(`${green('✔')} Successfully committed!`);
  })().catch((error) => {
    outro(`${red('✖')} ${error.message}`);
    handleCliError(error);
    process.exit(1);
  });
