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

Lazycommit is a TypeScript CLI that uses Git and an AI provider of your choice to generate commit subjects from your staged changes. Choose a suggestion, edit it, regenerate it, or cancel before committing. Use `lazycommit` or its shorter alias, `lzc`.

- **Analyze large changes:** use bounded code samples or opt into deeper analysis with `--thorough`.
- **Choose your provider:** OpenAI, Gemini, Anthropic, Kimi, DeepSeek, GLM, MiniMax, or Groq.
- **Control the result:** choose the model, language, format, scope, length, and additional context.
- **Preview first:** inspect the diff context locally or generate messages without committing.
- **Fit your workflow:** use interactive review, an explicit noninteractive mode, or a Git hook.

## Install

You need Git, Node.js 22.13 or newer, and an API key for one [supported provider](#providers).

```sh
npm install -g lazycommitt
lazycommit config set GROQ_API_KEY="gsk_your_key_here"   # or another provider's key
```

The npm package is **`lazycommitt`** (two t's). The commands are **`lazycommit`** and **`lzc`**.

Or with Homebrew:

```sh
brew tap KartikLabhshetwar/lazycommit https://github.com/KartikLabhshetwar/lazycommit
brew install lazycommit
```

### Upgrade

```sh
npm update -g lazycommitt
# Homebrew:
brew update && brew upgrade lazycommit
```

Check your version with `lazycommit --version`. Coming from 1.x: `--split` was removed, and `-s` now means Git's `--signoff`.

## Providers

| Provider | Key | Default model |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `openai/gpt-5.4-mini` |
| Google Gemini | `GOOGLE_API_KEY` | `google/gemini-3.5-flash-lite` |
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/claude-haiku-4-5` |
| Kimi (Moonshot AI) | `MOONSHOT_API_KEY` | `moonshotai/kimi-k2.6` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek/deepseek-flash` |
| GLM (Z.AI) | `ZHIPU_API_KEY` | `zai/glm-5.3-flash` |
| MiniMax | `MINIMAX_API_KEY` | `minimax/MiniMax-M3` |
| Groq | `GROQ_API_KEY` | `groq/openai/gpt-oss-20b` |

Without a `model` setting, lazycommit uses the first provider in this table that has a key. Pick one explicitly with `provider/model`:

```sh
lazycommit config set ANTHROPIC_API_KEY="sk-ant-your_key_here"
lazycommit config set model=anthropic/claude-haiku-4-5
lzc --model google/gemini-3.5-flash-lite
```

Models are routed through [Mastra](https://mastra.ai/models), so other Mastra providers also work; set their key as an environment variable, for example `OPENROUTER_API_KEY`. Groq model names from earlier versions, such as `openai/gpt-oss-20b` or `llama-3.3-70b-versatile`, still work.

## Usage

Stage what you want to commit, then run `lzc`:

```sh
git add src/ README.md
lzc
```

Choose **Use as-is**, **Edit**, **Regenerate**, or **Cancel**. Nothing is committed until you choose, and only staged changes are committed.

```sh
lzc --type conventional               # fix(api): reject empty tokens
lzc --type conventional --scope api   # require a specific scope
lzc --generate 3                      # choose from up to 3 suggestions
lzc --context "Keep login behavior while replacing session storage"
lzc --locale ja                       # write the subject in Japanese
lzc --all                             # stage modified and deleted tracked files first
lzc --yes                             # commit the first suggestion without prompts
lzc --dry-run                         # print suggestions without committing
lzc --preview-diff                    # print the analysis context; no API call
```

- `--type conventional` follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). Edited messages must keep that format.
- `--all` does not add untracked files.
- `--generate` sends one request per suggestion. Duplicates are removed, so you may get fewer than requested.
- `--dry-run` prints one subject per line to stdout and errors to stderr. Both preview modes need staged changes and reject `--all`.
- Without an interactive terminal, pass `--yes`, `--dry-run`, or `--preview-diff`.

### Large changes

By default, lazycommit sends file statistics and the full staged patch when it fits in 16,000 characters. Larger patches are sampled, with omission markers. Raise the budget with `--max-diff-chars 24000`.

When the file list does not fit either, lazycommit groups files into change areas: it splits the heaviest directories until the list fits, then shows the largest files. Code samples are spread across every area, largest files first, so a 1,000-file change still shows where the work happened.

For changes spread across many files, use `--thorough`. It summarizes the diff in batches of up to 16,000 characters, combines the notes, and writes the subject from them. It makes more API requests and takes longer; the input limit is 1.6 million characters.

```sh
lzc --thorough --type conventional --generate 3
lzc --preview-diff --thorough        # inspect the batches locally first
```

Character budgets are not exact token counts, so API limits can still apply.

### Generated files and exclusions

Lockfiles, minified files, and common build directories appear in the statistics, but their patches are skipped. Include them with `--include-generated`.

Exclude paths from analysis with repeatable, repository-root Git pathspecs:

```sh
lzc --exclude 'dist/**' --exclude '*.log'
```

**Exclusions affect analysis only. Excluded files that are staged are still committed.** Binary changes and renames show up in the statistics; binary contents are not read.

### Git options

These pass through to `git commit`: `--signoff` (`-s`), `--no-signoff`, `--no-verify` (`-n`), `--author`, `--date`, `--trailer`, `--cleanup`, `--gpg-sign` (`-S`), `--no-gpg-sign`, `--quiet` (`-q`), and `--verbose` (`-v`).

```sh
lzc --type conventional --signoff
lzc --author="Your Name <you@example.com>"
```

Options that replace the message or change what gets committed (`-m`, `--amend`, paths) are rejected. Use `git commit` directly for those.

## Options

| Option | Behavior | Default / limits |
| --- | --- | --- |
| `--generate`, `-g` | Number of suggestions | `1`; range `1–5` |
| `--type`, `-t` | Plain or conventional subject | `""` or `conventional` |
| `--scope` | Required conventional scope | Up to 40 characters; needs `--type conventional` |
| `--context` | Extra intent or constraints | One line, up to 2,000 characters |
| `--locale` | Subject language | `en`; e.g. `ja`, `pt-BR` |
| `--model` | Model as `provider/model` | First provider with a key; see [Providers](#providers) |
| `--max-length` | Maximum subject length | `100`; range `20–200` |
| `--max-diff-chars` | Normal-mode diff budget | `16000`; range `1000–100000` |
| `--timeout` | Per-request timeout (ms) | `10000`; range `500–300000` |
| `--thorough` | Summarize every diff batch first | Off |
| `--include-generated` | Include generated and lockfile patches | Off |
| `--exclude`, `-x` | Exclude a pathspec from analysis | Repeatable |
| `--all`, `-a` | Stage tracked modifications and deletions | Off |
| `--dry-run` | Print suggestions without committing | Off |
| `--preview-diff` | Print diff context without calling the API | Off |
| `--yes`, `-y` | Commit the first suggestion without prompts | Off |

Run `lazycommit --help` to see the options for your installed version.

## Configuration

Settings are stored in `~/.lazycommit` (INI, owner-only permissions). CLI flags override them.

```sh
lazycommit config set type=conventional max-length=72 generate=3
lazycommit config get model type max-length
lazycommit config set scope= context= proxy=   # clear values
```

Keys: the provider keys from [Providers](#providers), `proxy`, `model`, `locale`, `generate`, `type`, `scope`, `context`, `timeout`, `max-length`, and `max-diff-chars`. Defaults and limits match the options table. Switches such as `--thorough` and `--yes` apply per run only.

Provider key environment variables override saved keys. Proxy variables override the saved `proxy`, in this order: `https_proxy`, `HTTPS_PROXY`, `http_proxy`, `HTTP_PROXY`.

```sh
lazycommit config set proxy=http://localhost:8080
```

## Git hook

Generate messages from plain `git commit`:

```sh
lazycommit hook install
git add src/
git commit        # the subject opens in your editor for review
```

- With multiple suggestions, uncomment the one you want.
- `git commit -m "..."` skips generation.
- `git commit --no-edit` uses the first suggestion.

The hook uses normal-mode analysis and your saved settings; `--thorough` is CLI-only. It installs to `.git/hooks/prepare-commit-msg` and does not support `core.hooksPath` or linked worktrees. Remove it with `lazycommit hook uninstall`.

## How it works

- Lazycommit snapshots the Git index and analyzes staged content only, including partially staged files. Unstaged edits are never sent.
- It sends that diff context and your instructions to your chosen provider. `--preview-diff` builds the same context locally without sending it.
- Each subject is checked for a single line, length, format, and scope. Invalid subjects get one retry and are never truncated. A subject that is only too long is shortened from a short change overview, without resending the diff. Transient API errors are retried up to twice.
- Before committing, lazycommit checks that the staged tree and HEAD still match what was analyzed. If either changed, it stops.

Always review the result. AI summaries can miss important details.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| No staged changes | Check `git diff --cached`, stage with `git add` or `--all`, and check your exclusions. |
| Subject is too vague | Add `--context`, try `--thorough`, or commit related changes separately. |
| No valid subject after retries | Raise `--max-length` or try another model with `--model`. |
| Request too large (413) | Lower `--max-diff-chars`, exclude files, or stage smaller commits. |
| Rate limit (429) | The error says how long to wait. Wait, lower `--generate`, or skip `--thorough`. |
| Request timed out | Raise `--timeout` (e.g. `30000`) and check your connection. |
| Authentication (401/403) | Check your API key and its model permissions. |
| Staged content changed during review | Run lazycommit again. |
| Unknown option | Check `lazycommit --version` and upgrade. |
| Saved settings are ignored | Keys under a section such as `[DEFAULT]` are not read. Save them again with `lazycommit config set`. |

## Development

Built with TypeScript, [cleye](https://github.com/privatenumber/cleye), [@clack/prompts](https://github.com/bombshell-dev/clack), [execa](https://github.com/sindresorhus/execa), and [Mastra](https://mastra.ai), bundled with [pkgroll](https://github.com/privatenumber/pkgroll).

```sh
git clone https://github.com/KartikLabhshetwar/lazycommit.git
cd lazycommit
pnpm install        # Node from .nvmrc, pnpm 10.15.0
pnpm type-check && pnpm build && pnpm test
node dist/cli.mjs --help
```

Tests run offline against temporary Git repositories and a mock API. Live Groq tests run when `GROQ_API_KEY` is set; proxy tests also need `LAZYCOMMIT_TEST_PROXY`.

| File | Responsibility |
| --- | --- |
| [`src/utils/git.ts`](src/utils/git.ts) | Index snapshots, statistics, samples, and analysis batches |
| [`src/utils/ai.ts`](src/utils/ai.ts) | Provider selection, batch summaries, generation, validation, and API errors |
| [`src/utils/prompt.ts`](src/utils/prompt.ts) | Message format and content instructions |
| [`src/commands/lazycommit.ts`](src/commands/lazycommit.ts) | Review, editing, regeneration, previews, and committing |
| [`src/utils/config.ts`](src/utils/config.ts) | Persistent settings and validation |
| [`tests/regressions.ts`](tests/regressions.ts) | Offline regression checks |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## Maintainer and license

Maintained by [Kartik Labhshetwar](https://github.com/KartikLabhshetwar). Licensed under [Apache-2.0](LICENSE).
