---
title: Configuration
description: Providers, saved settings, limits, environment variables, proxy, and precedence.
---

## Providers

| Provider | Key | Default model |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `openai/gpt-5.4-mini` |
| Google Gemini | `GOOGLE_API_KEY` | `google/gemini-3.5-flash-lite` |
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/claude-haiku-4-5` |
| Kimi (Moonshot AI) | `MOONSHOT_API_KEY` | `moonshotai/kimi-k2.6` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek/deepseek-flash` |
| GLM (Z.AI) | `ZHIPU_API_KEY` | `zai/glm-5.3-flash` |
| MiniMax | `MINIMAX_API_KEY` | `minimax/MiniMax-M3` |
| Groq | `GROQ_API_KEY` | `groq/openai/gpt-oss-20b` |

Without a `model` setting, lazycommit uses the first provider in this table that has a key, checking the environment first and then `~/.lazycommit`.

To browse the models your keys can use and pick one, run:

```bash
lazycommit model
```

It lists the text models of every provider you have a key for (environment or `~/.lazycommit`), marks the current one, and saves your pick as the `model` setting. With several providers, you choose the provider first. Without a terminal, it prints the models as `provider/model`, one per line. The list comes from Mastra's model registry, so a provider's newest models may be missing; set those with `provider/model` directly.

Models are routed through [Mastra](https://mastra.ai/models), so other Mastra providers also work. Set their key as an environment variable, for example `OPENROUTER_API_KEY`, and pass the model as `provider/model`.

## Config file

Settings are stored in `~/.lazycommit` in INI format. Manage them with the built-in commands instead of editing the file. lazycommit requests owner-only permissions when it writes the file.

## Get and set values

Read one or more values:

```bash
lazycommit config get model type max-length generate
```

Set one or more values in a single command:

```bash
lazycommit config set type=conventional max-length=72 generate=3
lazycommit config set context="Preserve backward compatibility"
```

Values are validated when you set them. `config get` shows saved values with defaults applied. It does not show environment overrides.

## Clear a value

Assign an empty value to clear an optional setting:

```bash
lazycommit config set scope= context= proxy=
```

To return to plain subjects, clear any saved scope too. A scope requires conventional type.

```bash
lazycommit config set type= scope=
```

## Keys

| Key | Default | Limits |
| --- | --- | --- |
| Provider keys | None (one required) | See [Providers](#providers). No whitespace; `GROQ_API_KEY` must start with `gsk_` |
| `model` | First provider with a key | `provider/model`, no whitespace |
| `locale` | `en` | A locale code, for example `ja` or `pt-BR` |
| `generate` | `1` | Integer from 1 to 5 |
| `type` | Empty (plain subjects) | Empty or `conventional` |
| `scope` | Empty | Up to 40 characters: letters, digits, dots, slashes, underscores, hyphens. Requires conventional type |
| `context` | Empty | One line, up to 2,000 characters |
| `max-length` | `100` | Integer from 20 to 200 Unicode characters |
| `max-diff-chars` | `16000` | Integer from 1000 to 100000. Normal mode only |
| `timeout` | `10000` | Integer from 500 to 300000, in milliseconds. Applies per API request |
| `proxy` | None | An HTTP or HTTPS URL |

Each key except the provider keys and `proxy` has a matching CLI flag of the same name, for example `--max-length`. See [Usage](/docs/usage#flags). Workflow switches such as `--thorough`, `--yes`, and `--include-generated` are per-invocation options and cannot be saved.

### model

Without a saved model, lazycommit picks the default model of the first provider that has a key. To choose from a list, run `lazycommit model` (see [Providers](#providers)). To set a model directly, use `provider/model`:

```bash
lazycommit config set model=anthropic/claude-haiku-4-5
lazycommit config set model=groq/openai/gpt-oss-20b
```

Groq model names from earlier versions, such as `openai/gpt-oss-20b` or `llama-3.3-70b-versatile`, still work.

### Provider keys

```bash
lazycommit config set OPENAI_API_KEY="sk-your_key_here"
lazycommit config set GROQ_API_KEY="gsk_your_key_here"
```

## Environment variables

A provider key in the environment overrides the saved key:

```bash
export ANTHROPIC_API_KEY="sk-ant-your_key_here"
```

## Proxy

Save a proxy:

```bash
lazycommit config set proxy=http://localhost:8080
```

HTTP and HTTPS proxy environment variables override the saved proxy. They are checked in this order:

1. `https_proxy`
2. `HTTPS_PROXY`
3. `http_proxy`
4. `HTTP_PROXY`

## Precedence

- Generation flags such as `--generate` and `--type` override saved settings.
- Provider key and proxy environment variables override the saved keys and proxy.
- Saved settings override the defaults in the table above.

The [Git hook](/docs/usage#git-hook) has no flags. It uses saved settings and the same environment overrides.
