---
title: Installation
description: Install lazycommit, set an AI provider API key, and verify the setup.
---

## Requirements

- Git
- Node.js 22.13 or newer
- An API key for one [supported provider](/docs/configuration#providers)

The npm package is named `lazycommitt` (double t). The commands are `lazycommit` and `lzc`.

## Install

### npm

```bash
npm install -g lazycommitt
```

### Homebrew

```bash
brew tap KartikLabhshetwar/lazycommit https://github.com/KartikLabhshetwar/lazycommit
brew install lazycommit
```

## Set your API key

```bash
lazycommit config set GROQ_API_KEY="gsk_your_key_here"
```

Use the key for your provider instead, for example `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. See [Providers](/docs/configuration#providers) for the full list. Groq keys must start with `gsk_`. Keys are saved in `~/.lazycommit`, and lazycommit requests owner-only file permissions for that file.

You can also set the key in your environment. It overrides the saved key.

```bash
export GROQ_API_KEY="gsk_your_key_here"
```

`--preview-diff` does not need an API key. See [Configuration](/docs/configuration) for all settings.

## Verify

```bash
lazycommit --version
lazycommit --help
```

Then, inside a repository with staged changes, generate a message without committing:

```bash
lazycommit --dry-run
```

## Upgrade

Check your installed version:

```bash
lazycommit --version
```

If it is not the [latest version on npm](https://www.npmjs.com/package/lazycommitt), upgrade with npm:

```bash
npm update -g lazycommitt
```

Or, for a Homebrew installation:

```bash
brew update
brew upgrade lazycommit
```

Coming from 2.x: version 3 needs Node.js 22.13 or newer and supports [multiple providers](/docs/configuration#providers). Your saved `GROQ_API_KEY` keeps working, but a key for a provider earlier in the list (for example `OPENAI_API_KEY` in your shell) now wins. To stay on Groq, run `lazycommit config set model=groq/openai/gpt-oss-20b`.

## Next steps

- [Usage](/docs/usage): review flow and workflows.
- [FAQ](/docs/reference/faq): troubleshooting.
- [Open an issue](https://github.com/KartikLabhshetwar/lazycommit/issues) if something is broken.
