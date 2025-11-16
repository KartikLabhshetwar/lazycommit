---
title: Usage
description: Use lazycommit's commands and features.
---

lazycommit makes generating commit messages effortless. Here's everything you need to know.

## Generating Commits

### Basic Usage

Stage your changes and run lazycommit:

```bash
git add <files...>
lazycommit
```

lazycommit analyzes your staged changes and generates a commit message. You'll see a menu to:
- Use the message as-is
- Edit the message
- Cancel

### Stage All Changes

You can stage all changes in tracked files as you commit:

```bash
lazycommit --all # or -a
```

This is equivalent to `git commit --all`.

> 👉 **Tip:** Use the `lzc` alias if `lazycommit` is too long for you.

### Generate Multiple Recommendations

Sometimes the recommended commit message isn't the best, so you want it to generate a few to pick from. You can generate multiple commit messages at once:

```bash
lazycommit --generate <i> # or -g <i>
```

Where `i` is the number of generated messages (default: 1).

> **Warning:** This uses more tokens, meaning it costs more.

### Conventional Commits

Generate commit messages that follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```bash
lazycommit --type conventional # or -t conventional
```

This will format the commit message according to the Conventional Commits specification, which is useful if your project follows this standard or if you're using tools that rely on this commit format.

### Exclude Files from Analysis

You can exclude specific files from AI analysis:

```bash
lazycommit --exclude package-lock.json --exclude dist/
```

This is useful for excluding build artifacts, lock files, or other files that shouldn't influence the commit message.

## Git Hook Integration

You can also integrate lazycommit with Git via the `prepare-commit-msg` hook. This lets you use Git like you normally would, and edit the commit message before committing.

### Install the Hook

In the Git repository you want to install the hook in:

```bash
lazycommit hook install
```

### Uninstall the Hook

In the Git repository you want to uninstall the hook from:

```bash
lazycommit hook uninstall
```

### Using the Hook

1. Stage your files and commit:

   ```bash
   git add <files...>
   git commit # Only generates a message when it's not passed in
   ```

   > If you ever want to write your own message instead of generating one, you can simply pass one in: `git commit -m "My message"`

2. lazycommit will generate a high-quality commit message and pass it back to Git. Git will open it with your configured editor for you to review/edit it.

3. Save and close the editor to commit!

## Review, Edit, and Confirm

lazycommit lets you review the generated message, optionally edit it, and then confirm before it is committed:

- You'll see a menu: **Use as-is**, **Edit**, or **Cancel**
- If you choose **Use as-is**, it commits immediately without additional prompts
- If you choose **Edit**, you can modify the message; then you'll be asked to confirm the final message before committing

Example:

```bash
git add .
lazycommit
# Review generated commit message:
#   feat: add lazycommit command
# → Choose "Use as-is" to commit immediately
# → Or choose "Edit" to modify, then confirm the final message before commit
```

## Handling Large Diffs

For large commits with many files, lazycommit automatically stays within API limits and generates relevant commit messages:

- **Smart summarization**: Uses `git diff --cached --numstat` to create compact summaries of all changes
- **Context snippets**: Includes truncated diff snippets from top changed files for better context
- **Token-safe processing**: Keeps prompts small while maintaining accuracy for 20+ file changes
- **Single commit**: Always generates one commit message, no matter how many files are staged
- **Enhanced analysis**: Uses improved prompts and smart truncation for better commit message quality

## All Available Flags

**Commit generation:**

- **`-g, --generate <number>`** - Number of messages to generate (default: 1)
- **`-x, --exclude <file>`** - Files to exclude from AI analysis (can be used multiple times)
- **`-a, --all`** - Automatically stage changes in tracked files for the commit
- **`-t, --type <type>`** - Type of commit message to generate (e.g., `conventional`)
- **`-s, --split`** - Create multiple commits by grouping files logically

**Other flags:**

- lazycommit passes down unknown flags to `git commit`, so you can pass in [commit flags](https://git-scm.com/docs/git-commit)

## Quick Examples

```bash
# Basic commit
git add .
lazycommit

# Stage all and commit
lazycommit --all

# Generate 3 options to choose from
lazycommit --generate 3

# Generate conventional commit
lazycommit --type conventional

# Exclude build artifacts
lazycommit --exclude dist/ --exclude node_modules/

# Use the short alias
lzc --all
```

> **Tip:** Need to configure API keys, models, or other settings? Check out [Configuration](/docs/configuration) for setup instructions.
