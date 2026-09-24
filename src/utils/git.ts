import { createInterface } from 'node:readline';
import { execa } from 'execa';
import { KnownError } from './error.js';

export const assertGitRepo = async () => {
	const { stdout, failed } = await execa('git', ['rev-parse', '--show-toplevel'], { reject: false });
	if (failed) throw new KnownError('The current directory must be a Git repository!');
	return stdout;
};

export const getIndexTree = async () => (await execa('git', ['write-tree'])).stdout;

// Keep generated files in the summary, but spend the code-context budget on source.
const generatedFiles = [
	'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb',
	'*.lock', '*.min.js', '*.min.css', '*.bundle.js', '*.bundle.css',
	'node_modules/**', 'dist/**', 'build/**', '.next/**', 'coverage/**',
];
const excludePath = (file: string) => `:(top,exclude)${file}`;

export const hasStagedChanges = async (excludeFiles: string[] = []) => {
	const result = await execa('git', ['diff', '--cached', '--quiet', '--no-ext-diff', '--', ':(top)**', ...excludeFiles.map(excludePath)], { reject: false });
	if (result.exitCode !== 0 && result.exitCode !== 1) throw new KnownError('Unable to inspect staged changes. Resolve index conflicts and retry.');
	return result.exitCode === 1;
};

export const getStagedDiff = async (
	excludeFiles: string[] = [],
	maxDiffChars = 16000,
	includeGenerated = false,
	thorough = false,
) => {
	const tree = await getIndexTree();
	const head = await execa('git', ['rev-parse', '--verify', 'HEAD'], { reject: false });
	const base = head.failed
		? (await execa('git', ['hash-object', '-t', 'tree', '--stdin'], { input: '' })).stdout
		: head.stdout;
	const args = ['diff', '--no-ext-diff', '--no-textconv', '--no-color', '--no-relative', '--find-renames', base, tree];
	const paths = ['--', ':(top)**', ...excludeFiles.map(excludePath)];
	const { stdout } = await execa('git', [...args, '--numstat', '-z', ...paths], { stripFinalNewline: false });
	if (!stdout) return;

	const records = stdout.split('\0');
	const files: string[] = [];
	const stats: string[] = [];
	for (let i = 0; i < records.length && records[i]; i++) {
		const match = records[i].match(/^(\d+|-)\t(\d+|-)\t([\s\S]*)$/);
		if (!match) throw new KnownError('Unable to read staged file statistics.');
		const [, added, deleted, name] = match;
		const oldName = name ? undefined : records[++i];
		const file = name || records[++i];
		files.push(file);
		stats.push(`${JSON.stringify(file)}${oldName ? ` (renamed from ${JSON.stringify(oldName)})` : ''}: ${added === '-' ? 'binary change' : `+${added} -${deleted}`}`);
	}

	const summaryLimit = Math.floor(maxDiffChars / 3);
	let summary = `Staged files: ${files.length}\n`;
	let shown = 0;
	for (const stat of stats) {
		if (summary.length + stat.length + 80 > summaryLimit) break;
		summary += `${stat}\n`;
		shown++;
	}
	if (shown < files.length) summary += `[${files.length - shown} more files omitted from summary]\n`;
	const budget = maxDiffChars - summary.length - 160;
	const perFile = Math.max(120, Math.min(3000, Math.floor(budget / Math.min(files.length, 30))));
	const chunks: string[] = [];
	let chunk = '';
	let contextSize = 0;
	let chunkLabel = 'File statistics';
	const addContext = (text: string) => {
		if (!thorough) return;
		contextSize += text.length;
		if (contextSize > 1_600_000) throw new KnownError('Thorough analysis exceeds 1.6 million characters. Exclude generated files or split the commit.');
		chunk += text;
		while (chunk.length >= 16000) {
			const newline = chunk.lastIndexOf('\n', 15999);
			const end = newline >= 8000 ? newline + 1 : 16000;
			chunks.push(chunk.slice(0, end));
			chunk = `Continuation: ${chunkLabel.slice(0, 500)}\n${chunk.slice(end)}`;
		}
	};
	addContext(`File statistics:\n${stats.join('\n')}\n`);
	const snippets: string[] = [];
	let patch = '';
	let patchFits = true;
	let snippet = '';
	let omitted = false;
	let used = 0;
	let omittedFiles = 0;
	const flush = () => {
		if (!snippet) return;
		const block = snippet + (omitted ? '\n[remaining file diff omitted]' : '');
		if (used + block.length + 1 <= budget) {
			snippets.push(block);
			used += block.length + 1;
		} else omittedFiles++;
		snippet = '';
		omitted = false;
	};
	const diff = execa('git', [
		...args, '--unified=3', ...paths,
		...(includeGenerated ? [] : generatedFiles.map(excludePath)),
	], { buffer: false });
	const lines = createInterface({ input: diff.stdout! });
	// ponytail: bounded leading hunks per file; semantic hunk ranking can follow if needed.
	try {
		for await (const line of lines) {
			if (line.startsWith('diff --git ')) chunkLabel = line;
			addContext(`${line}\n`);
			if (patchFits && patch.length + line.length + 1 <= budget) patch += `${line}\n`;
			else { patchFits = false; patch = ''; }
			if (line.startsWith('diff --git ')) flush();
			if (snippet.length + line.length + 1 <= perFile) snippet += `${line}\n`;
			else omitted = true;
		}
	} catch (error) {
		diff.kill();
		await diff.catch(() => {});
		throw error;
	}
	flush();
	await diff;
	if (chunk) chunks.push(chunk);
	return {
		files, tree, chunks, head: head.failed ? '' : head.stdout,
		diff: `${summary}\n${patchFits ? 'Diff' : 'Sampled diff (omissions marked)'}:\n${patchFits ? patch : snippets.join('\n')}${!patchFits && omittedFiles ? `\n[${omittedFiles} file patches omitted]` : ''}\n${includeGenerated ? '' : '[Generated-file patches omitted; statistics retained]'}`,
	};
};

export const getDetectedMessage = (files: string[]) =>
	`Detected ${files.length.toLocaleString()} staged file${files.length === 1 ? '' : 's'}`;
