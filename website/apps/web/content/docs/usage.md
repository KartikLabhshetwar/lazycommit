---
title: Usage
description: Review flow, common workflows, Git options, the Git hook, and every flag.
---

Run `lazycommit --help` to see the options for your installed version.

## Review flow

Stage your changes, then run lazycommit:

```bash
git add src/ README.md
lazycommit
```

The review menu offers:

- **Use as-is:** commits immediately.
- **Edit:** change the message, then confirm the final message before committing. The message must be one line.
- **Regenerate:** request new suggestions.
- **Cancel:** exit without committing.

With `--generate` greater than 1, you first choose one of the suggestions, then review it.

Before committing, lazycommit checks that the staged tree and HEAD still match the analyzed snapshot. If either changed during generation or review, it stops. Run it again to analyze the current content.

Without an interactive terminal, pass `--yes`, `--dry-run`, or `--preview-diff` explicitly.

## Common workflows

### Conventional commits

Plain subjects are the default. Request a conventional subject and, optionally, an explicit scope:

```bash
lazycommit --type conventional
lazycommit --type conventional --scope api --max-length 72
```

Example output: `fix(api): reject requests with an empty token`. Subjects follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), and edited messages must keep that format. A scope requires `--type conventional`.

### Multiple suggestions

```bash
lazycommit --generate 3
```

Each requested suggestion uses a separate generation request. Duplicates are removed, and valid suggestions are kept if other requests fail. You may get fewer than requested.

### Add context

Explain intent that the diff alone may not show:

```bash
lazycommit --context "Preserve existing login behavior while replacing session storage"
lazycommit --locale ja --type conventional
```

`--context` takes one line of up to 2,000 characters. `--locale` sets the language of the subject.

### Preview and dry run

```bash
lazycommit --preview-diff
lazycommit --dry-run --generate 3
```

- `--preview-diff` prints the diff context locally. It needs no API key and makes no network request.
- `--dry-run` generates suggestions through your provider without committing. It writes only the subjects to stdout, one per line. Errors go to stderr.

Both require staged changes and reject `--all`.

### Stage tracked changes or skip prompts

```bash
lazycommit --all
lazycommit --yes
```

- `--all` stages modified and deleted tracked files, then goes to review. It does not add untracked files.
- `--yes` commits the first valid suggestion without prompts.

### Stage and push in one command

If nothing is staged, lazycommit lists every changed and untracked file (ignored files never appear), all selected. Press Enter to stage them all, or toggle files with space (`a` toggles all). If you cancel, or the commit doesn't happen, the files are unstaged again.

Add a branch name to push after committing:

```bash
lazycommit main           # pick files, review, commit, then git push -u origin main
lazycommit feature/login  # same for a feature branch; -u sets its upstream on the first push
```

- The branch must be the one you're on, and an `origin` remote must exist. Both are checked before any API call.
- The push runs after a successful commit. With nothing to commit (a clean working tree), it just pushes, so `lzc` then `lzc main` works too. If the push fails, the commit is kept and git's error is shown.
- `--yes`, previews, and runs without a terminal never stage anything; they still need staged changes. Previews can't take a branch.
- A branch named `config`, `hook`, or `model` can't be pushed this way, because those names are commands.

### Pick a model

```bash
lazycommit model
```

Lists the text models of every provider you have a key for and saves your pick as the `model` setting. Use `--model provider/model` to override it for one run. See [Providers](/docs/configuration#providers).

### Large changes

In normal mode, lazycommit sends file statistics and the full included patch when it fits within `--max-diff-chars` (default 16,000 characters). Larger patches use bounded samples with omission markers.

When the file list does not fit either, lazycommit groups files into change areas: it splits the heaviest directories until the list fits, then shows the largest files. Code samples are spread across every area, largest files first, so a 1,000-file change still shows where the work happened.

```bash
lazycommit --max-diff-chars 24000
```

For changes spread across many files or with substantial code edits, use `--thorough`:

```bash
lazycommit --thorough --type conventional --generate 3
lazycommit --thorough --dry-run --context "Migrate authentication to the new session API"
```

Thorough mode:

1. Divides the included diff and file statistics into batches of up to 16,000 characters.
2. Asks the model to summarize each batch, keeping concrete behavior changes and affected components.
3. Combines the notes, summarizing them further if needed.
4. Generates and validates the final suggestions from those notes.

It uses more API requests and takes longer. Regenerate reuses the batch analysis. The input limit is 1.6 million characters. Beyond that, exclude unnecessary files or stage smaller commits. `--max-diff-chars` applies to normal mode only. Character budgets are not exact token counts, and API limits can still apply.

To inspect the batches before using the API:

```bash
lazycommit --preview-diff --thorough
```

### Generated files and exclusions

Lockfiles, minified files, and common build directories appear in the statistics, but their patches are omitted by default. Include those patches when they matter:

```bash
lazycommit --include-generated
```

Exclude paths from both statistics and code context with repeatable Git pathspecs, relative to the repository root:

```bash
lazycommit --exclude 'dist/**' --exclude '*.log'
```

Exclusions affect analysis only. Excluded files that are staged are still committed. Binary changes and renames are identified in the statistics. Binary contents are not interpreted.

## Git options

These Git options are passed to `git commit`:

- `--signoff` (`-s`), `--no-signoff`
- `--no-verify` (`-n`)
- `--author`, `--date`, `--trailer`, `--cleanup`
- `--gpg-sign` (`-S`), `--no-gpg-sign`
- `--quiet` (`-q`), `--verbose` (`-v`)

```bash
lazycommit --type conventional --signoff
lazycommit --author="Your Name <you@example.com>"
lazycommit --gpg-sign=YOUR_KEY_ID
```

Any other option is rejected. That includes options that replace the message or change which content is committed, such as `-m`, `--amend`, and path arguments. Use `git commit` directly for those workflows.

## Git hook

Install the `prepare-commit-msg` hook inside a repository:

```bash
lazycommit hook install
```

Then use Git normally:

```bash
git add src/
git commit
```

The hook generates a subject for review in your Git editor. With multiple suggestions, uncomment the one you want. For `git commit --no-edit` with an empty message file, it uses the first suggestion.

An explicit message bypasses generation:

```bash
git commit -m "Write this message myself"
```

The hook uses normal-mode analysis, your saved generation settings, and the same message validation as the CLI. Thorough analysis is available only through the CLI. The installer targets `.git/hooks/prepare-commit-msg`. It does not support custom `core.hooksPath` locations or linked-worktree installation.

Remove the hook with:

```bash
lazycommit hook uninstall
```

## Flags

| Option | Behavior | Default and limits |
| --- | --- | --- |
| `--generate`, `-g` | Number of suggestions to request | `1`, range 1 to 5 |
| `--type`, `-t` | Plain or conventional subject | Empty (plain) or `conventional` |
| `--scope` | Require an explicit conventional scope | Empty, up to 40 characters, requires conventional type |
| `--context` | Additional intent or constraints | Empty, one line, up to 2,000 characters |
| `--locale` | Language of the subject | `en`, for example `ja` or `pt-BR` |
| `--model` | Model as `provider/model` | First provider with a key; see [Providers](/docs/configuration#providers) |
| `--max-length` | Maximum subject length | `100`, range 20 to 200 Unicode characters |
| `--max-diff-chars` | Normal-mode diff context budget | `16000`, range 1000 to 100000 |
| `--timeout` | Timeout per API request, in milliseconds | `10000`, range 500 to 300000 |
| `--thorough` | Analyze every included diff batch before generation | Off |
| `--include-generated` | Include generated-file and lockfile patches | Off |
| `--exclude`, `-x` | Exclude a pathspec from analysis | Repeatable |
| `--all`, `-a` | Stage modifications and deletions in tracked files | Off |
| `--dry-run` | Generate subjects without committing | Off |
| `--preview-diff` | Print diff context without calling the API | Off |
| `--yes`, `-y` | Commit the first suggestion without prompts | Off |
| `--help`, `-h` | Show usage | None |
| `--version` | Show the installed version | None |

Generation flags override [saved settings](/docs/configuration). Workflow switches such as `--thorough` and `--yes` apply per invocation only.
