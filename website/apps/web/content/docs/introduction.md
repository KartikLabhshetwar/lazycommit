---
title: Introduction
description: What lazycommit is and how it turns staged changes into commit messages.
---

lazycommit is a TypeScript CLI that uses Git and an AI provider of your choice (OpenAI, Gemini, Anthropic, Kimi, DeepSeek, GLM, MiniMax, or Groq) to generate commit subjects from your staged changes. Choose a suggestion, edit it, regenerate it, or cancel before anything is committed. Run it as `lazycommit` or the shorter alias `lzc`.

## Quick example

1. Stage the changes you want to commit. You can also skip this step and pick files when lazycommit asks.

   ```bash
   git add src/ README.md
   ```

2. Run lazycommit.

   ```bash
   lzc
   ```

3. Review the suggested message. Choose **Use as-is**, **Edit**, **Regenerate**, or **Cancel**. Use as-is commits immediately. Edit shows a final confirmation before committing.

To try generation without creating a commit, run `lazycommit --dry-run`. To commit and push in one step, add the branch name: `lzc main`.

## Features

- **Staged content only:** analyzes what is in the index, including partially staged files. Unstaged edits are not read into the prompt.
- **Large changes:** sends the full patch when it fits the diff budget, bounded samples otherwise, or batch summaries with `--thorough`.
- **Control over the result:** choose the model, language, format, scope, length, and extra context.
- **Model picker:** `lzc model` lists the models your API keys can use and saves your pick.
- **Stage and push in one command:** with nothing staged, pick files from a list. `lzc main` pushes after committing.
- **Multiple suggestions:** request 1 to 5 subjects and pick one.
- **Preview first:** inspect the diff context locally with `--preview-diff`, or generate without committing with `--dry-run`.
- **Fits your workflow:** interactive review, an explicit noninteractive mode with `--yes`, or a `prepare-commit-msg` Git hook.
- **Safe commits:** stops if the staged tree or HEAD changed during generation or review.

lazycommit produces one subject line per suggestion and creates one commit. Check that the message is accurate before you commit. An AI summary can miss important details.

## Next steps

- [Installation](/docs/installation): requirements, install, API key, upgrading.
- [Configuration](/docs/configuration): saved settings, environment variables, proxy.
- [Usage](/docs/usage): workflows, Git options, the Git hook, all flags.
- [FAQ](/docs/reference/faq): troubleshooting, privacy, cost.
