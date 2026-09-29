---
title: FAQ
description: Troubleshooting, privacy, cost, and hook versus CLI.
---

Run `lazycommit --version` and `lazycommit --help` to confirm what your installed release supports.

## Troubleshooting

### The API key is missing or rejected

Set the key for your provider, for example:

```bash
lazycommit config set OPENAI_API_KEY="sk-your_key_here"
```

Or set it in your environment. The environment value overrides the saved key. Groq keys must start with `gsk_`. See [Providers](/docs/configuration#providers) for every key name.

If you use `--model` or a saved `model`, the key must belong to that model's provider.

### No staged changes

Check what is staged:

```bash
git diff --cached
```

Stage files with `git add`, or use `--all` to stage tracked changes. Also check your `--exclude` patterns. If every staged file is excluded, there is nothing to analyze.

### Interactive input is unavailable

Without an interactive terminal, choose one of `--yes` (commit the first suggestion), `--dry-run`, or `--preview-diff` explicitly.

### A git argument is unsupported

Only these Git options are accepted: `--signoff` (`-s`), `--no-signoff`, `--no-verify` (`-n`), `--author`, `--date`, `--trailer`, `--cleanup`, `--gpg-sign` (`-S`), `--no-gpg-sign`, `--quiet` (`-q`), and `--verbose` (`-v`). Options such as `-m`, `--amend`, and paths are rejected. Stage the files you want first, or use `git commit` directly.

### A scope requires conventional type

`--scope` and the `scope` setting only work with `--type conventional`. To return to plain subjects, clear the saved scope too:

```bash
lazycommit config set type= scope=
```

### Saved settings are ignored

Keys under a section header such as `[DEFAULT]` in `~/.lazycommit` are not read. Check them with `lazycommit config get type`, then save them again with `lazycommit config set`, which writes them at the top level.

### Preview options reject --all

`--dry-run` and `--preview-diff` do not stage anything. Stage your changes first, then run them without `--all`.

### The subject is too vague

Add `--context`, try `--thorough`, or stage related changes separately.

### No valid subject after retries

Increase `--max-length`, or choose another model with `--model`.

### Request too large (413)

In normal mode, lower `--max-diff-chars`. In either mode, exclude unnecessary files or stage smaller commits.

### Rate limit (429)

The error says how long to wait when the provider reports it. Wait before retrying, reduce `--generate`, or leave thorough mode off. Short waits are retried automatically.

### The request timed out

Increase `--timeout`, for example `--timeout 30000`, and check your connectivity and proxy settings.

### Authentication error (401 or 403)

Check your configured API key and the model permissions for that key.

### Staged changes or HEAD changed during review

lazycommit stops if the index or HEAD no longer matches the snapshot it analyzed. Run it again to analyze the current content.

### Unknown option after installation

Check `lazycommit --version` and `lazycommit --help`. Your installed release may be older than the docs. See [Upgrade](/docs/installation#upgrade).

### An excluded file was still committed

Exclusions affect analysis only. Any excluded file that is staged is still committed. Unstage it with `git restore --staged <path>` if you do not want it in the commit.

## How it works

### How are subjects validated?

Generated subjects are checked for single-line output, length, and the requested format and scope. With `--type conventional`, the subject must be a valid [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) header, such as `fix(parser): handle empty input`, and the scope must be a single word. Edited messages must keep that format. An invalid or incomplete subject gets one more generation attempt. A subject that is only too long is shortened by the model from a short change overview, without resending the diff. Subjects are never cut off. Transient API failures are retried up to twice.

Review the result yourself. Format checks cannot guarantee that an AI summary captures every important detail.

### Does lazycommit create more than one commit?

No. Each run produces one commit. `--generate` requests alternative subjects for that one commit.

### Does `--all` add new files?

No. `--all` stages modified and deleted files that Git already tracks. Add new files with `git add`.

### Which model does it use?

Without a saved model, lazycommit uses the first provider with a key, in this order: OpenAI, Gemini, Anthropic, Kimi, DeepSeek, GLM, MiniMax, Groq. Choose another with `--model provider/model` or `lazycommit config set model=provider/model`. See [Providers](/docs/configuration#providers).

## Privacy

### What is sent to the provider?

lazycommit snapshots the Git index and analyzes staged content, including partially staged files. Unstaged edits are not read into the prompt.

It sends the selected diff context and your generation instructions (format, scope, language, length limit, and `--context`) to your chosen provider. In thorough mode, every included diff batch is sent for summarizing. Patches for lockfiles and generated files are omitted unless you pass `--include-generated`.

### Can I see what would be sent?

Yes. `--preview-diff` builds the diff context locally and prints it without a network request. Add `--thorough` to see the batches.

```bash
lazycommit --preview-diff
lazycommit --preview-diff --thorough
```

See your provider's terms and privacy policy for how it handles data on its side.

## Cost

### How much does it cost?

lazycommit calls your provider's API with your key, so usage is billed by that provider.

Request count grows with:

- `--generate`: each suggestion is a separate generation request.
- `--thorough`: each diff batch is summarized with its own request before generation.
- Regenerate: each regeneration sends new requests.

## Hook and CLI

### What is the difference between the Git hook and the CLI?

| | CLI (`lazycommit`) | Git hook |
| --- | --- | --- |
| Run with | `lazycommit` or `lzc` | `git commit` |
| Review | Interactive menu: use, edit, regenerate, cancel | Your Git editor |
| Options | All flags | None. Uses saved settings |
| Analysis | Normal or `--thorough` | Normal only |
| Explicit message | Not supported. Use `git commit` | `git commit -m` skips generation |

Both share message validation. The hook does not support custom `core.hooksPath` locations or linked worktrees. Install it with `lazycommit hook install` and remove it with `lazycommit hook uninstall`. See [Usage](/docs/usage#git-hook).

## More help

- [Installation](/docs/installation)
- [Usage](/docs/usage)
- [Configuration](/docs/configuration)
- [GitHub issues](https://github.com/KartikLabhshetwar/lazycommit/issues)
