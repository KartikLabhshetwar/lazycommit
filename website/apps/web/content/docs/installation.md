---
title: Installation
description: Install lazycommit, set your Groq API key, and verify the setup.
---

## Requirements

- Git
- Node.js 20.5 or newer
- A [Groq API key](https://console.groq.com/keys) for message generation

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

The key must start with `gsk_`. It is saved in `~/.lazycommit`, and lazycommit requests owner-only file permissions for that file.

You can also set `GROQ_API_KEY` in your environment. It overrides the saved key.

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

## Next steps

- [Usage](/docs/usage): review flow and workflows.
- [FAQ](/docs/reference/faq): troubleshooting.
- [Open an issue](https://github.com/KartikLabhshetwar/lazycommit/issues) if something is broken.
