<div align="center">
  <div>
    <h1 align="center">lazycommit</h1>
<img width="2816" height="1536" alt="lazycommit" src="https://github.com/user-attachments/assets/ee0419ef-2461-4b45-8509-973f3bb0f55c" />

  </div>
	<p>A CLI that writes your git commit messages for you with AI. Supports Groq and OpenRouter. Never write a commit message again.</p>
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

2. Run the interactive configuration (recommended):

   ```sh
   lazycommit config
   ```

   This will guide you through:

   - Choosing your preferred AI provider (Groq or OpenRouter)
   - Selecting your preferred model
   - Setting up your API keys

   **Manual configuration (alternative):**

   Get an API key from one of the supported providers:

   **Option A: Groq (Default)**

   - Retrieve your API key from [Groq Console](https://console.groq.com/keys)
   - Recommended: Set environment variable `export GROQ_API_KEY=<your token>`
   - Alternative: Set in config `lazycommit config set GROQ_API_KEY=<your token>`

   **Option B: OpenRouter**

   - Retrieve your API key from [OpenRouter](https://openrouter.ai/keys)
   - Set the environment variable: `export OPENROUTER_API_KEY=<your token>`
   - Set the provider: `lazycommit config set provider=openrouter`

   This will create a `.lazycommit` file in your home directory.

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

#### Interactive configuration

Run the interactive configuration wizard to choose your provider and model. The setup will dynamically fetch the latest available models from your chosen provider:

```sh
lazycommit config
```

#### Set provider and model via CLI

You can quickly set the AI provider and model using CLI flags. These settings will be saved to your configuration:

```sh
# Switch to OpenRouter with a specific model
lazycommit --provider openrouter --model openai/gpt-4o

# Switch back to Groq
lazycommit --provider groq --model llama-3.1-70b-versatile

# Use short flags
lazycommit -p openrouter -m anthropic/claude-3.5-sonnet
```

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

#### Handling large diffs

For large commits with many files, lazycommit automatically stays within API limits:

- **Automatic detection**: Large diffs are detected
- **Per-file splitting**: Diffs are split by file first
- **Safe chunking**: Each file diff is chunked conservatively (default: 4000 tokens)
- **Combination**: Results are combined into one concise message

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

#### Environment Variables (Recommended)

**GROQ_API_KEY**: Required when using Groq provider (default). Recommended approach for security. Get your key from [Groq Console](https://console.groq.com/keys).

**OPENROUTER_API_KEY**: Required when using OpenRouter provider. Environment variable only (not stored in config file for security). Get your key from [OpenRouter](https://openrouter.ai/keys).

#### GROQ_API_KEY (Legacy Config)

For backward compatibility, you can still set the Groq API key in the config file, but environment variables are recommended:

```sh
lazycommit config set GROQ_API_KEY=<your-key>
```

Note: Environment variable `GROQ_API_KEY` takes precedence over config file setting.

#### provider

Default: `groq`

The AI provider to use. Currently supports:

- `groq` - Uses Groq's fast inference API
- `openrouter` - Uses OpenRouter's multi-model API

```sh
lazycommit config set provider=openrouter
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

The AI model to use. When using the interactive setup (`lazycommit config`), models are dynamically fetched from your provider's API, giving you access to the latest available models with real-time information.

For manual configuration, defaults depend on the provider:

- Groq: `openai/gpt-oss-120b`
- OpenRouter: `openai/gpt-4o-mini`

```sh
# Set a specific model
lazycommit config set model=llama-3.1-70b-versatile

# OpenRouter examples
lazycommit config set model=anthropic/claude-3.5-sonnet
lazycommit config set model=openai/gpt-4o
```

**Note**: The interactive setup provides richer model information including context length, pricing, and filtering by cost directly from the provider APIs.

#### timeout

The timeout for network requests to the AI provider in milliseconds.

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

#### chunk-size

Default: `4000`

The maximum number of tokens per chunk when processing large diffs. This helps avoid API limits and keeps requests fast:

```sh
lazycommit config set chunk-size 4000
```

**Note**: Must be between 1000-8000 tokens (Groq API limit).

## How it works

This CLI tool runs `git diff` to grab all your latest code changes, sends them to your chosen AI provider (Groq or OpenRouter), then returns the AI generated commit message.

The tool supports multiple AI providers:

- **Groq**: Fast inference with open-source models
- **OpenRouter**: Access to multiple providers and models including GPT-4, Claude, and more

### Large diff handling

For large commits that exceed API token limits, lazycommit automatically:

1. **Splits by file** to avoid oversized requests
2. **Chunks each file** into manageable pieces (default: 4000 tokens)
3. **Processes chunks** and combines results into a single message
4. **Falls back gracefully** to a high-level summary if needed

This ensures you can commit large changes (like new features, refactoring, or initial project setup) without hitting API limits.

## Troubleshooting

### "Request too large" error (413)

If you get a 413 error, your diff is too large for the API. Try these solutions:

1. **Exclude build artifacts**:

   ```sh
   lazycommit --exclude "dist/**" --exclude "node_modules/**" --exclude ".next/**"
   ```

2. **Reduce chunk size**:

   ```sh
   lazycommit config set chunk-size 4000
   ```

3. **Use a different model**:

   ```sh
   lazycommit config set model "llama-3.1-70b-versatile"
   ```

4. **Commit in smaller batches**:
   ```sh
   git add src/  # Stage only source files
   lazycommit
   git add docs/ # Then stage documentation
   lazycommit
   ```

### No commit messages generated

- Check your API key: `lazycommit config get GROQ_API_KEY`
- Verify you have staged changes: `git status`
- Try reducing chunk size or excluding large files

### Slow performance with large diffs

- Reduce chunk size: `lazycommit config set chunk-size 4000`
- Exclude unnecessary files: `lazycommit --exclude "*.log" --exclude "*.tmp"`

## Why Groq?

- **Fast**: Groq provides ultra-fast inference speeds
- **Cost-effective**: More affordable than traditional AI APIs
- **Open source models**: Uses leading open-source language models
- **Reliable**: High uptime and consistent performance

## Maintainers

- **Kartik Labhshetwar**: [@KartikLabhshetwar](https://github.com/KartikLabhshetwar)

## Contributing

If you want to help fix a bug or implement a feature in [Issues](https://github.com/KartikLabhshetwar/lazycommit/issues), checkout the [Contribution Guide](CONTRIBUTING.md) to learn how to setup and test the project.

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.
