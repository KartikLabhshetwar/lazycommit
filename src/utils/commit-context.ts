import { execa } from 'execa';

export interface CommitInfo {
	hash: string;
	author: string;
	email: string;
	date: string;
	message: string;
	isVerified: boolean;
}

export const getCurrentUserEmail = async (): Promise<string> => {
	try {
		const { stdout } = await execa('git', ['config', '--get', 'user.email']);
		return stdout.trim();
	} catch {
		return '';
	}
};

export const getRecentCommits = async (limit: number = 50): Promise<CommitInfo[]> => {
	try {
		// Format: hash|author|email|date|gpg_status|subject
		// Using %s only for subject to avoid multiline parsing issues
		const { stdout } = await execa('git', [
			'log',
			`--pretty=format:%H|%an|%ae|%ad|%G?|%s`,
			'--date=short',
			`-${limit}`,
			'--no-merges'
		]);

		if (!stdout) return [];

		return stdout.split('\n').map(line => {
			const [hash, author, email, date, gpgStatus, ...subjectParts] = line.split('|');
			const message = subjectParts.join('|'); // Handle commit messages with | character

			return {
				hash: hash || '',
				author: author || '',
				email: email || '',
				date: date || '',
				message: message || '',
				isVerified: gpgStatus === 'G' || gpgStatus === 'U'
			};
		}).filter(commit => commit.hash && commit.message);
	} catch {
		return [];
	}
};

export const getHierarchicalCommitContext = async (
	maxCommits: number = 10
): Promise<CommitInfo[]> => {
	const [userEmail, allCommits] = await Promise.all([
		getCurrentUserEmail(),
		getRecentCommits(100)
	]);

	if (allCommits.length === 0) return [];

	// Level 1: Verified commits from current user
	const verifiedUserCommits = allCommits.filter(
		c => c.email === userEmail && c.isVerified
	);
	if (verifiedUserCommits.length > 0) {
		return verifiedUserCommits.slice(0, maxCommits);
	}

	// Level 2: Any commits from current user
	const userCommits = allCommits.filter(c => c.email === userEmail);
	if (userCommits.length > 0) {
		return userCommits.slice(0, maxCommits);
	}

	// Level 3: Any recent commits
	return allCommits.slice(0, maxCommits);
};

export const formatCommitContext = (commits: CommitInfo[]): string => {
	if (commits.length === 0) return '';

	const messages = commits.map(c => c.message).join('\n');

	return `Recent commit messages from this repository for style reference:\n${messages}`;
};
