import { execa } from 'execa';
import { intro, outro, spinner, select, multiselect, confirm, isCancel, text, log } from '@clack/prompts';
import { assertGitRepo, getStagedDiff, getDetectedMessage, getIndexTree, hasStagedChanges, getCurrentBranch, getUnstagedFiles, stageFiles } from '../utils/git.js';
import { getConfig, type RawConfig } from '../utils/config.js';
import { generateMessages, analyzeDiff, conventionalPattern, resolveModel } from '../utils/ai.js';
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

/** Splits the optional branch to push from the git commit options, which must not change the analyzed snapshot. */
export const parseGitArgs = (args: string[]) => {
	let branch: string | undefined;
	const gitArgs: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!branch && !arg.startsWith('-')) { branch = arg; continue; }
		gitArgs.push(arg);
		if (/^(--signoff|--no-signoff|-s|--no-verify|-n|--gpg-sign|--no-gpg-sign|-S|--quiet|-q|--verbose|-v)$/.test(arg)) continue;
		if (/^(--author|--date|--cleanup|--trailer)$/.test(arg)) {
			if (!args[++i] || args[i].startsWith('-')) throw new KnownError(`Missing value for ${arg}`);
			gitArgs.push(args[i]);
			continue;
		}
		if (/^(--author|--date|--cleanup|--trailer|--gpg-sign)=.+$/.test(arg) || /^-S.+$/.test(arg)) continue;
		throw new KnownError(`Unsupported git argument: ${arg}. Stage the intended files first. Use git commit directly for amend, message, or path options.`);
	}
	return { branch, gitArgs };
};

export default async (options: Options) => {
	let restoreTree: string | undefined;
	let stagedTree: string | undefined;
	try {
		const root = await assertGitRepo();
		const { branch, gitArgs } = parseGitArgs(options.gitArgs);
		const preview = options.dryRun || options.previewDiff;
		if (preview && options.all) throw new KnownError('Preview options cannot be combined with --all; stage changes first.');
		if (preview && branch) throw new KnownError(`Preview options cannot be combined with a branch; previews never commit or push ${branch}.`);
		if (branch) {
			const current = await getCurrentBranch();
			if (branch !== current) throw new KnownError(current ? `You are on ${current}, not ${branch}. Check out ${branch} first, or run lzc ${current}.` : `HEAD is detached. Check out ${branch} before pushing it.`);
			if ((await execa('git', ['remote', 'get-url', 'origin'], { reject: false })).failed) throw new KnownError('No origin remote found. Add one with `git remote add origin <url>`.');
		}
		const noChanges = 'No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.';
		const pick = !options.all && !await hasStagedChanges(options.exclude);
		if (pick && (preview || options.yes || !process.stdin.isTTY)) throw new KnownError(noChanges);
		const config = await getConfig({
			proxy: process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY,
			...options.config,
		});
		if (!options.previewDiff) resolveModel(config);
		if (options.all) await execa('git', ['add', '--update']);
		if (pick) {
			const files = await getUnstagedFiles();
			if (!files.length) throw new KnownError(noChanges);
			intro('lazycommit');
			const selected = await multiselect({
				message: 'Nothing staged. Select files to commit (space toggles, a toggles all)',
				options: files.map(file => ({ value: file.path, label: file.path, hint: file.status })),
				initialValues: files.map(file => file.path),
				required: true,
			});
			if (isCancel(selected)) { outro('Commit cancelled'); return; }
			restoreTree = await getIndexTree();
			await stageFiles(root, selected);
			stagedTree = await getIndexTree();
		}
		const snapshot = await getStagedDiff(options.exclude, config['max-diff-chars'], options.includeGenerated, options.thorough);
		if (!snapshot) throw new KnownError(noChanges);
		if (options.previewDiff) {
			console.log(options.thorough ? snapshot.chunks.join('\n\n--- Next analysis batch ---\n\n') : snapshot.diff);
			return;
		}
		if (!options.dryRun && !options.yes && !process.stdin.isTTY) throw new KnownError('Interactive input is unavailable. Use --dry-run to preview or --yes to commit the first suggestion.');
		if (pick) log.step(getDetectedMessage(snapshot.files));
		else if (!options.dryRun) intro(`lazycommit · ${getDetectedMessage(snapshot.files)}`);
		let analysis = options.thorough ? undefined : snapshot.diff;
		let message = '';
		for (;;) {
			const progress = options.dryRun || options.yes ? undefined : spinner();
			progress?.start('Analyzing staged changes');
			let messages: string[];
			try {
				analysis ??= await analyzeDiff(config, snapshot.chunks);
				messages = await generateMessages(config, analysis, snapshot.overview);
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
					validate: value => !value?.trim() ? 'Message cannot be empty' : /[\x00-\x1f\x7f]/.test(value) ? 'Use a single line without control characters'
						: config.type === 'conventional' && !conventionalPattern.test(value.trim()) ? 'Use Conventional Commits format: type(scope): description' : undefined,
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
		await execa('git', ['commit', '-m', message, ...gitArgs]);
		restoreTree = undefined;
		if (!branch) { outro('Successfully committed!'); return; }
		log.success('Successfully committed!');
		const push = await execa('git', ['push', '-u', 'origin', branch], { stdio: 'inherit', reject: false });
		if (push.failed) throw new KnownError(`Push to origin/${branch} failed. Your commit is kept: fix the problem above, then run \`git push -u origin ${branch}\`.`);
		outro(`Successfully committed and pushed to origin/${branch}!`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (options.dryRun || options.previewDiff) console.error(message);
		else outro(message);
		handleCliError(error);
		process.exitCode = 1;
	} finally {
		if (restoreTree && await getIndexTree().catch(() => undefined) === stagedTree) await execa('git', ['read-tree', restoreTree], { reject: false });
	}
};
