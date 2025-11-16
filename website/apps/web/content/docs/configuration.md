---
title: Configuration
description: Configure lazycommit for your workflow.
---

lazycommit is designed to work great out of the box, but it's also highly configurable. Here's how to tailor lazycommit to your workflow.

## Configuration File

lazycommit stores its configuration at `~/.lazycommit` (INI format). You don't need to edit this file manually; use lazycommit's built-in commands instead.

## Reading Configuration Values

To retrieve a configuration option:

```bash
lazycommit config get <key>
```

For example, to retrieve the API key:

```bash
lazycommit config get GROQ_API_KEY
```

You can also retrieve multiple configuration options at once:

```bash
lazycommit config get GROQ_API_KEY generate
```

## Setting Configuration Values

To set a configuration option:

```bash
lazycommit config set <key>=<value>
```

For example, to set the API key:

```bash
lazycommit config set GROQ_API_KEY=<your-api-key>
```

You can also set multiple configuration options at once:

```bash
lazycommit config set GROQ_API_KEY=<your-api-key> generate=3 locale=en
```

## Available Options

### GROQ_API_KEY

**Required**

The Groq API key. You can retrieve it from [Groq Console](https://console.groq.com/keys).

```bash
lazycommit config set GROQ_API_KEY=<your token>
```

### locale

**Default:** `en`

The locale to use for the generated commit messages. Consult the list of codes in: https://wikipedia.org/wiki/List_of_ISO_639-1_codes.

```bash
lazycommit config set locale=ja
```

### generate

**Default:** `1`

The number of commit messages to generate to pick from.

```bash
lazycommit config set generate=3
```

> **Note:** This will use more tokens as it generates more results.

### model

**Default:** `openai/gpt-oss-20b`

The Groq model to use for generating commit messages. Available models include:

- `openai/gpt-oss-20b` (default) - Fast, efficient for conventional commits

For conventional commit generation, the default model provides the best balance of speed and quality.

```bash
lazycommit config set model=llama-3.1-70b-versatile
```

### type

**Default:** `""` (Empty string)

The type of commit message to generate. Set this to `conventional` to generate commit messages that follow the Conventional Commits specification:

```bash
lazycommit config set type=conventional
```

You can clear this option by setting it to an empty string:

```bash
lazycommit config set type=
```

### timeout

**Default:** `10000` (10 seconds)

The timeout for network requests to the Groq API in milliseconds.

```bash
lazycommit config set timeout=20000 # 20s
```

### max-length

**Default:** `100`

The maximum character length of the generated commit message.

```bash
lazycommit config set max-length=150
```

### proxy

Set a HTTP/HTTPS proxy to use for requests.

```bash
lazycommit config set proxy=http://proxy.example.com:8080
```

To clear the proxy option, you can use the command (note the empty value after the equals sign):

```bash
lazycommit config set proxy=
```

## Environment Variables

You can also set configuration via environment variables, which will override the config file:

```bash
export GROQ_API_KEY="your-api-key-here"
export HTTPS_PROXY="http://proxy.example.com:8080"
```

Supported environment variables:
- `GROQ_API_KEY` - Your Groq API key
- `HTTPS_PROXY` / `https_proxy` / `HTTP_PROXY` / `http_proxy` - Proxy URL

## CLI Flags Override Config

Command-line flags always override configuration file values:

```bash
# Config file has generate=1, but this will generate 3 messages
lazycommit --generate 3

# Config file has type=conventional, but this will use default
lazycommit --type ""
```
