<div align="center">
  <div>
    <h1 align="center">lazycommit</h1>
<img width="2816" height="1536" alt="lazycommit" src="https://github.com/user-attachments/assets/ee0419ef-2461-4b45-8509-973f3bb0f55c" />

  </div>
	<p>A CLI that writes your git commit messages for you with AI. Never write a commit message again.</p>
	<a href="https://www.npmjs.com/package/lazycommitz"><img src="https://img.shields.io/npm/v/lazycommitt" alt="Current version"></a>
	<a href="https://github.com/KartikLabhshetwar/lazycommit"><img src="https://img.shields.io/github/stars/KartikLabhshetwar/lazycommit" alt="GitHub stars"></a>
	<a href="https://github.com/KartikLabhshetwar/lazycommit/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/lazycommitt" alt="License"></a>
</div>

---

## Setup

> The minimum supported version of Node.js is v18. Check your Node.js version with `node --version`.

1. Install _lazycommit_:

   ```sh
   npm install -g lazycommitt
   ```

### Install via Homebrew (macOS)

```sh
brew install lazycommit
```

Upgrade:

```sh
brew upgrade lazycommit
```

2. Choose your AI provider and get an API key:

   **Option A: Groq (Default)** - Fast inference with open models
   - Get your API key from [Groq Console](https://console.groq.com/keys)
   - Set the key: `lazycommit config set GROQ_API_KEY=<your token>`

   **Option B: OpenAI** - Use GPT models
   - Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Configure lazycommit:
     ```sh
     lazycommit config set provider=openai
     lazycommit config set OPENAI_API_KEY=<your token>
     lazycommit config set model=gpt-4o-mini  # or gpt-4o, gpt-4-turbo
     ```

   **Option C: Anthropic** - Use Claude models
   - Get your API key from [Anthropic Console](https://console.anthropic.com/settings/keys)
   - Configure lazycommit:
     ```sh
     lazycommit config set provider=anthropic
     lazycommit config set ANTHROPIC_API_KEY=<your token>
     lazycommit config set model=claude-3-5-sonnet-20241022  # or claude-3-5-haiku-20241022, claude-3-opus-20240229
     ```

   This will create a `.lazycommit` file in your home directory.

### Secure API Key Storage

lazycommit now supports secure storage of API keys using your system's native credential manager:
- **macOS**: Keychain Access
- **Linux**: Secret Service (libsecret)
- **Windows**: Credential Manager

#### Managing Secrets

Test available storage backends:
```sh
lazycommit secrets test
```

Store API keys securely:
```sh
lazycommit secrets set GROQ_API_KEY gsk_...
lazycommit secrets set OPENAI_API_KEY sk-...
lazycommit secrets set ANTHROPIC_API_KEY sk-ant-...
```

Migrate existing keys from `~/.lazycommit` to secure storage:
```sh
lazycommit secrets migrate
```

Export keys from secure storage (for backup):
```sh
lazycommit secrets export ~/lazycommit-backup.ini
```

When secure storage is available, API keys are automatically retrieved from it. The system falls back to file-based storage (`~/.lazycommit`) or environment variables if secure storage is unavailable.

### Upgrading

Check the installed version with:

```
lazycommit --version
```

If it's not the [latest version](https://github.com/KartikLabhshetwar/lazycommit/releases/latest), run:

```sh
npm update -g lazycommitt
```

## Usage

### CLI mode

You can call `lazycommit` directly to generate a commit message for your staged changes:

```sh
git add <files...>
lazycommit
```

`lazycommit` passes down unknown flags to `git commit`, so you can pass in [`commit` flags](https://git-scm.com/docs/git-commit).

For example, you can stage all changes in tracked files as you commit:

```sh
lazycommit --all # or -a
```

> 👉 **Tip:** Use the `lzc` alias if `lazycommit` is too long for you.

#### Generate multiple recommendations

Sometimes the recommended commit message isn't the best so you want it to generate a few to pick from. You can generate multiple commit messages at once by passing in the `--generate <i>` flag, where 'i' is the number of generated messages:

```sh
lazycommit --generate <i> # or -g <i>
```

> Warning: this uses more tokens, meaning it costs more.

#### Generating Conventional Commits

If you'd like to generate [Conventional Commits](https://conventionalcommits.org/), you can use the `--type` flag followed by `conventional`. This will prompt `lazycommit` to format the commit message according to the Conventional Commits specification:

```sh
lazycommit --type conventional # or -t conventional
```

This feature can be useful if your project follows the Conventional Commits standard or if you're using tools that rely on this commit format.

#### Exclude files from analysis

You can exclude specific files from AI analysis using the `--exclude` flag:

```sh
lazycommit --exclude package-lock.json --exclude dist/
```

#### Automatic multi-commit mode

When you stage many files, `lazycommit` can automatically split your changes into logical groups and create multiple commits with proper Conventional Commit messages.

- Auto-trigger: when staged files ≥ 5, or when the diff is large
- Grouping: buckets by type/scope (e.g., `feat(api)`, `docs`, `ci`, `build`, `test`, `chore`)
- Deep split: if everything falls into one big bucket (e.g., `app/api/*`), it auto-splits by second-level directory (like `analytics`, `projects`, `sessions`)
- Token-safe AI: each group uses a compact `git diff --cached --numstat` summary (not full diffs) to generate the commit line

Usage:

```sh
# Just run as usual; grouping triggers automatically when applicable
lazycommit

# Force grouping even for < 5 files
lazycommit --split
```

#### Handling large diffs

For large commits with many files, lazycommit automatically stays within API limits and maintains clean history:

- **Automatic detection**: Large diffs and many-file changes are detected
- **Logical grouping**: Files are grouped into conventional buckets; single huge buckets are auto-split by second-level directory (e.g., `app/api/<group>/...`)
- **Token-safe summaries**: Each group sends a small `--numstat` summary to AI instead of full diffs
- **Sequential commits**: In multi-commit mode, groups are committed one-by-one with their own messages

### Git hook

You can also integrate _lazycommit_ with Git via the [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook. This lets you use Git like you normally would, and edit the commit message before committing.

#### Install

In the Git repository you want to install the hook in:

```sh
lazycommit hook install
```

#### Uninstall

In the Git repository you want to uninstall the hook from:

```sh
lazycommit hook uninstall
```

#### Usage

1. Stage your files and commit:

   ```sh
   git add <files...>
   git commit # Only generates a message when it's not passed in
   ```

   > If you ever want to write your own message instead of generating one, you can simply pass one in: `git commit -m "My message"`

2. Lazycommit will generate the commit message for you and pass it back to Git. Git will open it with the [configured editor](https://docs.github.com/en/get-started/getting-started-with-git/associating-text-editors-with-git) for you to review/edit it.

3. Save and close the editor to commit!

## Configuration

### Reading a configuration value

To retrieve a configuration option, use the command:

```sh
lazycommit config get <key>
```

For example, to retrieve the API key, you can use:

```sh
lazycommit config get GROQ_API_KEY
```

You can also retrieve multiple configuration options at once by separating them with spaces:

```sh
lazycommit config get GROQ_API_KEY generate
```

### Setting a configuration value

To set a configuration option, use the command:

```sh
lazycommit config set <key>=<value>
```

For example, to set the API key, you can use:

```sh
lazycommit config set GROQ_API_KEY=<your-api-key>
```

You can also set multiple configuration options at once by separating them with spaces, like

```sh
lazycommit config set GROQ_API_KEY=<your-api-key> generate=3 locale=en
```

### Options

#### provider

Default: `groq`

The AI provider to use. Options: `groq`, `openai`, `anthropic`

```sh
lazycommit config set provider=openai
```

#### GROQ_API_KEY

Required when using Groq provider

The Groq API key. You can retrieve it from [Groq Console](https://console.groq.com/keys).

#### OPENAI_API_KEY

Required when using OpenAI provider

The OpenAI API key. You can retrieve it from [OpenAI Platform](https://platform.openai.com/api-keys).

```sh
lazycommit config set OPENAI_API_KEY=sk-...
```

#### ANTHROPIC_API_KEY

Required when using Anthropic provider

The Anthropic API key. You can retrieve it from [Anthropic Console](https://console.anthropic.com/settings/keys).

```sh
lazycommit config set ANTHROPIC_API_KEY=sk-ant-...
```

#### locale

Default: `en`

The locale to use for the generated commit messages. Consult the list of codes in: https://wikipedia.org/wiki/List_of_ISO_639-1_codes.

#### generate

Default: `1`

The number of commit messages to generate to pick from.

Note, this will use more tokens as it generates more results.

#### proxy

Set a HTTP/HTTPS proxy to use for requests.

To clear the proxy option, you can use the command (note the empty value after the equals sign):

```sh
lazycommit config set proxy=
```

#### model

Default: `openai/gpt-oss-20b` for Groq, `gpt-4o-mini` for OpenAI, `claude-3-5-sonnet-20241022` for Anthropic

The AI model to use for generating commit messages.

**Groq models:**
- `openai/gpt-oss-20b` (default) - Fast, efficient for conventional commits

**OpenAI models:**
- `gpt-4o-mini` (default) - Fast and cost-effective
- `gpt-4o` - Most capable model
- `gpt-4-turbo` - Turbo version of GPT-4
- `gpt-3.5-turbo` - Legacy model, good balance of speed and quality

**Anthropic models:**
- `claude-3-5-sonnet-20241022` (default) - Best balance of speed and quality
- `claude-3-5-haiku-20241022` - Fastest, most cost-effective
- `claude-3-opus-20240229` - Most capable model for complex tasks

#### timeout

The timeout for network requests to the AI API in milliseconds.

Default: `10000` (10 seconds)

```sh
lazycommit config set timeout=20000 # 20s
```

#### max-length

The maximum character length of the generated commit message.

Default: `50`

```sh
lazycommit config set max-length=100
```

#### type

Default: `""` (Empty string)

The type of commit message to generate. Set this to "conventional" to generate commit messages that follow the Conventional Commits specification:

```sh
lazycommit config set type=conventional
```

You can clear this option by setting it to an empty string:

```sh
lazycommit config set type=
```


## How it works

This CLI tool runs `git diff` to grab all your latest code changes, sends them to your selected AI provider (Groq, OpenAI, or Anthropic), then returns the AI generated commit message.

The tool supports multiple AI providers:
- **Groq**: Fast inference API with open models for quick commit message generation
- **OpenAI**: Access to GPT models for advanced language understanding
- **Anthropic**: Claude models with excellent context understanding and nuanced responses

### Large diff handling

For large commits that exceed API token limits, lazycommit automatically:

1. **Detects large/many-file diffs** and switches to a scalable flow
2. **Groups files** by conventional type/scope; if only one large bucket remains, **auto-splits by second-level directory** (e.g., `app/api/<group>/...`)
3. **Generates messages per group** using compact `git diff --cached --numstat` summaries (not full diffs)
4. **Commits sequentially** per group with clear, conventional messages
5. When a single commit is requested, **uses compact summaries** to generate conventional messages efficiently

This ensures you can commit large changes (like new features, refactoring, or initial project setup) without hitting API limits, while keeping a clean history.

## Troubleshooting

### "Request too large" error (413)

If you get a 413 error, your diff is too large for the API. Try these solutions:

1. **Exclude build artifacts**:
   ```sh
   lazycommit --exclude "dist/**" --exclude "node_modules/**" --exclude ".next/**"
   ```

2. **Use a different model**:
   ```sh
   lazycommit config set model "llama-3.1-70b-versatile"
   ```

3. **Commit in smaller batches**:
   ```sh
   git add src/  # Stage only source files
   lazycommit
   git add docs/ # Then stage documentation
   lazycommit
   ```

### No commit messages generated

- Check your API key: `lazycommit config get GROQ_API_KEY`
- Verify you have staged changes: `git status`
- Try excluding large files or using a different model

### Slow performance with large diffs

- **Use the GPT-OSS-20B model** (default): `lazycommit config set model "openai/gpt-oss-20b"`
- Exclude unnecessary files: `lazycommit --exclude "*.log" --exclude "*.tmp"`
- Use automatic multi-commit mode to split large changes into logical groups
- Lower generate count: `lazycommit config set generate=1` (default)
- Reduce timeout: `lazycommit config set timeout=5000` for faster failures

## Why Multiple Providers?

- **Flexibility**: Choose between Groq's fast inference, OpenAI's advanced GPT models, or Anthropic's Claude models
- **Cost Control**: Select the provider that fits your budget
- **Availability**: Switch providers if one experiences downtime
- **Quality**: Different models excel at different types of commits
- **Cost-effective**: More affordable than traditional AI APIs
- **Open source models**: Uses leading open-source language models
- **Reliable**: High uptime and consistent performance
- **Optimized for commits**: The 8B instant model is perfectly sized for conventional commit generation

## Maintainers

- **Kartik Labhshetwar**: [@KartikLabhshetwar](https://github.com/KartikLabhshetwar)

## Contributing

If you want to help fix a bug or implement a feature in [Issues](https://github.com/KartikLabhshetwar/lazycommit/issues), checkout the [Contribution Guide](CONTRIBUTING.md) to learn how to setup and test the project.

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.
