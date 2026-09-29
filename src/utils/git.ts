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

type Area = { path: string; files: number; added: number; deleted: number; stat?: string; children: Map<string, Area> };

const byWeight = (a: Area, b: Area) => b.added + b.deleted - a.added - a.deleted || b.files - a.files;
const leaves = (area: Area): Area[] => area.stat ? [area] : [...area.children.values()].flatMap(leaves);
const describeArea = (area: Area) => area.stat ?? `${area.path ? JSON.stringify(area.path) : 'Other paths'}: ${area.files} file${area.files === 1 ? '' : 's'}, +${area.added} -${area.deleted}`;

const addFile = (root: Area, file: string, added: number, deleted: number, stat: string) => {
	const parts = file.split('/');
	let node = root;
	for (let i = 0; ; i++) {
		node.files++;
		node.added += added;
		node.deleted += deleted;
		if (i === parts.length) { node.stat = stat; return; }
		const key = parts[i] + (i < parts.length - 1 ? '/' : '');
		if (!node.children.has(key)) node.children.set(key, { path: node.path + key, files: 0, added: 0, deleted: 0, children: new Map() });
		node = node.children.get(key)!;
	}
};

/** Splits the heaviest directories while at most `limit` areas cover every staged file. */
export const changeAreas = (root: Area, limit: number) => {
	let areas = [...root.children.values()];
	for (;;) {
		const next = areas.filter(area => area.children.size === 1 || (area.children.size && areas.length + area.children.size - 1 <= limit)).sort(byWeight)[0];
		if (!next) break;
		areas = areas.flatMap(area => area === next ? [...area.children.values()] : [area]);
	}
	areas.sort(byWeight);
	if (areas.length <= limit) return areas;
	const rest = areas.splice(limit - 1);
	areas.push({
		path: '', files: rest.reduce((sum, area) => sum + area.files, 0),
		added: rest.reduce((sum, area) => sum + area.added, 0), deleted: rest.reduce((sum, area) => sum + area.deleted, 0),
		children: new Map(rest.map(area => [area.path, area])),
	});
	return areas;
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
	const root: Area = { path: '', files: 0, added: 0, deleted: 0, children: new Map() };
	for (let i = 0; i < records.length && records[i]; i++) {
		const match = records[i].match(/^(\d+|-)\t(\d+|-)\t([\s\S]*)$/);
		if (!match) throw new KnownError('Unable to read staged file statistics.');
		const [, added, deleted, name] = match;
		const oldName = name ? undefined : records[++i];
		const file = name || records[++i];
		files.push(file);
		const stat = `${JSON.stringify(file)}${oldName ? ` (renamed from ${JSON.stringify(oldName)})` : ''}: ${added === '-' ? 'binary change' : `+${added} -${deleted}`}`;
		stats.push(stat);
		addFile(root, file, Number(added) || 0, Number(deleted) || 0, stat);
	}

	const summaryLimit = Math.floor(maxDiffChars / 3);
	const maxAreas = Math.min(24, Math.max(3, Math.floor(summaryLimit / 120)));
	const areas = changeAreas(root, maxAreas);
	let summary = `Staged files: ${files.length}\n`;
	const addLines = (lines: string[]) => {
		let shown = 0;
		for (const line of lines) {
			if (summary.length + line.length + 80 > summaryLimit) break;
			summary += `${line}\n`;
			shown++;
		}
		return shown;
	};
	let shown = addLines(stats);
	if (shown < stats.length) {
		summary = `Staged files: ${files.length}\nChange areas:\n`;
		addLines(areas.map(describeArea));
		summary += 'Largest files:\n';
		shown = addLines(leaves(root).sort(byWeight).map(describeArea));
	}
	if (shown < files.length) summary += `[${files.length - shown} more files omitted from summary]\n`;
	const generatedPaths = includeGenerated ? [] : generatedFiles.map(excludePath);
	const patchFiles = (await execa('git', [...args, '--name-only', '-z', ...paths, ...generatedPaths])).stdout.split('\0').filter(Boolean);
	const inPatch = new Set(patchFiles);
	const queues = areas.map(area => leaves(area).filter(leaf => inPatch.has(leaf.path)).sort(byWeight));
	const sampleCount = Math.min(patchFiles.length, 30);
	const sampled = new Set<string>();
	for (let i = 0; sampled.size < sampleCount && queues.some(queue => i < queue.length); i++) {
		for (const queue of queues) if (queue[i] && sampled.size < sampleCount) sampled.add(queue[i].path);
	}
	const budget = maxDiffChars - summary.length - 160;
	const perFile = Math.max(120, Math.min(3000, Math.floor(budget / Math.max(1, sampleCount))));
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
	let fileIndex = -1;
	let current: string | undefined;
	const flush = () => {
		if (!snippet) return;
		const block = snippet + (omitted ? '\n[remaining file diff omitted]' : '');
		if (used + block.length + 1 <= budget) {
			snippets.push(block);
			used += block.length + 1;
		}
		snippet = '';
		omitted = false;
	};
	const diff = execa('git', [...args, '--unified=3', ...paths, ...generatedPaths], { buffer: false });
	const lines = createInterface({ input: diff.stdout! });
	try {
		for await (const line of lines) {
			if (line.startsWith('diff --git ')) {
				chunkLabel = line;
				flush();
				current = patchFiles[++fileIndex];
			}
			addContext(`${line}\n`);
			if (patchFits && patch.length + line.length + 1 <= budget) patch += `${line}\n`;
			else { patchFits = false; patch = ''; }
			if (!current || !sampled.has(current)) continue;
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
	const omittedFiles = Math.max(0, patchFiles.length - snippets.length);
	return {
		files, tree, chunks, head: head.failed ? '' : head.stdout,
		overview: [`Staged files: ${files.length}`, ...changeAreas(root, 12).map(describeArea)].join('\n'),
		diff: `${summary}\n${patchFits ? 'Diff' : 'Sampled diff (omissions marked)'}:\n${patchFits ? patch : snippets.join('\n')}${!patchFits && omittedFiles ? `\n[${omittedFiles} file patches omitted]` : ''}\n${includeGenerated ? '' : '[Generated-file patches omitted; statistics retained]'}`,
	};
};

export const getDetectedMessage = (files: string[]) =>
	`Detected ${files.length.toLocaleString()} staged file${files.length === 1 ? '' : 's'}`;
