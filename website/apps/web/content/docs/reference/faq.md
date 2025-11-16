---
title: FAQ
description: Common questions and troubleshooting for lazycommit.
---

Quick answers to common questions about lazycommit.

## Common Errors

### "Please set your Groq API key"

Configure your API key:

```bash
lazycommit config set GROQ_API_KEY=<your token>
```

Or set it as an environment variable:

```bash
export GROQ_API_KEY="your-api-key-here"
```

Get your key from [Groq Console](https://console.groq.com/keys).

### "No staged changes found"

Stage your changes first:

```bash
git add .
lazycommit
```

Or use the `--all` flag to automatically stage all tracked files:

```bash
lazycommit --all
```

### "Request too large" error (413)

If you get a 413 error, your diff is too large for the API. Try these solutions:

1. **Exclude build artifacts**:
   ```bash
   lazycommit --exclude "dist/**" --exclude "node_modules/**" --exclude ".next/**"
   ```

2. **Use a different model**:
   ```bash
   lazycommit config set model "llama-3.1-70b-versatile"
   ```

3. **Commit in smaller batches**:
   ```bash
   git add src/  # Stage only source files
   lazycommit
   git add docs/ # Then stage documentation
   lazycommit
   ```

### "No commit messages were generated"

- Check your API key: `lazycommit config get GROQ_API_KEY`
- Verify you have staged changes: `git status`
- Try excluding large files or using a different model
- Check your internet connection

## Quick Questions

### Why does lazycommit use Groq instead of other AI services?

lazycommit uses Groq because it provides:

- **Ultra-fast inference** - Get commit messages in seconds
- **Cost-effective** - More affordable than traditional AI APIs
- **Open source models** - Uses leading open-source language models
- **Reliable** - High uptime and consistent performance
- **Optimized for commits** - The default model is perfectly sized for conventional commit generation

### Does lazycommit send my code to Groq?

Only your **git diff** (staged changes) is sent to generate the commit message, not your entire codebase. For large diffs, lazycommit uses compact summaries to minimize data sent.

### How much does it cost?

lazycommit uses Groq's API, which offers competitive pricing. Check [Groq pricing](https://groq.com/pricing) for current rates. The default model (`openai/gpt-oss-20b`) is optimized for cost-effectiveness.

### How does lazycommit handle large diffs?

For large commits that exceed API token limits, lazycommit automatically:

1. Detects large/many-file diffs and switches to enhanced analysis mode
2. Creates compact summaries using `git diff --cached --numstat`
3. Includes context snippets from the most changed files
4. Generates a single commit message that accurately reflects all changes

This ensures you can commit large changes without hitting API limits while maintaining accuracy.

### Can I use lazycommit with git hooks?

Yes! Install the git hook:

```bash
lazycommit hook install
```

Then use `git commit` normally. lazycommit will automatically generate a commit message when you don't provide one.

### What's the difference between CLI mode and git hook mode?

- **CLI mode** (`lazycommit`): Interactive workflow where you review, edit, and confirm the message before committing
- **Git hook mode** (`lazycommit hook install`): Automatic generation that opens in your git editor for review

Both modes use the same enhanced analysis and quality improvements.

### Can I generate conventional commits?

Yes! Use the `--type` flag:

```bash
lazycommit --type conventional
```

Or set it in your config:

```bash
lazycommit config set type=conventional
```

### Can I exclude files from analysis?

Yes! Use the `--exclude` flag:

```bash
lazycommit --exclude package-lock.json --exclude dist/
```

You can use this flag multiple times to exclude multiple files or directories.

## Need More Help?

- [Installation Guide](/docs/installation) - Setup and configuration
- [Usage Guide](/docs/usage) - Commands and flags
- [Configuration](/docs/configuration) - Settings and options
- [GitHub Issues](https://github.com/KartikLabhshetwar/lazycommit/issues) - Report bugs or request features
