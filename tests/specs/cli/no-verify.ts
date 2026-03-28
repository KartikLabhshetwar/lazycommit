import { testSuite, expect } from 'manten';
import fs from 'fs/promises';
import path from 'path';
import {
	assertGroqToken,
	createFixture,
	createGit,
	files,
} from '../../utils.js';

export default testSuite(({ describe }) => {
	describe('no-verify', async ({ test }) => {
		if (!assertGroqToken()) {
			return;
		}

		test('Bypasses pre-commit hook', async () => {
			const { fixture, lazycommit } = await createFixture(files);
			const git = await createGit(fixture.path);

			// Create a pre-commit hook that fails
			const hookPath = path.join(fixture.path, '.git/hooks/pre-commit');
			await fs.writeFile(hookPath, '#!/bin/sh\nexit 1');
			await fs.chmod(hookPath, '755');

			await git('add', ['data.json']);

			// Should fail without --no-verify
			const { exitCode: failExitCode } = await lazycommit(['--yes'], { reject: false });
			expect(failExitCode).toBe(1);

			// Should pass with --no-verify
			const { exitCode: successExitCode } = await lazycommit(['--no-verify', '--yes'], { reject: false });
			expect(successExitCode).toBe(0);

			await fixture.rm();
		});
	});
});
