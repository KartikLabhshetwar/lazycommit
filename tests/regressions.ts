import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { getStagedDiff } from '../src/utils/git.js';
import { normalizeMessage } from '../src/utils/groq.js';
import { generatePrompt } from '../src/utils/prompt.js';
import { createFixture, createGit } from './utils.js';

assert.equal(normalizeMessage('"fix(api)!: handle empty input"', 100, 'conventional', 'api'), 'fix(api)!: handle empty input');
assert.equal(normalizeMessage('fix: ' + 'x'.repeat(100), 100, 'conventional'), undefined);
assert.equal(normalizeMessage('fix: valid\nExplanation', 100, 'conventional'), undefined);
assert.equal(normalizeMessage('<think>notes</think>', 100, ''), undefined);
assert.equal(normalizeMessage('fix: change behavior', 100, ''), undefined);
assert.equal(normalizeMessage('更新設定', 20, ''), '更新設定');
assert.equal(normalizeMessage('feat: add widget', 100, 'conventional', 'api'), undefined);
assert.match(generatePrompt('ja', 50, ''), /plain subject/);
assert.match(generatePrompt('ja', 50, 'conventional', 'api'), /exactly the scope "api"/);

const { fixture, lazycommit } = await createFixture({
	'.lazycommit': 'GROQ_API_KEY=gsk_test\n',
	'src': { 'a.ts': 'export const enabled = true;\n' },
	'odd\tname\n.txt': 'special filename\n',
	'image.bin': '\0binary',
	'pnpm-lock.yaml': 'lockfileVersion: 9\n',
});
const git = await createGit(fixture.path);
const originalCwd = process.cwd();
let requests: Array<{ model: string; messages: Array<{ content: string }> }> = [];
let responses: Array<{ content?: string | null; reasoning?: string; finish?: string; status?: number }> = [];
let mutateIndex = false;
const server = createServer(async (req, res) => {
	let body = '';
	for await (const chunk of req) body += chunk;
	const request = JSON.parse(body);
	requests.push(request);
	if (mutateIndex) {
		mutateIndex = false;
		await fixture.writeFile('src/a.ts', 'export const changed = true;\n');
		await git('add', ['src/a.ts']);
	}
	const answer = responses.shift() ?? { content: request.messages[0].content.startsWith('Summarize') ? 'Add the enabled flag and related files.' : 'Add enabled flag' };
	res.setHeader('Content-Type', 'application/json');
	res.statusCode = answer.status ?? 200;
	res.end(JSON.stringify(answer.status ? { error: { message: 'Mock API failure' } } : {
		choices: [{ message: { content: answer.content, reasoning: answer.reasoning }, finish_reason: answer.finish ?? 'stop' }],
	}));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert(address && typeof address === 'object');
const options = { env: { GROQ_BASE_URL: `http://127.0.0.1:${address.port}` } };
try {
	await git('add', ['src', 'odd\tname\n.txt', 'image.bin', 'pnpm-lock.yaml']);
	process.chdir(fixture.path);
	const staged = await getStagedDiff();
	assert(staged);
	assert(staged.files.includes('odd\tname\n.txt'));
	assert.match(staged.diff, /binary change/);
	assert.match(staged.diff, /export const enabled/);
	assert.match(staged.diff, /pnpm-lock.yaml/);
	assert(!staged.diff.includes('lockfileVersion'));
	assert((await getStagedDiff([], 16000, true))!.diff.includes('lockfileVersion'));
	assert(!(await getStagedDiff(['src/**']))!.files.includes('src/a.ts'));
	process.chdir(`${fixture.path}/src`);
	assert.deepEqual((await getStagedDiff())!.files, staged.files);
	process.chdir(originalCwd);

	await fixture.writeFile('src/a.ts', 'UNSTAGED_CONTENT\n');
	assert(!(await lazycommit(['--preview-diff'], options)).stdout?.toString().includes('UNSTAGED_CONTENT'));
	const status = (await git('status', ['--porcelain'])).stdout;
	const preview = await lazycommit(['--preview-diff'], options);
	assert.match(String(preview.stdout), /export const enabled/);
	assert.equal(requests.length, 0);
	assert.equal((await lazycommit(['--dry-run'], options)).stdout, 'Add enabled flag');
	assert.equal((await git('status', ['--porcelain'])).stdout, status);

	responses = [{ content: 'fix(api): handle empty input' }];
	assert.equal((await lazycommit(['--dry-run', '-t', 'conventional', '--scope=api', '--model=test-model', '--locale=ja', '--context', 'Handle x=y', '--max-length=40', '--max-diff-chars=1000'], options)).stdout, 'fix(api): handle empty input');
	assert.equal(requests[requests.length - 1].model, 'test-model');
	assert.match(requests[requests.length - 1].messages[0].content, /Handle x=y/);
	assert(requests[requests.length - 1].messages[1].content.length <= 1000);

	requests = [];
	responses = [{ content: 'x'.repeat(101) }, { content: 'Add enabled flag' }];
	assert.equal((await lazycommit(['--dry-run'], options)).stdout, 'Add enabled flag');
	assert.equal(requests.length, 2);
	assert.equal(requests[1].messages[2].content, 'x'.repeat(101));
	assert.match(requests[1].messages[3].content, /101 characters/);
	responses = [{ content: null, reasoning: 'feat: guessed message' }, { content: null, reasoning: 'feat: guessed message' }];
	const invalid = await lazycommit(['--dry-run'], { ...options, reject: false });
	assert.equal(invalid.exitCode, 1);
	assert.match(String(invalid.stderr), /did not return a valid/);

	responses = [{ content: 'Add enabled flag' }, { status: 400 }];
	assert.equal((await lazycommit(['--dry-run', '-g', '2'], options)).stdout, 'Add enabled flag');
	responses = [{ content: 'Add enabled flag' }, { content: 'Add enabled flag' }];
	assert.equal((await lazycommit(['--dry-run', '-g', '2'], options)).stdout, 'Add enabled flag');

	const beforeInvalid = requests.length;
	for (const args of [['--split'], ['--amend'], ['--dry-run', '--all'], ['--dry-run', '--generate=0'], ['--dry-run', '--scope=api'], ['--dry-run', '--max-diff-chars=1']]) {
		assert.equal((await lazycommit(args, { ...options, reject: false })).exitCode, 1);
	}
	assert.equal(requests.length, beforeInvalid);
	await lazycommit(['config', 'set', 'context=a=b', 'locale=pt_BR'], options);
	assert.equal((await lazycommit(['config', 'get', 'context'], options)).stdout, 'context=a=b');
	assert.equal((await lazycommit(['config', 'set', 'timeout'], { ...options, reject: false })).exitCode, 1);

	mutateIndex = true;
	const stale = await lazycommit(['--yes'], { ...options, reject: false });
	assert.equal(stale.exitCode, 1);
	assert.match(String(stale.stdout), /changed during review/);
	await lazycommit(['--yes', '-g', '1', '--model=test-model', '--no-verify', '-s'], options);
	assert.equal((await git('log', ['-1', '--format=%s'])).stdout, 'Add enabled flag');
	assert.match(String((await git('log', ['-1', '--format=%B'])).stdout), /Signed-off-by:/);

	await git('mv', ['odd\tname\n.txt', 'renamed.txt']);
	await fixture.writeFile('src/a.ts', 'export const changed = false;\n'.repeat(3000));
	await git('add', ['src/a.ts']);
	process.chdir(fixture.path);
	const large = await getStagedDiff([], 1000, false, true);
	assert(large && large.diff.length <= 1000);
	assert.match(large.diff, /renamed from/);
	assert(large.chunks.length > 1);
	assert(large.chunks.every(chunk => chunk.length <= 16000));
	assert(large.chunks[1].startsWith('Continuation: diff --git '));
	process.chdir(originalCwd);
	requests = [];
	responses = [{ content: 'x'.repeat(3001) }, { content: 'Add enabled flag and related files.' }];
	await lazycommit(['--dry-run', '--thorough'], options);
	assert.match(requests[1].messages[1].content, /3001 characters/);
	assert(requests.filter(request => request.messages[0].content.startsWith('Summarize')).length > 1);
	assert.match(requests[requests.length - 1].messages[1].content, /Analysis of all diff batches/);

	await lazycommit(['config', 'set', 'generate=2'], options);
	requests = [];
	await lazycommit(['--dry-run', '-g', '1'], options);
	assert.equal(requests.length, 1);
	await lazycommit(['hook', 'install'], options);
	responses = [{ content: 'Add enabled flag' }, { content: 'Update related files' }];
	await git('commit', ['--no-edit'], { env: { ...options.env, HOME: fixture.path, USERPROFILE: fixture.path } });
	assert.equal((await git('log', ['-1', '--format=%s'])).stdout, 'Add enabled flag');
	await fixture.writeFile('pnpm-lock.yaml', 'lockfileVersion: 10\n');
	await git('add', ['pnpm-lock.yaml']);
	process.chdir(fixture.path);
	const lockOnly = await getStagedDiff();
	assert.deepEqual(lockOnly!.files, ['pnpm-lock.yaml']);
	assert(!lockOnly!.diff.includes('lockfileVersion'));
	process.chdir(originalCwd);
	console.log('Offline regression checks passed (diffs, options, API validation, commits, hooks, thorough analysis).');
} finally {
	process.chdir(originalCwd);
	server.close();
	await fixture.rm();
}
