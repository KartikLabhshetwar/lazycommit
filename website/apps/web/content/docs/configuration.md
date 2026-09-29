---
title: Configuration
description: Saved settings, limits, environment variables, proxy, and precedence.
---

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
| `GROQ_API_KEY` | None (required) | Must start with `gsk_` |
| `model` | `openai/gpt-oss-20b` | No whitespace |
| `locale` | `en` | A locale code, for example `ja` or `pt-BR` |
| `generate` | `1` | Integer from 1 to 5 |
| `type` | Empty (plain subjects) | Empty or `conventional` |
| `scope` | Empty | Up to 40 characters: letters, digits, dots, slashes, underscores, hyphens. Requires conventional type |
| `context` | Empty | One line, up to 2,000 characters |
| `max-length` | `100` | Integer from 20 to 200 Unicode characters |
| `max-diff-chars` | `16000` | Integer from 1000 to 100000. Normal mode only |
| `timeout` | `10000` | Integer from 500 to 300000, in milliseconds. Applies per API request |
| `proxy` | None | An HTTP or HTTPS URL |

Each key except `GROQ_API_KEY` and `proxy` has a matching CLI flag of the same name, for example `--max-length`. See [Usage](/docs/usage#flags). Workflow switches such as `--thorough`, `--yes`, and `--include-generated` are per-invocation options and cannot be saved.

### model

The default is `openai/gpt-oss-20b`. To use another model available to your Groq account:

```bash
lazycommit config set model=your-model-id
```

### GROQ_API_KEY

```bash
lazycommit config set GROQ_API_KEY="gsk_your_key_here"
```

Get a key from the [Groq Console](https://console.groq.com/keys).

## Environment variables

`GROQ_API_KEY` in the environment overrides the saved key:

```bash
export GROQ_API_KEY="gsk_your_key_here"
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
- `GROQ_API_KEY` and the proxy variables override the saved key and proxy.
- Saved settings override the defaults in the table above.

The [Git hook](/docs/usage#git-hook) has no flags. It uses saved settings and the same environment overrides.
