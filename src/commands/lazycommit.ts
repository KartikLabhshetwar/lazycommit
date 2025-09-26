import { execa } from 'execa';
import { black, dim, green, red, bgCyan } from 'kolorist';
import {
	intro,
	outro,
	spinner,
	select,
	confirm,
	isCancel,
    text,
} from '@clack/prompts';
import {
    assertGitRepo,
    getStagedDiff,
    getDetectedMessage,
    getDiffSummary,
    buildCompactSummary,
} from '../utils/git.js';
import { getConfig } from '../utils/config.js';
import { generateCommitMessageFromSummary } from '../utils/groq.js';
import { generatePrompt } from '../utils/prompt.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { renderTitle } from '../utils/render-title.js';


// Build lightweight per-file diff snippets to give semantic context without huge payloads
const buildDiffSnippets = async (
    files: string[],
    perFileMaxLines: number = 30,
    totalMaxChars: number = 4000
): Promise<string> => {
    try {
        const targetFiles = files.slice(0, 5);
        const parts: string[] = [];
        let remaining = totalMaxChars;
        for (const f of targetFiles) {
            const { stdout } = await execa('git', ['diff', '--cached', '--unified=0', '--', f]);
            if (!stdout) continue;
            const lines = stdout.split('\n').filter(Boolean);
            const picked: string[] = [];
            let count = 0;
            for (const line of lines) {
                const isHunk = line.startsWith('@@');
                const isChange = (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---');
                if (isHunk || isChange) {
                    picked.push(line);
                    count++;
                    if (count >= perFileMaxLines) break;
                }
            }
            if (picked.length > 0) {
                const block = [`# ${f}`, ...picked].join('\n');
                if (block.length <= remaining) {
                    parts.push(block);
                    remaining -= block.length;
                } else {
                    parts.push(block.slice(0, Math.max(0, remaining)));
                    remaining = 0;
                }
            }
            if (remaining <= 0) break;
        }
        if (parts.length === 0) return '';
        return ['Context snippets (truncated):', ...parts].join('\n');
    } catch {
        return '';
    }
};

export const buildSingleCommitPrompt = async (
    files: string[],
    compactSummary: string,
    maxLength: number
): Promise<string> => {
    const snippets = await buildDiffSnippets(files, 30, 3000);
    return `Analyze the following git changes and generate a single, complete conventional commit message.

CHANGES SUMMARY:
${compactSummary}

${snippets ? `\nCODE CONTEXT:\n${snippets}\n` : ''}

TASK: Write ONE conventional commit message that accurately describes what was changed.

REQUIREMENTS:
- Format: type: subject (NO scope, just type and subject)
- Maximum ${maxLength} characters
- Be specific and descriptive
- Use imperative mood, present tense
- Include the main component/area affected
- Complete the message - never truncate mid-sentence

COMMIT TYPE GUIDELINES:
- feat: NEW user-facing features only
- refactor: code improvements, restructuring, internal changes
- fix: bug fixes that resolve issues
- docs: documentation changes only
- chore: config updates, maintenance, dependencies

EXAMPLES (correct format - NO scope, just type and subject):
- feat: add user login with OAuth integration
- fix: resolve memory leak in image processing service
- refactor: improve message generation with better prompts
- refactor: increase default max-length from 50 to 100
- docs: update installation and configuration guide
- test: add unit tests for JWT token validation
- chore: update axios to v1.6.0 for security patches

WRONG FORMAT (do not use):
- feat(auth): add user login
- refactor(commit): improve prompts

Return only the commit message line, no explanations.`;
};

export default async (
	generate: number | undefined,
	excludeFiles: string[],
	stageAll: boolean,
	commitType: string | undefined,
	splitCommits: boolean,
	rawArgv: string[]
) =>
	(async () => {
		renderTitle();
		console.log();
		intro(bgCyan(black(' lazycommit ')));
		await assertGitRepo();

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

		// Check if diff is very large and/or many files for enhanced analysis
		const diffSummary = await getDiffSummary(excludeFiles);
		const isLargeDiff = staged.diff.length > 50000; // ~12.5k chars (~3k tokens)
		const isManyFiles = staged.files.length >= 5;
		const hasLargeIndividualFile = diffSummary && diffSummary.fileStats.some(f => f.changes > 500);
		const needsEnhancedAnalysis = isLargeDiff || isManyFiles || hasLargeIndividualFile;

		if (needsEnhancedAnalysis && diffSummary) {
			let reason = 'Large diff detected';
			if (isManyFiles) reason = 'Many files detected';
			else if (hasLargeIndividualFile) reason = 'Large file changes detected';
			
			detectingFiles.stop(
				`${getDetectedMessage(staged.files)} (${diffSummary.totalChanges.toLocaleString()} changes):\n${staged.files
					.map((file) => `     ${file}`)
					.join('\n')}\n\n  ${reason} - using enhanced analysis for better commit message`
			);
		} else {
			detectingFiles.stop(
				`${getDetectedMessage(staged.files)}:\n${staged.files
					.map((file) => `     ${file}`)
					.join('\n')}`
			);
		}

		const { env } = process;
		const config = await getConfig({
			GROQ_API_KEY: env.GROQ_API_KEY,
			proxy:
				env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
			generate: generate?.toString(),
			type: commitType?.toString(),
		});

		// Grouping flow disabled

		// Single commit workflow - use compact summary approach
		const s = spinner();
		s.start('The AI is analyzing your changes');
        let messages: string[];
		try {
			const compact = await buildCompactSummary(excludeFiles, 25);
			if (compact) {
				const enhanced = await buildSingleCommitPrompt(staged.files, compact, config['max-length']);
				messages = await generateCommitMessageFromSummary(
					config.GROQ_API_KEY,
					config.model,
					config.locale,
					enhanced,
					config.generate,
					config['max-length'],
					config.type,
					config.timeout,
					config.proxy
				);
			} else {
				// Fallback to simple file list if summary fails
				const fileList = staged.files.join(', ');
				const fallbackPrompt = await buildSingleCommitPrompt(staged.files, `Files: ${fileList}`, config['max-length']);
				const systemPrompt = generatePrompt(config.locale, config['max-length'], config.type);
				messages = await generateCommitMessageFromSummary(
					config.GROQ_API_KEY,
					config.model,
					config.locale,
					fallbackPrompt,
					config.generate,
					config['max-length'],
					config.type,
					config.timeout,
					config.proxy
				);
			}
		} finally {
			s.stop('Changes analyzed');
		}

		if (messages.length === 0) {
			throw new KnownError('No commit messages were generated. Try again.');
		}

		let message: string;
		let editedAlready = false;
		let useAsIs = false;
		if (messages.length === 1) {
			[message] = messages;
			const choice = await select({
				message: `Review generated commit message:\n\n   ${message}\n`,
				options: [
					{ label: 'Use as-is', value: 'use' },
					{ label: 'Edit', value: 'edit' },
					{ label: 'Cancel', value: 'cancel' },
				],
			});

			if (isCancel(choice) || choice === 'cancel') {
				outro('Commit cancelled');
				return;
			}

			if (choice === 'use') {
				useAsIs = true;
			} else if (choice === 'edit') {
				const edited = await text({
					message: 'Edit commit message:',
					initialValue: message,
					validate: (value) => (value && value.trim().length > 0 ? undefined : 'Message cannot be empty'),
				});
				if (isCancel(edited)) {
					outro('Commit cancelled');
					return;
				}
				message = String(edited).trim();
				editedAlready = true;
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
			useAsIs = true;
		}

		if (!useAsIs && !editedAlready) {
			const wantsEdit = await confirm({ message: 'Edit the commit message before committing?' });
			if (wantsEdit && !isCancel(wantsEdit)) {
				const edited = await text({
					message: 'Edit commit message:',
					initialValue: message,
					validate: (value) => (value && value.trim().length > 0 ? undefined : 'Message cannot be empty'),
				});
				if (isCancel(edited)) {
					outro('Commit cancelled');
					return;
				}
				message = String(edited).trim();
				editedAlready = true;
			}
		}

		// Final proceed confirmation displaying the message (skip if user chose 'Use as-is')
		if (!useAsIs) {
			const proceed = await confirm({
				message: `Proceed with this commit message?\n\n   ${message}\n`,
			});
			if (!proceed || isCancel(proceed)) {
				outro('Commit cancelled');
				return;
			}
		}

		await execa('git', ['commit', '-m', message, ...rawArgv]);

		outro(`${green('✔')} Successfully committed!`);
	})().catch((error) => {
		outro(`${red('✖')} ${error.message}`);
		handleCliError(error);
		process.exit(1);
	});
