# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LazyCommit is a CLI tool that generates git commit messages using Groq's AI API. It analyzes staged changes and creates conventional commit messages automatically.

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Build the project (uses pkgroll with minification)
pnpm build

# Type checking
pnpm type-check

# Run tests
pnpm test

# Prepare for package publishing
pnpm prepack
```

## Architecture

### Core Components

1. **CLI Entry Point** (`src/cli.ts`): Main CLI interface using cleye framework, handles command parsing and routing
2. **Command Handlers** (`src/commands/`):
   - `lazycommit.ts`: Main commit generation logic with multi-commit support
   - `config.ts`: Configuration management commands
   - `hook.ts`: Git hook installation/management
   - `prepare-commit-msg-hook.ts`: Git hook implementation

3. **Utilities** (`src/utils/`):
   - `groq.ts`: Groq API integration for AI message generation
   - `git.ts`: Git operations, diff handling, and file classification
   - `config.ts`: Configuration file management
   - `prompt.ts`: User interaction prompts
   - `error.ts`: Error handling

### Key Features

- **Multi-commit mode**: Automatically splits large changesets into logical groups when files ≥ 5
- **File classification**: Smart categorization into conventional commit types (feat, fix, docs, ci, build, test, chore)
- **Token management**: Handles large diffs through summaries and chunking
- **Configuration**: Stored in `~/.lazycommit` file

### Conventional Commit Classification Logic

Files are classified into commit types based on patterns:
- `docs`: Documentation files (*.md, docs/, README, etc.)
- `ci`: CI/CD workflows (.github/, pipelines, etc.)
- `build`: Build configs and dependencies (package.json, webpack, docker, etc.)
- `test`: Test files (*test.js, __tests__/, spec files, etc.)
- `feat`: Feature code with optional scopes (api, auth, db, ui, etc.)
- `fix`/`refactor`/`style`/`perf`: Determined by AI based on diff content
- `chore`: Default for unclassified files

### Large Diff Handling

When diffs exceed token limits:
1. Uses `git diff --cached --numstat` for compact summaries
2. Groups files by type/scope
3. Auto-splits large buckets by second-level directory
4. Generates separate commits per group

## Testing

Tests use the manten framework and are located in `tests/`:
- `tests/specs/cli/`: CLI command tests
- `tests/specs/groq/`: Groq API integration tests
- `tests/specs/config.ts`: Configuration tests
- `tests/specs/git-hook.ts`: Git hook tests

## TypeScript Configuration

- Target: ES2020
- Module: Node16
- Strict mode enabled
- No emit (build handled by pkgroll)

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
