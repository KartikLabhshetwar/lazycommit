import { execa } from 'execa';
import { intro, outro, spinner, select, confirm, isCancel, text } from '@clack/prompts';
import { assertGitRepo, getStagedDiff, getDetectedMessage, getIndexTree, hasStagedChanges } from '../utils/git.js';
import { getConfig, type RawConfig } from '../utils/config.js';
import { generateMessages, analyzeDiff } from '../utils/groq.js';
import { KnownError, handleCliError } from '../utils/error.js';

type Options = {
	config: RawConfig;
	exclude: string[];
	all: boolean;
	dryRun: boolean;
	previewDiff: boolean;
	thorough: boolean;
	yes: boolean;
	includeGenerated: boolean;
	gitArgs: string[];
};

export const validateGitArgs = (args: string[]) => {
	// Only forward metadata options: content/path options invalidate the analyzed snapshot.
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (/^(--signoff|--no-signoff|-s|--no-verify|-n|--gpg-sign|--no-gpg-sign|-S|--quiet|-q|--verbose|-v)$/.test(arg)) continue;
		if (/^(--author|--date|--cleanup|--trailer)$/.test(arg)) {
			if (!args[++i] || args[i].startsWith('-')) throw new KnownError(`Missing value for ${arg}`);
			continue;
		}
		if (/^(--author|--date|--cleanup|--trailer|--gpg-sign)=.+$/.test(arg) || /^-S.+$/.test(arg)) continue;
		throw new KnownError(`Unsupported git argument: ${arg}. Stage the intended files first. Use git commit directly for amend, message, or path options.`);
	}
};

export default async (options: Options) => {
	try {
		await assertGitRepo();
		validateGitArgs(options.gitArgs);
		if ((options.dryRun || options.previewDiff) && options.all) throw new KnownError('Preview options cannot be combined with --all; stage changes first.');
		const noChanges = 'No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.';
		if (!options.all && !await hasStagedChanges(options.exclude)) throw new KnownError(noChanges);
		const config = await getConfig({
			GROQ_API_KEY: options.previewDiff ? 'gsk_preview' : process.env.GROQ_API_KEY,
			proxy: process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY,
			...options.config,
		});
		if (options.all) await execa('git', ['add', '--update']);
		const snapshot = await getStagedDiff(options.exclude, config['max-diff-chars'], options.includeGenerated, options.thorough);
		if (!snapshot) throw new KnownError(noChanges);
		if (options.previewDiff) {
			console.log(options.thorough ? snapshot.chunks.join('\n\n--- Next analysis batch ---\n\n') : snapshot.diff);
			return;
		}
		if (!options.dryRun && !options.yes && !process.stdin.isTTY) throw new KnownError('Interactive input is unavailable. Use --dry-run to preview or --yes to commit the first suggestion.');
		if (!options.dryRun) intro(`lazycommit · ${getDetectedMessage(snapshot.files)}`);
		let analysis = options.thorough ? undefined : snapshot.diff;
		let message = '';
		for (;;) {
			const progress = options.dryRun || options.yes ? undefined : spinner();
			progress?.start('Analyzing staged changes');
			let messages: string[];
			try {
				analysis ??= await analyzeDiff(config, snapshot.chunks);
				messages = await generateMessages(config, analysis);
			}
			finally { progress?.stop('Analysis finished'); }
			if (options.dryRun) {
				console.log(messages.join('\n'));
				return;
			}
			[message] = messages;
			if (options.yes) break;
			if (messages.length > 1) {
				const selected = await select({ message: 'Choose a commit message', options: messages.map(value => ({ value, label: value })) });
				if (isCancel(selected)) { outro('Commit cancelled'); return; }
				message = selected;
			}
			const action = await select({
				message: `Review commit message:\n\n${message}`,
				options: [
					{ value: 'use', label: 'Use as-is' }, { value: 'edit', label: 'Edit' },
					{ value: 'regenerate', label: 'Regenerate' }, { value: 'cancel', label: 'Cancel' },
				],
			});
			if (isCancel(action) || action === 'cancel') { outro('Commit cancelled'); return; }
			if (action === 'regenerate') continue;
			if (action === 'edit') {
				const edited = await text({
					message: 'Edit commit message', initialValue: message,
					validate: value => !value?.trim() ? 'Message cannot be empty' : /[\x00-\x1f\x7f]/.test(value) ? 'Use a single line without control characters' : undefined,
				});
				if (isCancel(edited)) { outro('Commit cancelled'); return; }
				message = edited.trim();
				const proceed = await confirm({ message: `Commit with this message?\n\n${message}` });
				if (isCancel(proceed) || !proceed) { outro('Commit cancelled'); return; }
			}
			break;
		}
		const currentHead = await execa('git', ['rev-parse', '--verify', 'HEAD'], { reject: false });
		if (await getIndexTree() !== snapshot.tree || (currentHead.failed ? '' : currentHead.stdout) !== snapshot.head) {
			throw new KnownError('Staged changes or HEAD changed during review. Run lazycommit again to analyze the current changes.');
		}
		await execa('git', ['commit', '-m', message, ...options.gitArgs]);
		outro('Successfully committed!');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (options.dryRun || options.previewDiff) console.error(message);
		else outro(message);
		handleCliError(error);
		process.exitCode = 1;
	}
};
