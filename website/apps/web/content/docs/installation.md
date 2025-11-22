---
title: Installation
description: Install and set up lazycommit.
---

Getting lazycommit up and running takes less than a minute. Let's walk through it.

## Prerequisites

- **Node.js** (v18 or higher)
- **Git** installed and configured
- A **Groq API key** from [Groq Console](https://console.groq.com/keys)

## Quick Install

Install lazycommit globally using your package manager of choice.

### npm

```bash
npm install -g lazycommitt
```

That's it! You can now use `lazycommit` (or the `lzc` alias) from anywhere in your terminal.

### Homebrew (macOS)

Install via Homebrew tap:

```bash
brew tap KartikLabhshetwar/lazycommit https://github.com/KartikLabhshetwar/lazycommit
brew install lazycommit
```

## API Key Setup

lazycommit needs a Groq API key to generate commit messages. Set the key so lazycommit can use it:

```bash
lazycommit config set GROQ_API_KEY=<your token>
```

This will create a `.lazycommit` file in your home directory.

> **Note:** If you haven't already, you'll need to create an account at [Groq Console](https://console.groq.com/keys) and get your API key.

## Verify Installation

Check that lazycommit is installed correctly:

```bash
lazycommit --version
```

You should see the current version number. If you do, you're all set!

## Upgrading

Check the installed version with:

```bash
lazycommit --version
```

If it's not the [latest version](https://github.com/KartikLabhshetwar/lazycommit/releases/latest), run:

```bash
npm update -g lazycommitt
```

Or if you installed via Homebrew:

```bash
brew update
brew upgrade lazycommit
```

**Having trouble?** Check out our [FAQ](/docs/reference/faq) or [open an issue](https://github.com/KartikLabhshetwar/lazycommit/issues) on GitHub.
