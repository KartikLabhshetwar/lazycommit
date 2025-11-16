---
title: Introduction
description: Learn what lazycommit is and why you should use it.
---

lazycommit is a CLI tool that writes your git commit messages for you with AI using Groq. Never write a commit message again.

## Why lazycommit?

Writing good commit messages is hard. We've all been there:

- Staring at a blank commit message box, unsure what to write
- Defaulting to vague messages like "fix bug" or "update stuff"
- Struggling to maintain consistency across team commits
- Spending more time writing commit messages than actually coding

lazycommit solves this by doing the thinking for you. It analyzes your actual code changes and generates meaningful, professional commit messages in seconds—so you can focus on what matters: writing great code.

## How It Works

```bash
# Stage your changes
git add .

# Generate and commit with AI-generated message
lazycommit
# or use the short alias
lzc

# That's it! ✨
```

## Features

- **Lightning Fast** - Powered by Groq's ultra-fast inference API
- **Context-Aware** - Analyzes actual code changes, not just file names
- **Smart Large Diff Handling** - Automatically handles large commits with compact summaries
- **Conventional Commits** - Generate conventional commit messages with `--type conventional`
- **Git Hook Integration** - Works seamlessly with git hooks for automatic message generation
- **Multiple Recommendations** - Generate multiple commit messages to choose from
- **Smart Defaults** - Works great out of the box, customizable when you need it

## What Makes lazycommit Special

lazycommit uses Groq's fast inference API, which provides:

- **Ultra-fast generation** - Get commit messages in seconds
- **Cost-effective** - More affordable than traditional AI APIs
- **Open source models** - Uses leading open-source language models
- **Reliable** - High uptime and consistent performance

## Large Diff Handling

For large commits that exceed API token limits, lazycommit automatically:

1. Detects large/many-file diffs and switches to enhanced analysis mode
2. Creates compact summaries using `git diff --numstat` to capture all changes efficiently
3. Includes context snippets from the most changed files to provide semantic context
4. Generates a single commit message that accurately reflects all changes without hitting API limits

This ensures you can commit large changes (like new features, refactoring, or initial project setup) without hitting API limits, while maintaining accuracy and high-quality commit messages.

**Ready to upgrade your commits?** Let's get you started with [installation](/docs/installation) and setup.
