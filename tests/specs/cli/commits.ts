import { testSuite, expect } from 'manten';
import {
	assertGroqToken,
	createFixture,
	createGit,
	files,
} from '../../utils.js';

export default testSuite(({ describe }) => {
	if (process.platform === 'win32') {
		// https://github.com/nodejs/node/issues/31409
		console.warn(
			'Skipping tests on Windows because Node.js spawn cant open TTYs'
		);
		return;
	}

	describe('Commits', async ({ test, describe }) => {
		if (!assertGroqToken()) {
			return;
		}

		test('Excludes files', async () => {
			const { fixture, lazycommit } = await createFixture(files);
			const git = await createGit(fixture.path);

			await git('add', ['data.json']);
			const statusBefore = await git('status', [
				'--porcelain',
				'--untracked-files=no',
			]);
			expect(statusBefore.stdout).toBe('A  data.json');

			const { stdout, exitCode } = await lazycommit(['--exclude', 'data.json'], {
				reject: false,
			});
			expect(exitCode).toBe(1);
			expect(stdout).toMatch('No staged changes found.');
			await fixture.rm();
		});

		test('Generates commit message', async () => {
			const { fixture, lazycommit } = await createFixture(files);
			const git = await createGit(fixture.path);

			await git('add', ['data.json']);

			const committing = lazycommit(['--yes']);

			await committing;

			const statusAfter = await git('status', [
				'--porcelain',
				'--untracked-files=no',
			]);
			expect(statusAfter.stdout).toBe('');

			const { stdout: commitMessage } = await git('log', [
				'--pretty=format:%s',
			]);
			console.log({
				commitMessage,
				length: commitMessage?.length,
			});
			expect(commitMessage?.length).toBeLessThanOrEqual(100);

			await fixture.rm();
		});

		test('Generated commit message must be under 20 characters', async () => {
			const { fixture, lazycommit } = await createFixture({
				...files,
				'.lazycommit': `${files['.lazycommit']}\nmax-length=20`,
			});

			const git = await createGit(fixture.path);

			await git('add', ['data.json']);

			const committing = lazycommit(['--yes']);

			await committing;

			const { stdout: commitMessage } = await git('log', [
				'--pretty=format:%s',
			]);
			console.log({
				commitMessage,
				length: commitMessage?.length,
			});
			expect(commitMessage?.length).toBeLessThanOrEqual(20);

			await fixture.rm();
		});

		test('Accepts --all flag, staging all changes before commit', async () => {
			const { fixture, lazycommit } = await createFixture(files);
			const git = await createGit(fixture.path);

			await git('add', ['data.json']);
			await git('commit', ['-m', 'wip']);

			// Change tracked file
			await fixture.writeFile('data.json', 'Test');

			const statusBefore = await git('status', ['--short']);
			expect(statusBefore.stdout).toBe(' M data.json\n?? .lazycommit');

			const committing = lazycommit(['--yes', '--all']);

			await committing;

			const statusAfter = await git('status', ['--short']);
			expect(statusAfter.stdout).toBe('?? .lazycommit');

			const { stdout: commitMessage } = await git('log', [
				'-n1',
				'--pretty=format:%s',
			]);
			console.log({
				commitMessage,
				length: commitMessage?.length,
			});
			expect(commitMessage?.length).toBeLessThanOrEqual(100);

			await fixture.rm();
		});

		test('Accepts --generate flag, overriding config', async () => {
			const { fixture, lazycommit } = await createFixture({
				...files,
				'.lazycommit': `${files['.lazycommit']}\ngenerate=4`,
			});
			const git = await createGit(fixture.path);

			await git('add', ['data.json']);

			// Generate flag should override generate config
			const committing = lazycommit(['--yes', '--generate', '2']);

			await committing;

			const statusAfter = await git('status', [
				'--porcelain',
				'--untracked-files=no',
			]);
			expect(statusAfter.stdout).toBe('');

			const { stdout: commitMessage } = await git('log', [
				'--pretty=format:%s',
			]);
			console.log({
				commitMessage,
				length: commitMessage?.length,
			});
			expect(commitMessage?.length).toBeLessThanOrEqual(100);

			await fixture.rm();
		});

		test('Generates Japanese commit message via locale config', async () => {
			// https://stackoverflow.com/a/15034560/911407
			const japanesePattern =
				/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFF9F\u4E00-\u9FAF\u3400-\u4DBF]/;

			const { fixture, lazycommit } = await createFixture({
				...files,
				'.lazycommit': `${files['.lazycommit']}\nlocale=ja`,
			});
			const git = await createGit(fixture.path);

			await git('add', ['data.json']);

			const committing = lazycommit(['--yes']);

			await committing;

			const statusAfter = await git('status', [
				'--porcelain',
				'--untracked-files=no',
			]);
			expect(statusAfter.stdout).toBe('');

			const { stdout: commitMessage } = await git('log', [
				'--pretty=format:%s',
			]);
			console.log({
				commitMessage,
				length: commitMessage?.length,
			});
			expect(commitMessage).toMatch(japanesePattern);
			expect(commitMessage?.length).toBeLessThanOrEqual(100);

			await fixture.rm();
		});

		describe('commit types', ({ test }) => {
			test('Should not use conventional commits by default', async () => {
				const conventionalCommitPattern =
					/(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test):\s/;
				const { fixture, lazycommit } = await createFixture({
					...files,
				});
				const git = await createGit(fixture.path);

				await git('add', ['data.json']);

				const committing = lazycommit(['--yes']);

				await committing;

				const statusAfter = await git('status', [
					'--porcelain',
					'--untracked-files=no',
				]);
				expect(statusAfter.stdout).toBe('');

				const { stdout: commitMessage } = await git('log', ['--oneline']);
				console.log('Committed with:', commitMessage);
				expect(commitMessage).not.toMatch(conventionalCommitPattern);

				await fixture.rm();
			});

			test('Conventional commits', async () => {
				const conventionalCommitPattern =
					/(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test):\s/;
				const { fixture, lazycommit } = await createFixture({
					...files,
					'.lazycommit': `${files['.lazycommit']}\ntype=conventional`,
				});
				const git = await createGit(fixture.path);

				await git('add', ['data.json']);

				const committing = lazycommit(['--yes']);

				await committing;

				const statusAfter = await git('status', [
					'--porcelain',
					'--untracked-files=no',
				]);
				expect(statusAfter.stdout).toBe('');

				const { stdout: commitMessage } = await git('log', ['--oneline']);
				console.log('Committed with:', commitMessage);
				expect(commitMessage).toMatch(conventionalCommitPattern);

				await fixture.rm();
			});

			test('Accepts --type flag, overriding config', async () => {
				const conventionalCommitPattern =
					/(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test):\s/;
				const { fixture, lazycommit } = await createFixture({
					...files,
					'.lazycommit': `${files['.lazycommit']}\ntype=other`,
				});
				const git = await createGit(fixture.path);

				await git('add', ['data.json']);

				// Generate flag should override generate config
				const committing = lazycommit(['--yes', '--type', 'conventional']);

				await committing;

				const statusAfter = await git('status', [
					'--porcelain',
					'--untracked-files=no',
				]);
				expect(statusAfter.stdout).toBe('');

				const { stdout: commitMessage } = await git('log', ['--oneline']);
				console.log('Committed with:', commitMessage);
				expect(commitMessage).toMatch(conventionalCommitPattern);

				await fixture.rm();
			});

			test('Accepts empty --type flag', async () => {
				const conventionalCommitPattern =
					/(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test):\s/;
				const { fixture, lazycommit } = await createFixture({
					...files,
					'.lazycommit': `${files['.lazycommit']}\ntype=conventional`,
				});
				const git = await createGit(fixture.path);

				await git('add', ['data.json']);

				const committing = lazycommit(['--yes', '--type', '']);

				await committing;

				const statusAfter = await git('status', [
					'--porcelain',
					'--untracked-files=no',
				]);
				expect(statusAfter.stdout).toBe('');

				const { stdout: commitMessage } = await git('log', ['--oneline']);
				console.log('Committed with:', commitMessage);
				expect(commitMessage).not.toMatch(conventionalCommitPattern);

				await fixture.rm();
			});
		});

		describe('proxy', ({ test }) => {
			test('Fails on invalid proxy', async () => {
				const { fixture, lazycommit } = await createFixture({
					...files,
					'.lazycommit': `${files['.lazycommit']}\nproxy=http://localhost:1234`,
				});
				const git = await createGit(fixture.path);

				await git('add', ['data.json']);

				const committing = lazycommit(['--yes'], {
					reject: false,
				});

				const { stdout, exitCode } = await committing;

				expect(exitCode).toBe(1);
				expect(stdout).toMatch('Cannot connect to Groq');

				await fixture.rm();
			});

			test('Connects with config', async () => {
				if (!process.env.LAZYCOMMIT_TEST_PROXY) return;
				const { fixture, lazycommit } = await createFixture({
					...files,
					'.lazycommit': `${files['.lazycommit']}\nproxy=${process.env.LAZYCOMMIT_TEST_PROXY}`,
				});
				const git = await createGit(fixture.path);

				await git('add', ['data.json']);

				const committing = lazycommit(['--yes']);

				await committing;

				const statusAfter = await git('status', [
					'--porcelain',
					'--untracked-files=no',
				]);
				expect(statusAfter.stdout).toBe('');

				const { stdout: commitMessage } = await git('log', [
					'--pretty=format:%s',
				]);
				console.log({
					commitMessage,
					length: commitMessage?.length,
				});
				expect(commitMessage?.length).toBeLessThanOrEqual(100);

				await fixture.rm();
			});

			test('Connects with env variable', async () => {
				if (!process.env.LAZYCOMMIT_TEST_PROXY) return;
				const { fixture, lazycommit } = await createFixture(files);
				const git = await createGit(fixture.path);

				await git('add', ['data.json']);

				const committing = lazycommit(['--yes'], {
					env: {
						HTTP_PROXY: process.env.LAZYCOMMIT_TEST_PROXY,
					},
				});

				await committing;

				const statusAfter = await git('status', [
					'--porcelain',
					'--untracked-files=no',
				]);
				expect(statusAfter.stdout).toBe('');

				const { stdout: commitMessage } = await git('log', [
					'--pretty=format:%s',
				]);
				console.log({
					commitMessage,
					length: commitMessage?.length,
				});
				expect(commitMessage?.length).toBeLessThanOrEqual(100);

				await fixture.rm();
			});
		});
	});
});
