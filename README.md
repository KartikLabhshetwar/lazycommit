<div align="center">
  <h1>lazycommit</h1>
  <p>Turn staged changes into commit messages you can review, edit, and use.</p>
  <img width="800" alt="lazycommit" src="https://github.com/user-attachments/assets/ee0419ef-2461-4b45-8509-973f3bb0f55c" />
  <p>
    <a href="https://www.npmjs.com/package/lazycommitt"><img src="https://img.shields.io/npm/v/lazycommitt" alt="npm version" /></a>
    <a href="https://github.com/KartikLabhshetwar/lazycommit/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/lazycommitt" alt="License" /></a>
  </p>
  <p>
    <a href="https://lazycommit.vercel.app">Website</a> ·
    <a href="https://github.com/KartikLabhshetwar/lazycommit/issues">Report an issue</a> ·
    <a href="https://peerlist.io/code_kartik/project/lazycommit">Peerlist</a>
  </p>
</div>

Lazycommit is a TypeScript CLI that uses Git and Groq to generate commit subjects from your staged changes. Choose a suggestion, edit it, regenerate it, or cancel before committing. Use `lazycommit` or its shorter alias, `lzc`.

- **Analyze large changes:** use bounded code samples or opt into deeper analysis with `--thorough`.
- **Control the result:** choose the model, language, format, scope, length, and additional context.
- **Preview first:** inspect the diff context locally or generate messages without committing.
- **Fit your workflow:** use interactive review, an explicit noninteractive mode, or a Git hook.

This README describes the current source. npm and Homebrew install published releases; to try the changes in this checkout, follow [Development](#development).

## Quick start

You need Git, Node.js 20.5 or newer, and a [Groq API key](https://console.groq.com/keys) for message generation.

```sh
npm install -g lazycommitt
lazycommit config set GROQ_API_KEY="gsk_your_key_here"
```

The npm package is named **`lazycommitt`**; the commands are **`lazycommit`** and **`lzc`**.

Inside your repository, stage the changes you want to commit:

```sh
git add src/ README.md
lazycommit
```

The review menu offers **Use as-is**, **Edit**, **Regenerate**, and **Cancel**. Use as-is commits immediately. Editing shows a final confirmation before committing.

To try generation without creating a commit:

```sh
lazycommit --dry-run
```

### Homebrew

```sh
brew tap KartikLabhshetwar/lazycommit https://github.com/KartikLabhshetwar/lazycommit
brew install lazycommit
```

### Upgrade

```sh
npm update -g lazycommitt
# Or, for a Homebrew installation:
brew update
brew upgrade lazycommit
```

Check your installed version with `lazycommit --version`.

## Common workflows

### Conventional commits

Plain subjects are the default. Request a conventional subject and, optionally, an explicit scope:

```sh
lazycommit --type conventional
lazycommit --type conventional --scope api --max-length 72
```

Example format: `fix(api): reject requests with an empty token`.

### Multiple suggestions

```sh
lazycommit --generate 3
```

Choose a suggestion, then review or edit it. Each requested suggestion uses a separate generation request. Duplicates are removed, and valid suggestions are retained if other requests fail, so fewer than the requested number may be returned.

### Give the model useful context

Explain the intent that a diff alone may not reveal:

```sh
lazycommit --context "Preserve existing login behavior while replacing session storage"
lazycommit --locale ja --type conventional
```

### Preview the analysis or output

```sh
# Inspect the diff context locally; no API key or network request required.
lazycommit --preview-diff

# Generate suggestions through Groq without committing.
lazycommit --dry-run --generate 3
```

`--dry-run` writes only the generated subjects to stdout, one per line. Errors go to stderr. Both preview modes require changes to be staged first and reject `--all`.

### Stage tracked changes or skip prompts

```sh
# Stage modified and deleted tracked files, then review the message.
lazycommit --all

# Commit the first valid suggestion without interactive review.
lazycommit --yes
```

`--all` does not add untracked files. Without an interactive terminal, choose `--yes`, `--dry-run`, or `--preview-diff` explicitly.

## Better context for large changes

Normal mode includes file statistics and the full included patch when it fits. Larger patches use bounded samples with omission markers. The default context budget is 16,000 characters:

```sh
lazycommit --max-diff-chars 24000
```

For a change spread across many files or substantial code edits, use thorough mode:

```sh
lazycommit --thorough --type conventional --generate 3
lazycommit --thorough --dry-run --context "Migrate authentication to the new session API"
```

Thorough mode:

1. Splits the included diff and file statistics into batches of up to 16,000 characters.
2. Asks the model to summarize each batch, retaining concrete behavior changes and affected components.
3. Combines the notes, summarizing them further if necessary.
4. Generates and validates the final commit suggestions from those notes.

It uses more API requests and takes longer. The input limit is 1.6 million characters; beyond that, exclude unnecessary files or stage smaller commits. `--max-diff-chars` controls normal mode only. Character budgets are not exact token counts, and API limits can still apply.

To inspect the batches before using the API:

```sh
lazycommit --preview-diff --thorough
```

### Generated files and exclusions

Lockfiles, minified files, and common build directories are represented in the statistics, but their patches are omitted by default. Include those patches when they matter:

```sh
lazycommit --include-generated
```

Exclude paths from both statistics and code context with repeatable, repository-root Git pathspecs:

```sh
lazycommit --exclude 'dist/**' --exclude '*.log'
```

**Exclusions affect analysis only. Excluded files that are staged will still be committed.** Binary changes and renames are identified in the statistics; binary contents are not interpreted.

## CLI reference

Run `lazycommit --help` for the installed version's options.

| Option | Behavior | Default / limits |
| --- | --- | --- |
| `--generate`, `-g` | Number of suggestions to request | `1`; range `1–5` |
| `--type`, `-t` | Plain or conventional subject | `""` or `conventional` |
| `--scope` | Require an explicit conventional scope | Empty; up to 40 characters; requires conventional mode |
| `--context` | Additional intent or constraints | Empty; one line, up to 2,000 characters |
| `--locale` | Language of the subject | `en`; e.g. `ja`, `pt-BR` |
| `--model` | Groq model identifier | `openai/gpt-oss-20b` |
| `--max-length` | Maximum generated subject length | `100`; range `20–200` Unicode characters |
| `--max-diff-chars` | Normal-mode diff context budget | `16000`; range `1000–100000` |
| `--timeout` | Timeout per API request, in milliseconds | `10000`; range `500–300000` |
| `--thorough` | Analyze every included diff batch before generation | Off |
| `--include-generated` | Include generated-file and lockfile patches | Off |
| `--exclude`, `-x` | Exclude a pathspec from analysis | Repeatable |
| `--all`, `-a` | Stage modifications and deletions in tracked files | Off |
| `--dry-run` | Generate subjects without committing | Off |
| `--preview-diff` | Print diff context without calling the API | Off |
| `--yes`, `-y` | Commit the first suggestion without prompts | Off |
| `--help`, `-h` | Show usage | — |
| `--version` | Show installed version | — |

### Git options

Supported Git options include `--signoff` (`-s`), `--no-signoff`, `--no-verify` (`-n`), `--author`, `--date`, `--trailer`, `--cleanup`, `--gpg-sign` (`-S`), `--no-gpg-sign`, `--quiet` (`-q`), and `--verbose` (`-v`).

```sh
lazycommit --type conventional --signoff
lazycommit --author="Your Name <you@example.com>"
lazycommit --gpg-sign=YOUR_KEY_ID
```

Options that replace the message or change which content is committed, such as `-m`, `--amend`, and path arguments, are rejected. Use `git commit` directly for those workflows. The previous nonfunctional `--split` option has been removed; `-s` now passes through to Git's sign-off option.

## Configuration

Settings are stored in `~/.lazycommit` in INI format. Set or read multiple values in one command:

```sh
lazycommit config set type=conventional max-length=72 generate=3
lazycommit config get model type max-length generate
lazycommit config set context="Preserve backward compatibility"
```

Persistable keys are `GROQ_API_KEY`, `proxy`, `model`, `locale`, `generate`, `type`, `scope`, `context`, `timeout`, and `max-length` / `max-diff-chars`. Their defaults and limits match the CLI reference above. Workflow switches such as `--thorough` and `--yes` are per-invocation options.

Clear an optional setting by assigning an empty value:

```sh
lazycommit config set scope= context= proxy=
# Return to plain subjects; clear any saved conventional scope too.
lazycommit config set type= scope=
```

CLI generation flags override saved settings. For credentials, you can also set `GROQ_API_KEY` in the environment; it overrides the saved key. Config writes request owner-only file permissions.

### Proxy support

```sh
lazycommit config set proxy=http://localhost:8080
```

HTTP/HTTPS proxy environment variables override the saved proxy, in this order: `https_proxy`, `HTTPS_PROXY`, `http_proxy`, `HTTP_PROXY`.

## Git hook

Install the `prepare-commit-msg` hook inside a repository:

```sh
lazycommit hook install
```

Then use Git normally:

```sh
git add src/
git commit
```

The hook generates a subject for review in your Git editor. With multiple suggestions, uncomment the one you want to use. For `git commit --no-edit` with an empty message file, it uses the first suggestion.

An explicit message bypasses generation:

```sh
git commit -m "Write this message myself"
```

The hook shares normal-mode analysis, saved generation settings, and message validation with the CLI. Thorough analysis is available through the CLI. The installer targets `.git/hooks/prepare-commit-msg`; it does not support custom `core.hooksPath` locations or linked-worktree hook installation.

Remove it with:

```sh
lazycommit hook uninstall
```

## How the generation works

Lazycommit snapshots the Git index and analyzes staged content, including partially staged files, without reading unstaged edits into the prompt. It sends the selected diff context and your generation instructions to Groq. `--preview-diff` performs the context-building step locally without sending it.

Generated subjects are checked for single-line output, length, and the requested format and scope. Invalid or incomplete subjects get one additional generation attempt. They are not shortened by cutting off words or recovered from the model's reasoning text. Transient API failures use the Groq SDK's retry behavior, configured for up to two retries.

Before a CLI commit, lazycommit checks that the staged tree and HEAD still match the analyzed snapshot. If either changed during generation or review, it stops so you can rerun with current content. The hook also checks for staged-tree changes before writing its result.

Generation produces one subject line per suggestion and creates one commit. Review factual accuracy: format checks and deeper analysis cannot guarantee that an AI summary captures every important detail.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| No staged changes | Check `git diff --cached`; stage files with `git add`, or use `--all` for tracked changes. Also check exclusions. |
| Subject is too vague | Add `--context`, try `--thorough`, or stage related changes separately. |
| No valid subject after retries | Increase `--max-length` or choose another model available to your Groq account with `--model`. |
| Request too large / 413 | In normal mode, lower `--max-diff-chars`. Exclude unnecessary files or stage smaller commits in either mode. |
| Rate limit / 429 | Wait before retrying, reduce `--generate`, or leave thorough mode off. |
| Request timed out | Increase `--timeout`, e.g. `--timeout 30000`, and check connectivity. |
| Authentication / 401 or 403 | Check your configured API key and the model permissions for that key. |
| Staged content changed during review | Rerun lazycommit to analyze the current index. |
| Unknown option after installation | Check `lazycommit --version` and `--help`; build this checkout for source features not in your installed release. |

## Development

The CLI is built with **TypeScript and Node.js**. It uses **cleye** for argument parsing, **@clack/prompts** for terminal interaction, **execa** to run Git, and **groq-sdk** for generation. **pkgroll** bundles the executable. The analysis changes reuse existing dependencies.

```sh
git clone https://github.com/KartikLabhshetwar/lazycommit.git
cd lazycommit
# Use the Node version in .nvmrc and pnpm 10.15.0.
pnpm install
pnpm type-check
pnpm build
pnpm test
```

Run the built CLI from the checkout:

```sh
node dist/cli.mjs --help
node dist/cli.mjs --thorough --dry-run --type conventional --generate 3
```

The second command needs staged changes and a configured Groq key. To use this build in another repository, run it by its absolute path from that repository.

Offline regression checks use temporary Git repositories and a local mock API to exercise diff handling, options, response validation, commits, hooks, and thorough analysis. Live Groq tests run when `GROQ_API_KEY` is set. Proxy integration tests additionally require `LAZYCOMMIT_TEST_PROXY` pointing to a running proxy.

Core implementation:

| File | Responsibility |
| --- | --- |
| [`src/utils/git.ts`](src/utils/git.ts) | Index snapshots, statistics, samples, and analysis batches |
| [`src/utils/groq.ts`](src/utils/groq.ts) | Batch summaries, generation, response validation, and API errors |
| [`src/utils/prompt.ts`](src/utils/prompt.ts) | Message format and content instructions |
| [`src/commands/lazycommit.ts`](src/commands/lazycommit.ts) | Review, editing, regeneration, previews, and committing |
| [`src/utils/config.ts`](src/utils/config.ts) | Persistent settings and validation |
| [`tests/regressions.ts`](tests/regressions.ts) | Offline regression checks |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## Maintainer and license

Maintained by [Kartik Labhshetwar](https://github.com/KartikLabhshetwar). Licensed under [Apache-2.0](LICENSE).
