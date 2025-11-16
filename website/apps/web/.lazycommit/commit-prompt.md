# Commit Message Guidelines

## Format

Conventional commits: `type(scope): description` or `type: description`

## Style Rules

- **Tense**: Imperative/present ("add", "fix", "update")
- **Capitalization**: Lowercase first letter
- **Length**: Concise, typically under 70 characters
- **Tone**: Technical and straightforward

## Commit Types

- `feat`: New features or functionality
- `fix`: Bug fixes and issue resolutions
- `docs`: Documentation updates
- `refactor`: Code restructuring or improvements
- `test`: Adding or updating tests
- `chore`: Routine tasks, maintenance, or updates
- `perf`: Performance improvements
- `build`: Build system or dependency changes

## Scope Usage

Use scopes in parentheses to indicate the area affected. Common scopes:

- `cli` - CLI command changes
- `config` - Configuration management
- `groq` - Groq API integration
- `git` - Git operations and utilities
- `hook` - Git hook functionality
- `web` or `website` - Website/documentation site changes
- `docs` - Documentation updates
- `test` - Test-related changes

Omit scope for general changes that affect multiple areas.

## Description Patterns

Start with an action verb (add, fix, update, improve, refactor). Be specific about what was changed or added.

## Examples

- feat(cli): add `--exclude` flag for file exclusion
- fix(groq): handle API timeout errors gracefully
- refactor(git): improve large diff detection logic
- docs(web): update installation instructions
- fix(config): validate API key format
- feat(hook): add prepare-commit-msg hook support
- chore: update dependencies
- test: add unit tests for message generation
- perf(groq): optimize prompt token usage
- docs: update README with new features
