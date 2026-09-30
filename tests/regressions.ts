import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { execa } from 'execa';
import { getStagedDiff, getUnstagedFiles, stageFiles } from '../src/utils/git.js';
import { normalizeMessage } from '../src/utils/ai.js';
import { generatePrompt } from '../src/utils/prompt.js';
import { createFixture, createGit, hasPython, runInTerminal } from './utils.js';

assert.equal(normalizeMessage('"fix(api)!: handle empty input"', 100, 'conventional', 'api'), 'fix(api)!: handle empty input');
assert.equal(normalizeMessage('fix: ' + 'x'.repeat(100), 100, 'conventional'), undefined);
assert.equal(normalizeMessage('fix: valid\nExplanation', 100, 'conventional'), undefined);
assert.equal(normalizeMessage('<think>notes</think>', 100, ''), undefined);
assert.equal(normalizeMessage('fix: change behavior', 100, ''), undefined);
assert.equal(normalizeMessage('更新設定', 20, ''), '更新設定');
assert.equal(normalizeMessage('feat: add widget', 100, 'conventional', 'api'), undefined);
assert.equal(normalizeMessage('feat(cli, commands): add flags', 100, 'conventional'), undefined);
assert.equal(normalizeMessage('Fix(parser): handle empty input', 100, 'conventional'), 'Fix(parser): handle empty input');
assert.match(generatePrompt('en', 72, 'conventional'), /Conventional Commits 1\.0\.0/);
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
let responses: Array<{ content?: string | null; reasoning?: string; finish?: string; status?: number; retryAfter?: string }> = [];
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
	if (answer.retryAfter) res.setHeader('retry-after', answer.retryAfter);
	res.statusCode = answer.status ?? 200;
	res.end(JSON.stringify(answer.status ? { error: { message: 'Mock API failure' } } : {
		choices: [{ message: { content: answer.content, reasoning: answer.reasoning }, finish_reason: answer.finish ?? 'stop' }],
	}));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert(address && typeof address === 'object');
const options = { env: { LAZYCOMMIT_BASE_URL: `http://127.0.0.1:${address.port}` } };
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
	assert.equal((await lazycommit(['--dry-run', '-t', 'conventional', '--scope=api', '--model=groq/test-model', '--locale=ja', '--context', 'Handle x=y', '--max-length=40', '--max-diff-chars=1000'], options)).stdout, 'fix(api): handle empty input');
	assert.equal(requests[requests.length - 1].model, 'test-model');
	assert.match(requests[requests.length - 1].messages[0].content, /Handle x=y/);
	assert(requests[requests.length - 1].messages[1].content.length <= 1000);

	requests = [];
	responses = [{ content: 'x'.repeat(101) }, { content: 'Add enabled flag' }];
	assert.equal((await lazycommit(['--dry-run'], options)).stdout, 'Add enabled flag');
	assert.equal(requests.length, 2);
	assert.equal(requests[0].model, 'openai/gpt-oss-20b');
	assert.equal(requests[1].messages.length, 2);
	assert.match(requests[1].messages[1].content, /101 characters/);
	assert(requests[1].messages[1].content.includes('x'.repeat(101)));
	assert.match(requests[1].messages[1].content, /src\/a\.ts/);
	assert(!requests[1].messages[1].content.includes('export const enabled'));
	requests = [];
	responses = [{ content: 'Add\nflag' }, { content: 'Add enabled flag' }];
	assert.equal((await lazycommit(['--dry-run', '--model=llama-3.3-70b-versatile'], options)).stdout, 'Add enabled flag');
	assert.equal(requests[0].model, 'llama-3.3-70b-versatile');
	assert.match(requests[1].messages[1].content, /export const enabled/);
	assert.match(requests[1].messages[3].content, /previous response was invalid/);
	requests = [];
	responses = [{ status: 429, retryAfter: '0' }, { content: 'Add enabled flag' }];
	assert.equal((await lazycommit(['--dry-run'], options)).stdout, 'Add enabled flag');
	assert.equal(requests.length, 2);
	requests = [];
	responses = [{ status: 429, retryAfter: '30' }];
	const limited = await lazycommit(['--dry-run'], { ...options, reject: false });
	assert.match(String(limited.stderr), /rate limit reached \(429\)\. Try again in 30 seconds/);
	assert.equal(requests.length, 1);
	const noKey = await lazycommit(['--dry-run', '--model=openai/gpt-5.4-mini'], { ...options, reject: false });
	assert.match(String(noKey.stderr), /OPENAI_API_KEY/);
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
	await lazycommit(['--yes', '-g', '1', '--model=groq/test-model', '--no-verify', '-s'], options);
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

	const many = await createFixture(Object.fromEntries([
		...Array.from({ length: 1000 }, (_, i) => [`pkg-${String(i % 20).padStart(2, '0')}/src/file${i}.ts`, `export const value${i} = ${i};\n`]),
		['zz-core/engine.ts', Array.from({ length: 400 }, (_, i) => `export const step${i} = ${i};`).join('\n')],
	]));
	const manyGit = await createGit(many.fixture.path);
	await manyGit('add', ['.']);
	process.chdir(many.fixture.path);
	const wide = await getStagedDiff();
	process.chdir(originalCwd);
	await many.fixture.rm();
	assert(wide && wide.diff.length <= 16000);
	assert.match(wide.diff, /Change areas:\n"zz-core\/engine\.ts": \+400 -0\n/);
	assert.match(wide.diff, /"pkg-00\/src\/": 50 files, \+50 -0/);
	assert.match(wide.diff, /diff --git a\/zz-core\/engine\.ts/);
	assert(new Set(wide.diff.match(/diff --git a\/pkg-\d+/g)).size >= 19);
	assert.equal(wide.overview.split('\n').length, 13);
	assert.match(wide.overview, /\nOther paths: 500 files, \+500 -0$/);
	assert.match(wide.overview, /^Staged files: 1001\n"zz-core\/engine\.ts"/);

	const repo = await createFixture({
		'.lazycommit': 'GROQ_API_KEY=gsk_test\n', '.gitignore': '.lazycommit\n', 'a.txt': 'a\n', 'gone.txt': 'gone\n',
	});
	const remote = await createFixture();
	try {
		const repoGit = await createGit(repo.fixture.path);
		await repoGit('add', ['.']);
		await repoGit('commit', ['-m', 'Initial commit']);
		await repo.fixture.writeFile('a.txt', 'changed\n');
		await repo.fixture.rm('gone.txt');
		await repo.fixture.writeFile('[ab].txt', 'literal name\n');
		await repo.fixture.mkdir('docs');
		await repo.fixture.writeFile('docs/new file.md', 'new\n');
		const status = async () => (await repoGit('status', ['--porcelain', '--untracked-files=all'])).stdout;
		const head = async () => (await repoGit('rev-parse', ['HEAD'])).stdout;

		process.chdir(`${repo.fixture.path}/docs`);
		assert.deepEqual(await getUnstagedFiles(), [
			{ path: 'a.txt', status: 'modified' }, { path: 'gone.txt', status: 'deleted' },
			{ path: '[ab].txt', status: 'new' }, { path: 'docs/new file.md', status: 'new' },
		]);
		await stageFiles(repo.fixture.path, ['[ab].txt', 'gone.txt']);
		assert.equal((await repoGit('diff', ['--cached', '--name-status'])).stdout, 'A\t[ab].txt\nD\tgone.txt');
		await repoGit('reset', ['-q']);
		process.chdir(originalCwd);

		const unstaged = await status();
		requests = [];
		const scripted = await repo.lazycommit(['--yes'], { ...options, reject: false });
		assert.equal(scripted.exitCode, 1);
		assert.match(String(scripted.stdout), /No staged changes found/);
		assert.equal(await status(), unstaged);
		for (const [args, error] of [
			[['master', '--yes'], /No origin remote found/],
			[['main', '--yes'], /You are on master, not main/],
			[['--dry-run', 'master'], /Preview options cannot be combined with a branch/],
			[['master', 'extra', '--yes'], /Unsupported git argument: extra/],
		] as const) {
			const result = await repo.lazycommit([...args], { ...options, reject: false });
			assert.equal(result.exitCode, 1);
			assert.match(`${result.stdout}${result.stderr}`, error);
		}
		assert.equal(requests.length, 0);

		await execa('git', ['init', '--bare', '-q', remote.fixture.path]);
		await repoGit('remote', ['add', 'origin', remote.fixture.path]);
		const remoteHead = async () => (await execa('git', ['rev-parse', 'master'], { cwd: remote.fixture.path })).stdout;
		await repoGit('add', ['a.txt']);
		await repo.lazycommit(['master', '--yes', '-s'], options);
		assert.equal((await repoGit('log', ['-1', '--format=%s'])).stdout, 'Add enabled flag');
		assert.match(String((await repoGit('log', ['-1', '--format=%B'])).stdout), /Signed-off-by:/);
		assert.equal(await remoteHead(), await head());
		assert.equal((await repoGit('rev-parse', ['--abbrev-ref', 'master@{upstream}'])).stdout, 'origin/master');

		await repoGit('add', ['gone.txt']);
		await repoGit('remote', ['set-url', 'origin', `${remote.fixture.path}-missing`]);
		const beforeFailedPush = await head();
		const failedPush = await repo.lazycommit(['master', '--yes'], { ...options, reject: false });
		assert.equal(failedPush.exitCode, 1);
		assert.match(String(failedPush.stdout), /Push to origin\/master failed\. Your commit is kept/);
		assert.notEqual(await head(), beforeFailedPush);
		assert.equal((await repoGit('show', ['--name-status', '--format=', 'HEAD'])).stdout, 'D\tgone.txt');
		await repoGit('remote', ['set-url', 'origin', remote.fixture.path]);

		if (await hasPython()) {
			const untracked = await status();
			const beforePicker = await head();
			for (const steps of [[['Select files', '\x03']], [['Select files', '\r'], ['Review commit message', '\x03']]] as Array<Array<[string, string]>>) {
				const cancelled = await runInTerminal(repo.fixture.path, [], steps, options.env);
				assert.equal(cancelled.exitCode, 0, `${cancelled.stdout}${cancelled.stderr}`);
				assert.match(String(cancelled.stdout), /Commit cancelled/);
				assert.equal(await status(), untracked);
				assert.equal(await head(), beforePicker);
			}

			const picked = await runInTerminal(repo.fixture.path, ['master'], [['Select files', ' \r'], ['Review commit message', '\r']], options.env);
			assert.equal(picked.exitCode, 0, `${picked.stdout}${picked.stderr}`);
			assert.match(String(picked.stdout), /Successfully committed and pushed to origin\/master/);
			assert.equal((await repoGit('show', ['--name-only', '--format=', 'HEAD'])).stdout, 'docs/new file.md');
			assert.equal(await status(), '?? [ab].txt');
			assert.equal(await remoteHead(), await head());
		} else {
			console.warn('⚠️  python3 is necessary for the interactive picker checks. Skipping...');
		}

		await repoGit('commit', ['--allow-empty', '-m', 'Local only']);
		const unpushed = await head();
		requests = [];
		const withUntracked = await repo.lazycommit(['master', '--yes'], { ...options, reject: false });
		assert.equal(withUntracked.exitCode, 1);
		assert.match(String(withUntracked.stdout), /No staged changes found/);
		assert.notEqual(await remoteHead(), unpushed);
		await repoGit('clean', ['-fdq']);
		const pushOnly = await repo.lazycommit(['master'], options);
		assert.match(String(pushOnly.stdout), /Nothing to commit\. origin\/master is up to date/);
		assert.equal(await remoteHead(), unpushed);
		assert.equal(requests.length, 0);
	} finally {
		process.chdir(originalCwd);
		await repo.fixture.rm();
		await remote.fixture.rm();
	}

	const home = await createFixture({ '.lazycommit': 'GROQ_API_KEY=gsk_test\n' });
	try {
		const listed = String((await home.lazycommit(['model'])).stdout).split('\n');
		assert(listed.includes('groq/openai/gpt-oss-20b'));
		assert(listed.every(id => id.startsWith('groq/')));
		assert(!listed.some(id => /whisper|guard/.test(id)));
		const both = String((await home.lazycommit(['model'], { env: { OPENAI_API_KEY: 'sk-test' } })).stdout).split('\n');
		assert(both.includes('openai/gpt-5.4-mini') && both.includes('groq/openai/gpt-oss-20b'));
		const keyless = await home.lazycommit(['model'], { env: { HOME: `${home.fixture.path}/none` }, reject: false });
		assert.equal(keyless.exitCode, 1);
		assert.match(String(keyless.stderr), /Please set an API key/);

		if (await hasPython()) {
			const savedConfig = () => home.fixture.readFile('.lazycommit', 'utf8');
			const cancelled = await runInTerminal(home.fixture.path, ['model'], [['Choose a model from Groq', '\x03']], {});
			assert.equal(cancelled.exitCode, 0, `${cancelled.stdout}${cancelled.stderr}`);
			assert.match(String(cancelled.stdout), /Model unchanged/);
			assert.equal(await savedConfig(), 'GROQ_API_KEY=gsk_test\n');

			const next = listed[listed.indexOf('groq/openai/gpt-oss-20b') + 1];
			const picked = await runInTerminal(home.fixture.path, ['model'], [['Choose a model from Groq', '\x1b[B\r']], {});
			assert.equal(picked.exitCode, 0, `${picked.stdout}${picked.stderr}`);
			assert(String(picked.stdout).includes(`Model set to ${next}`));
			assert.equal(await savedConfig(), `GROQ_API_KEY=gsk_test\nmodel=${next}\n`);

			await home.lazycommit(['config', 'set', 'model=openai/gpt-5.4-mini']);
			const kept = await runInTerminal(home.fixture.path, ['model'], [['Choose a provider', '\r'], ['Choose a model from OpenAI', '\r']], { OPENAI_API_KEY: 'sk-test' });
			assert.equal(kept.exitCode, 0, `${kept.stdout}${kept.stderr}`);
			assert.match(String(kept.stdout), /current model: openai\/gpt-5\.4-mini/);
			assert.match(String(kept.stdout), /Model set to openai\/gpt-5\.4-mini/);
		} else {
			console.warn('⚠️  python3 is necessary for the interactive model picker checks. Skipping...');
		}
	} finally {
		await home.fixture.rm();
	}
	console.log('Offline regression checks passed (diffs, options, API validation, commits, hooks, thorough analysis, staging picker, push, model picker).');
} finally {
	process.chdir(originalCwd);
	server.close();
	await fixture.rm();
}
