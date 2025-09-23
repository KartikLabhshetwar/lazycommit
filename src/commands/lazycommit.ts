import { execa } from 'execa';
import { black, dim, green, red, bgCyan } from 'kolorist';
import {
	intro,
	outro,
	spinner,
	select,
	confirm,
	isCancel,
} from '@clack/prompts';
import {
    assertGitRepo,
    getStagedDiff,
    getDetectedMessage,
    getDiffSummary,
    buildCompactSummary,
} from '../utils/git.js';
import { getConfig } from '../utils/config.js';
import { generateCommitMessageFromSummary } from '../utils/ai.js';
import { getHierarchicalCommitContext, formatCommitContext } from '../utils/commit-context.js';
import { KnownError, handleCliError } from '../utils/error.js';

type CommitGroup = {
    type: string;
    scope?: string;
    title: string;
    message?: string;
    files: string[];
};

const classifyFile = (file: string): { type: string; scope?: string } => {
    const lower = file.toLowerCase();
    const parts = file.split('/');
    
    // Documentation files
    if (lower.endsWith('.md') || lower.startsWith('docs/') || lower.includes('/docs/') || 
        lower.includes('readme') || lower.includes('changelog') || lower.includes('license') ||
        lower.endsWith('.rst') || lower.endsWith('.adoc')) {
        return { type: 'docs', scope: undefined };
    }
    
    // CI/CD and workflows
    if (lower.startsWith('.github/') || lower.startsWith('.gitlab/') || 
        (lower.endsWith('.yml') || lower.endsWith('.yaml')) && 
        (lower.includes('workflow') || lower.includes('pipeline') || lower.includes('action') || 
         lower.includes('ci') || lower.includes('deploy'))) {
        return { type: 'ci', scope: undefined };
    }
    
    // Build, config, and dependency files
    if (lower.endsWith('package.json') || lower.endsWith('pnpm-lock.yaml') || 
        lower.endsWith('yarn.lock') || lower.endsWith('package-lock.json') ||
        lower.endsWith('tsconfig.json') || lower.endsWith('jsconfig.json') ||
        lower.endsWith('vite.config.js') || lower.endsWith('webpack.config.js') ||
        lower.endsWith('rollup.config.js') || lower.endsWith('babel.config.js') ||
        lower.endsWith('.config.js') || lower.endsWith('.config.ts') ||
        lower.endsWith('dockerfile') || lower.endsWith('docker-compose.yml') ||
        lower.endsWith('makefile') || lower.endsWith('.mk') ||
        lower.includes('webpack') || lower.includes('rollup') || lower.includes('vite') || 
        lower.includes('babel') || lower.startsWith('config/')) {
        return { type: 'build', scope: undefined };
    }
    
    // Test files - more comprehensive detection
    if (lower.includes('/test/') || lower.includes('__tests__') || lower.includes('/tests/') ||
        lower.match(/\.(test|spec)\.[jt]sx?$/) || lower.includes('.test.') || 
        lower.includes('.spec.') || lower.startsWith('test/') || lower.startsWith('tests/') ||
        lower.includes('cypress/') || lower.includes('jest/') || lower.includes('vitest/')) {
        return { type: 'test', scope: undefined };
    }
    
    // Performance monitoring and analytics
    if (lower.includes('analytics') || lower.includes('metrics') || lower.includes('tracking')) {
        return { type: 'feat', scope: 'analytics' };
    }
    
    // Authentication and security
    if (lower.includes('auth') || lower.includes('login') || lower.includes('security') ||
        lower.includes('permission') || lower.includes('role')) {
        return { type: 'feat', scope: 'auth' };
    }
    
    // API routes and endpoints
    if (lower.startsWith('app/api/') || lower.includes('/api/') || lower.includes('routes/') ||
        lower.includes('endpoint') || lower.includes('handler')) {
        return { type: 'feat', scope: 'api' };
    }
    
    // Database and data layer
    if (lower.includes('database') || lower.includes('/db/') || lower.includes('migration') ||
        lower.includes('schema') || lower.includes('model') || lower.includes('entity') ||
        lower.endsWith('.sql') || lower.includes('prisma/')) {
        return { type: 'feat', scope: 'db' };
    }
    
    // UI Components and styling
    if (lower.includes('component') || lower.includes('ui/') || lower.includes('style') ||
        lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less') ||
        lower.endsWith('.styl') || lower.includes('theme')) {
        return { type: 'feat', scope: 'ui' };
    }
    
    // Utilities and helpers
    if (lower.includes('util') || lower.includes('helper') || lower.includes('lib/') ||
        lower.includes('common/') || lower.includes('shared/')) {
        return { type: 'refactor', scope: 'utils' };
    }
    
    // App-specific routing
    if (lower.startsWith('app/') || lower.startsWith('src/app/') || lower.includes('page') ||
        lower.includes('layout') || lower.includes('route')) {
        return { type: 'feat', scope: 'app' };
    }
    
    // Core source files
    if (lower.startsWith('src/')) {
        return { type: 'feat', scope: 'core' };
    }
    
    // Catch-all for maintenance
    return { type: 'chore', scope: undefined };
};

const topLevelScope = (file: string): string | undefined => {
    const parts = file.split('/');
    if (parts.length > 1) return parts[0];
    return undefined;
};

const groupFiles = (files: string[]): CommitGroup[] => {
    const buckets = new Map<string, { meta: { type: string; scope?: string }; files: string[] }>();
    for (const f of files) {
        const meta = classifyFile(f);
        const inferredScope = meta.scope || topLevelScope(f);
        const key = `${meta.type}:${inferredScope || 'general'}`;
        const bucket = buckets.get(key) || { meta: { type: meta.type, scope: inferredScope }, files: [] };
        bucket.files.push(f);
        buckets.set(key, bucket);
    }

    const commits: CommitGroup[] = [];
    for (const { meta, files: grouped } of buckets.values()) {
        const { type, scope } = meta;
        let titleBase = 'update files';
        if (type === 'docs') titleBase = 'update documentation';
        else if (type === 'ci') titleBase = 'update CI workflows';
        else if (type === 'build') titleBase = 'update build/configuration';
        else if (type === 'test') titleBase = 'update tests';
        else if (type === 'feat') titleBase = 'add or update features';
        else if (type === 'chore') titleBase = 'maintenance updates';

        const title = scope ? `${titleBase} in ${scope}` : titleBase;
        commits.push({ type, scope, title, files: grouped });
    }
    // Deterministic order: by conventional priority
    const order: Record<string, number> = { feat: 0, fix: 1, refactor: 2, perf: 3, test: 4, docs: 5, build: 6, ci: 7, chore: 8 };
    commits.sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99));
    return commits;
};

const getSecondLevelDir = (file: string): string | undefined => {
    const parts = file.split('/');
    // e.g., app/api/<second>/<...>
    if (parts.length >= 4 && parts[0] === 'app' && parts[1] === 'api') {
        return parts[2];
    }
    // generic: top-level or second-level
    if (parts.length >= 2) return parts[1];
    return undefined;
};

const summarizeFiles = async (files: string[]) => {
    if (files.length === 0) return '';
    const args = ['diff', '--cached', '--numstat', '--', ...files];
    const { stdout } = await execa('git', args);
    const lines: string[] = [];
    let totalAdds = 0;
    let totalDels = 0;
    const rows = stdout.split('\n').filter(Boolean);
    for (const row of rows) {
        const [addsStr, delsStr, file] = row.split('\t');
        const adds = Number(addsStr) || 0;
        const dels = Number(delsStr) || 0;
        totalAdds += adds;
        totalDels += dels;
        lines.push(`- ${file} (+${adds} / -${dels})`);
    }
    const header = `Files: ${files.length}, Additions: ${totalAdds}, Deletions: ${totalDels}`;
    return [header, ...lines.slice(0, 25)].join('\n');
};

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
	splitCommits: boolean,
	rawArgv: string[]
) =>
	(async () => {
		console.log(ASCII_LOGO);
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

		// Check if diff is very large and/or many files and show summary
		const diffSummary = await getDiffSummary(excludeFiles);
		const isLargeDiff = staged.diff.length > 50000; // ~12.5k chars (~3k tokens)
		const isManyFiles = staged.files.length >= 5;
		const hasLargeIndividualFile = diffSummary && diffSummary.fileStats.some(f => f.changes > 500);
		const shouldUseGrouping = isLargeDiff || isManyFiles || hasLargeIndividualFile;

		if (shouldUseGrouping && diffSummary) {
			let reason = 'Large diff detected';
			if (isManyFiles) reason = 'Many files detected';
			else if (hasLargeIndividualFile) reason = 'Large file changes detected';
			
			detectingFiles.stop(
				`${getDetectedMessage(staged.files)} (${diffSummary.totalChanges.toLocaleString()} changes):\n${staged.files
					.map((file) => `     ${file}`)
					.join('\n')}\n\n🎯  ${reason} - using smart grouping for better commit history`
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

		if (splitCommits || shouldUseGrouping) {
			// Multi-commit workflow
			let groups = groupFiles(staged.files);
			// If a single large group remains (e.g., all files under app/api), split by second-level dir
			if (groups.length === 1 && groups[0].files.length >= 5) {
				const bySecond = new Map<string, string[]>();
				for (const f of groups[0].files) {
					const second = getSecondLevelDir(f) || 'general';
					bySecond.set(second, [...(bySecond.get(second) || []), f]);
				}
				groups = Array.from(bySecond.entries()).map(([second, files]) => ({
					type: groups[0].type,
					scope: second,
					title: `update files in ${second}`,
					files,
				}));
			}
			
			if (groups.length === 1) {
				outro(`${dim('Only one group detected, falling back to single commit...')}`);
				splitCommits = false;
			} else {
				const s = spinner();
				s.start(`Generating commit messages for ${groups.length} groups`);
				
				try {
					for (const group of groups) {
						const summary = await summarizeFiles(group.files);
						const prompt = `Generate a single conventional commit message for this group of files. Follow commitlint (type(scope): subject). Keep <= ${config['max-length']} chars.\n\n${summary}`;
						
						try {
							const messages = await generateCommitMessageFromSummary(
								config,
								prompt,
								1,
								config['max-length'],
								'conventional'
							);
							if (messages.length > 0) {
								group.message = messages[0];
							} else {
								const scopePart = group.scope ? `(${group.scope})` : '';
								group.message = `${group.type}${scopePart}: ${group.title}`;
							}
						} catch {
							const scopePart = group.scope ? `(${group.scope})` : '';
							group.message = `${group.type}${scopePart}: ${group.title}`;
						}
					}
				} finally {
					s.stop('Commit messages generated');
				}

				// Show plan and confirm
				console.log('\n📋 Commit Plan:');
				groups.forEach((group, idx) => {
					console.log(`\n${idx + 1}. ${green(group.message!)}`);
					console.log(`   Files: ${group.files.join(', ')}`);
				});

				const confirmed = await confirm({
					message: `\nProceed with ${groups.length} commits?`,
				});

				if (!confirmed || isCancel(confirmed)) {
					outro('Commits cancelled');
					return;
				}

				// Execute commits sequentially
				for (let i = 0; i < groups.length; i++) {
					const group = groups[i];
					const commitSpinner = spinner();
					commitSpinner.start(`Creating commit ${i + 1}/${groups.length}: ${group.message}`);
					
					try {
						// Reset and stage only files for this group
						await execa('git', ['reset', 'HEAD', '--']);
						await execa('git', ['add', ...group.files]);
						await execa('git', ['commit', '-m', group.message!, ...rawArgv]);
					} finally {
						commitSpinner.stop(`Commit ${i + 1} created`);
					}
				}

				outro(`${green('✔')} Successfully created ${groups.length} commits!`);
				return;
			}
		}

		// Single commit workflow - use compact summary approach
		const s = spinner();
		s.start('The AI is analyzing your changes');
        let messages: string[];
		try {
			// Get commit context for better AI generation
			const commitContext = await getHierarchicalCommitContext(10);
			const contextString = formatCommitContext(commitContext);

			const compact = await buildCompactSummary(excludeFiles, 25);
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
				const fileList = staged.files.join(', ');
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
