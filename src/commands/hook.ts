import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { green, red } from 'kolorist';
import { command } from 'cleye';
import { assertGitRepo, getHooksDirectory } from '../utils/git.js';
import { fileExists } from '../utils/fs.js';
import { KnownError, handleCliError } from '../utils/error.js';

const hookName = 'prepare-commit-msg';

const hookPath = fileURLToPath(new URL('cli.mjs', import.meta.url));

// Check if called from git hook - needs to handle both regular and worktree paths
export const isCalledFromGitHook = process.argv[1]
	.replace(/\\/g, '/') // Replace Windows back slashes with forward slashes
	.endsWith(`/hooks/${hookName}`);

const isWindows = process.platform === 'win32';
const windowsHook = `
#!/usr/bin/env node
import(${JSON.stringify(pathToFileURL(hookPath))})
`.trim();

export default command(
	{
		name: 'hook',
		parameters: ['<install/uninstall>'],
	},
	(argv) => {
		(async () => {
			await assertGitRepo();
			const { installUninstall: mode } = argv._;

			// Get the correct hooks directory (handles worktrees and custom paths)
			const hooksDir = await getHooksDirectory();

			// Check if using Husky or other hook managers
			if (hooksDir.includes('.husky')) {
				console.log(`${green('ℹ')} Detected Husky hooks directory: ${hooksDir}`);
				console.log(`${green('ℹ')} Installing lazycommit hook alongside Husky hooks`);
			}

			const absoltueSymlinkPath = path.join(hooksDir, hookName);
			const hookExists = await fileExists(absoltueSymlinkPath);
			if (mode === 'install') {
				if (hookExists) {
					// If the symlink is broken, it will throw an error
					// eslint-disable-next-line @typescript-eslint/no-empty-function
					const realpath = await fs
						.realpath(absoltueSymlinkPath)
						.catch(() => {});
					if (realpath === hookPath) {
						console.warn('The hook is already installed');
						return;
					}
					throw new KnownError(
						`A different ${hookName} hook seems to be installed. Please remove it before installing lazycommit.`
					);
				}

				await fs.mkdir(path.dirname(absoltueSymlinkPath), { recursive: true });

				if (isWindows) {
					await fs.writeFile(absoltueSymlinkPath, windowsHook);
				} else {
					await fs.symlink(hookPath, absoltueSymlinkPath, 'file');
					await fs.chmod(absoltueSymlinkPath, 0o755);
				}
				console.log(`${green('✔')} Hook installed to ${absoltueSymlinkPath}`);

				// Additional info for Husky users
				if (hooksDir.includes('.husky')) {
					console.log(`${green('ℹ')} Note: This hook will run alongside your existing Husky hooks`);
				}
				return;
			}

			if (mode === 'uninstall') {
				if (!hookExists) {
					console.warn('Hook is not installed');
					return;
				}

				if (isWindows) {
					const scriptContent = await fs.readFile(absoltueSymlinkPath, 'utf8');
					if (scriptContent !== windowsHook) {
						console.warn('Hook is not installed');
						return;
					}
				} else {
					const realpath = await fs.realpath(absoltueSymlinkPath);
					if (realpath !== hookPath) {
						console.warn('Hook is not installed');
						return;
					}
				}

				await fs.rm(absoltueSymlinkPath);
				console.log(`${green('✔')} Hook uninstalled`);
				return;
			}

			throw new KnownError(`Invalid mode: ${mode}`);
		})().catch((error) => {
			console.error(`${red('✖')} ${error.message}`);
			handleCliError(error);
			process.exit(1);
		});
	}
);
