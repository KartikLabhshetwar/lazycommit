# Contributing to lazycommit

Thank you for your interest in contributing to lazycommit! This guide will help you get started with the development setup and contribution process.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setting up the project](#setting-up-the-project)
- [Development workflow](#development-workflow)
- [Testing](#testing)
- [Code quality guidelines](#code-quality-guidelines)
- [Contributing process](#contributing-process)
- [Using & testing your changes](#using--testing-your-changes)
- [Project structure](#project-structure)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20 (as specified in `.nvmrc`)
- **pnpm**: Version 10.15.0 (as specified in `package.json`)
- **nvm**: For managing Node.js versions
- **Git**: For version control

## Setting up the project

### 1. Clone the repository

```sh
git clone https://github.com/KartikLabhshetwar/lazycommit.git
cd lazycommit
```

### 2. Use the correct Node.js version

Use [nvm](https://nvm.sh) to use the appropriate Node.js version from `.nvmrc`:

```sh
nvm install
nvm use
```

### 3. Install dependencies

Install the dependencies using pnpm:

```sh
pnpm install
```

## Development workflow

### Building the project

Run the `build` script to compile TypeScript and bundle the project:

```sh
pnpm build
```

The package is bundled using [pkgroll](https://github.com/privatenumber/pkgroll) (Rollup). It infers the entry-points from `package.json` so there are no build configurations.

### Development (watch) mode

During development, you can use the watch flag (`--watch, -w`) to automatically rebuild the package on file changes:

```sh
pnpm build -w
```

### Type checking

Run TypeScript type checking:

```sh
pnpm type-check
```

### Running the package locally

Since pkgroll knows the entry-point is a binary (being in `package.json#bin`), it automatically adds the Node.js hashbang to the top of the file, and chmods it so it's executable.

You can run the distribution file in any directory:

```sh
./dist/cli.mjs
```

Or in non-UNIX environments, you can use Node.js to run the file:

```sh
node ./dist/cli.mjs
```

## Testing

### Running tests

The default test command runs deterministic regression checks against a local mock API. To also run live Groq integration tests, pass `GROQ_API_KEY`:

```sh
GROQ_API_KEY=<your GROQ key> pnpm test
```

Build first, then run offline tests without an API key:

```sh
pnpm build
pnpm test
```

Proxy integration tests additionally require `LAZYCOMMIT_TEST_PROXY` pointing to a running HTTP/HTTPS proxy.

### Test structure

The project uses [manten](https://github.com/privatenumber/manten) for testing. Tests are organized in the `tests/` directory:

- `tests/regressions.ts` - Offline diff, generation, CLI, and hook regression checks
- `tests/specs/cli/` - CLI command tests
- `tests/specs/groq/` - Groq API integration tests
- `tests/specs/config.ts` - Configuration tests
- `tests/specs/git-hook.ts` - Git hook tests
- `tests/fixtures/` - Test fixtures and sample diffs

### Test fixtures

The `tests/fixtures/` directory contains sample git diffs for testing different commit scenarios:
- `chore.diff` - Chore commits
- `new-feature.diff` - New feature commits
- `fix-nullpointer-exception.diff` - Bug fix commits
- `conventional-commits.diff` - Conventional commit format
- And more...

## Code quality guidelines

### TypeScript

- Use strict TypeScript configuration
- Follow the existing code style and patterns
- Ensure all functions have proper type annotations
- Use meaningful variable and function names

### Code style

- Follow the existing code patterns in the project
- Keep functions focused and single-purpose
- Use descriptive variable names
- Avoid unnecessary comments (code should be self-documenting)
- Avoid unnecessary if/else statements

### Project structure

```
src/
├── cli.ts                    # Main CLI entry point
├── commands/                 # CLI commands
│   ├── config.ts            # Configuration management
│   ├── hook.ts              # Git hook management
│   ├── lazycommit.ts        # Main commit generation logic
│   └── prepare-commit-msg-hook.ts  # Git hook implementation
└── utils/                   # Utility functions
    ├── config.ts            # Configuration utilities
    ├── error.ts             # Error handling
    ├── fs.ts                # File system utilities
    ├── git.ts               # Git operations
    ├── groq.ts              # Groq API integration
    └── prompt.ts            # User prompts
```

## Contributing process

### 1. Fork the repository

Fork the repository on GitHub and clone your fork locally.

### 2. Create a feature branch

```sh
git checkout -b feature/your-feature-name
```

### 3. Make your changes

- Write your code following the project's style guidelines
- Add tests for new functionality
- Update documentation if needed
- Ensure all tests pass

### 4. Test your changes

```sh
# Run type checking
pnpm type-check

# Build the project
pnpm build

# Run tests (without API key)
pnpm test

# Run tests with API key (if you have one)
GROQ_API_KEY=<your-key> pnpm test
```

### 5. Commit your changes

Use conventional commit messages:

```sh
git add .
git commit -m "feat: add new feature"
# or
git commit -m "fix: resolve issue with X"
# or
git commit -m "docs: update README"
```

### 6. Push and create a pull request

```sh
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Using & testing your changes

Let's say you made some changes in a fork/branch and you want to test it in a project. You can publish the package to a GitHub branch using [`git-publish`](https://github.com/privatenumber/git-publish):

Publish your current branch to a `npm/*` branch on your GitHub repository:

```sh
pnpm dlx git-publish
```

This will output something like:
```
✔ Successfully published branch! Install with command:
  → npm i 'KartikLabhshetwar/lazycommit#npm/develop'
```

Now, you can run the branch in your project:

```sh
pnpm dlx 'KartikLabhshetwar/lazycommit#npm/develop'
```

## Project structure

### Key files

- `src/cli.ts` - Main CLI entry point using cleye
- `src/commands/lazycommit.ts` - Commit review, preview, regeneration, and safe commit flow
- `src/utils/groq.ts` - Groq API integration with retry/fallback mechanisms
- `src/utils/config.ts` - Configuration management
- `src/utils/git.ts` - Git operations and file analysis utilities
- `package.json` - Project configuration and dependencies
- `tsconfig.json` - TypeScript configuration

### Dependencies

- **@clack/prompts** - Interactive CLI prompts
- **cleye** - CLI framework
- **groq-sdk** - Groq API client
- **execa** - Process execution
- **pkgroll** - TypeScript bundler
- **manten** - Testing framework

### Build process

1. TypeScript compilation
2. Bundling with pkgroll
3. Adding Node.js hashbang for executable
4. Output to `dist/cli.mjs`

### Architecture highlights

- Shared snapshot-based diff analysis for CLI and hooks, including renames and binary files
- Bounded code samples in normal mode; batched analysis with `--thorough`
- Validated AI subjects, a bounded format retry, and SDK retries for transient errors
- Explicit noninteractive commits and read-only preview modes
- No new runtime dependencies for the analysis pipeline

## Getting help

- Check existing [Issues](https://github.com/KartikLabhshetwar/lazycommit/issues)
- Create a new issue for bugs or feature requests
- Join discussions in pull requests

## License

By contributing to lazycommit, you agree that your contributions will be licensed under the Apache-2.0 License.
