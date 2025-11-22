<div align="center">
  <div>
    <h1 align="center">lazycommit</h1>
<img width="2816" height="1536" alt="lazycommit" src="https://github.com/user-attachments/assets/ee0419ef-2461-4b45-8509-973f3bb0f55c" />

  </div>
	<p>A CLI that writes your git commit messages for you with AI using Groq. Never write a commit message again.</p>
	<a href="https://www.npmjs.com/package/lazycommitz"><img src="https://img.shields.io/npm/v/lazycommitt" alt="Current version"></a>
	<a href="https://github.com/KartikLabhshetwar/lazycommit"><img src="https://img.shields.io/github/stars/KartikLabhshetwar/lazycommit" alt="GitHub stars"></a>
	<a href="https://github.com/KartikLabhshetwar/lazycommit/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/lazycommitt" alt="License"></a>
</div>

---

<div align="center">
  <a href="https://peerlist.io/code_kartik/project/lazycommit" ><img width="400" height="128" alt="LazyCommit" src="https://github.com/user-attachments/assets/5d54d238-38f4-44f2-b253-3959b2487987" /></a>
</div>



## Setup

> The minimum supported version of Node.js is v18. Check your Node.js version with `node --version`.

1. Install _lazycommit_:

   ```sh
   npm install -g lazycommitt
   ```

### Install via Homebrew (macOS)

Install via Homebrew tap:

```sh
brew tap KartikLabhshetwar/lazycommit https://github.com/KartikLabhshetwar/lazycommit
brew install lazycommit
```

Upgrade:

```sh
brew update
brew upgrade lazycommit
```

2. Retrieve your API key from [Groq Console](https://console.groq.com/keys)

   > Note: If you haven't already, you'll have to create an account and get your API key.

3. Set the key so lazycommit can use it:

   ```sh
   lazycommit config set GROQ_API_KEY=<your token>
   ```

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

#### Review, edit, and confirm messages

Lazycommit now lets you review the generated message, optionally edit it, and then confirm before it is committed.

- You'll see a menu: Use as-is, Edit, or Cancel
- If you choose Use as-is, it commits immediately without additional prompts
- If you choose Edit, you can modify the message; then you'll be asked to confirm the final message before committing

Example (single commit):

```sh
git add .
lazycommit
# Review generated commit message:
#   feat: add lazycommit command
# → Choose "Use as-is" to commit immediately
# → Or choose "Edit" to modify, then confirm the final message before commit
```

#### Exclude files from analysis

You can exclude specific files from AI analysis using the `--exclude` flag:

```sh
lazycommit --exclude package-lock.json --exclude dist/
```

#### Handling large diffs

For large commits with many files, lazycommit automatically stays within API limits and generates relevant commit messages:

- **Smart summarization**: Uses `git diff --cached --numstat` to create compact summaries of all changes
- **Context snippets**: Includes truncated diff snippets from top changed files for better context
- **Token-safe processing**: Keeps prompts small while maintaining accuracy for 20+ file changes
- **Single commit**: Always generates one commit message, no matter how many files are staged
- **Enhanced analysis**: Uses improved prompts and smart truncation for better commit message quality

### Git hook

You can also integrate _lazycommit_ with Git via the [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook. This lets you use Git like you normally would, and edit the commit message before committing. The hook uses the same enhanced analysis and quality improvements as the CLI mode.

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

2. Lazycommit will generate a high-quality commit message using the same enhanced analysis as the CLI mode and pass it back to Git. Git will open it with the [configured editor](https://docs.github.com/en/get-started/getting-started-with-git/associating-text-editors-with-git) for you to review/edit it.

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

#### GROQ_API_KEY

Required

The Groq API key. You can retrieve it from [Groq Console](https://console.groq.com/keys).

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

Default: `openai/gpt-oss-20b`

The Groq model to use for generating commit messages. Available models include:
- `openai/gpt-oss-20b` (default) - Fast, efficient for conventional commits

For conventional commit generation, the 8B instant model provides the best balance of speed and quality.

#### timeout

The timeout for network requests to the Groq API in milliseconds.

Default: `10000` (10 seconds)

```sh
lazycommit config set timeout=20000 # 20s
```

#### max-length

The maximum character length of the generated commit message.

Default: `100`

```sh
lazycommit config set max-length=150
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

This CLI tool runs `git diff` to grab all your latest code changes, sends them to Groq's AI models, then returns the AI generated commit message.

The tool uses Groq's fast inference API to provide quick and accurate commit message suggestions based on your code changes.

### Large diff handling

For large commits that exceed API token limits, lazycommit automatically:

1. **Detects large/many-file diffs** and switches to enhanced analysis mode
2. **Creates compact summaries** using `git diff --cached --numstat` to capture all changes efficiently
3. **Includes context snippets** from the most changed files to provide semantic context
4. **Generates a single commit message** that accurately reflects all changes without hitting API limits
5. **Smart truncation** preserves sentence structure and meaning when messages approach length limits
6. **Enhanced prompts** provide better context for AI to generate complete, professional commit messages

This ensures you can commit large changes (like new features, refactoring, or initial project setup) without hitting API limits, while maintaining accuracy, relevance, and high-quality commit messages.

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
- Use the built-in large diff handling for better context and accuracy
- Lower generate count: `lazycommit config set generate=1` (default)
- Reduce timeout: `lazycommit config set timeout=5000` for faster failures

## Why Groq?

- **Fast**: Groq provides ultra-fast inference speeds, especially with the 8B instant model
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
