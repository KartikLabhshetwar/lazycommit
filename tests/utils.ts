import path from 'path';
import fs from 'fs/promises';
import { execa, execaNode, type Options } from 'execa';
import {
	createFixture as createFixtureBase,
	type FileTree,
	type FsFixture,
} from 'fs-fixture';

const lazycommitPath = path.resolve('./dist/cli.mjs');

const createLazycommit = (fixture: FsFixture) => {
	const homeEnv = {
		HOME: fixture.path, // Linux
		USERPROFILE: fixture.path, // Windows
	};

	return (args?: string[], options?: Options) =>
		execaNode(lazycommitPath, args, {
			cwd: fixture.path,
			...options,
			extendEnv: false,
			env: {
				...homeEnv,
				...options?.env,
			},

			// Block tsx nodeOptions
			nodeOptions: [],
		});
};

const terminalDriver = String.raw`
import fcntl, json, os, pty, re, select, signal, struct, sys, termios
steps = json.loads(sys.argv[1])
pid, fd = pty.fork()
if pid == 0:
    fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
    os.execv(sys.argv[2], sys.argv[2:])
output = b''
def read():
    global output
    if not select.select([fd], [], [], 30)[0]:
        os.kill(pid, signal.SIGKILL)
        sys.exit('Timed out. Output:\n' + output.decode(errors='replace'))
    try:
        data = os.read(fd, 65536)
    except OSError:
        data = b''
    output += data
    return data
seen = 0
for pattern, keys in steps:
    while not re.search(pattern, output[seen:].decode(errors='replace')):
        if not read():
            sys.exit('Exited before ' + pattern + '. Output:\n' + output.decode(errors='replace'))
    seen = len(output)
    os.write(fd, keys.encode())
while read():
    pass
sys.stdout.write(output.decode(errors='replace'))
sys.exit(os.waitstatus_to_exitcode(os.waitpid(pid, 0)[1]))
`;

export const hasPython = async () => !(await execa('python3', ['--version'], { reject: false })).failed;

/** Runs the CLI in a pseudo-terminal, typing each step's keys once its pattern is printed. */
export const runInTerminal = (cwd: string, args: string[], steps: Array<[string, string]>, env: Record<string, string>) =>
	execa('python3', ['-c', terminalDriver, JSON.stringify(steps), process.execPath, lazycommitPath, ...args], {
		cwd,
		reject: false,
		extendEnv: false,
		env: { PATH: process.env.PATH, HOME: cwd, USERPROFILE: cwd, TERM: 'xterm-256color', ...env },
	});

export const createGit = async (cwd: string) => {
	const git = (command: string, args?: string[], options?: Options) =>
		execa('git', [command, ...(args || [])], {
			cwd,
			...options,
		});

	await git('init', [
		// In case of different default branch name
		'--initial-branch=master',
	]);

	await git('config', ['user.name', 'name']);
	await git('config', ['user.email', 'email']);

	return git;
};

export const createFixture = async (source?: string | FileTree) => {
	const fixture = await createFixtureBase(source);
	const lazycommit = createLazycommit(fixture);

	return {
		fixture,
		lazycommit,
	};
};

export const files = Object.freeze({
	'.lazycommit': `GROQ_API_KEY=${process.env.GROQ_API_KEY}`,
	'data.json': Array.from(
		{ length: 10 },
		(_, i) => `${i}. Lorem ipsum dolor sit amet`
	).join('\n'),
});

export const assertGroqToken = () => {
	if (!process.env.GROQ_API_KEY) {
		console.warn('⚠️  process.env.GROQ_API_KEY is necessary to run these tests. Skipping...');
		return false;
	}
	return true;
};

// See ./diffs/README.md in order to generate diff files
export const getDiff = async (diffName: string): Promise<string> =>
	fs.readFile(new URL(`fixtures/${diffName}`, import.meta.url), 'utf8');
