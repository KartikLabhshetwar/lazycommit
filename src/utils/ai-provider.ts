import type { CommitType, ValidConfig } from './config.js';
import { getApiKey, getModelForProvider } from './config.js';
import {
  generateCommitMessage as generateGroqMessage,
  generateCommitMessageFromChunks as generateGroqChunks,
  generateCommitMessageFromSummary as generateGroqSummary,
  fetchAvailableModels as fetchGroqModels,
} from './groq.js';
import {
  generateCommitMessage as generateOpenRouterMessage,
  generateCommitMessageFromChunks as generateOpenRouterChunks,
  generateCommitMessageFromSummary as generateOpenRouterSummary,
  fetchAvailableModels as fetchOpenRouterModels,
} from './openrouter.js';

export const generateCommitMessage = async (
  config: ValidConfig,
  locale: string,
  diff: string,
  completions: number,
  maxLength: number,
  type: CommitType,
  timeout: number,
  proxy?: string
): Promise<string[]> => {
  const apiKey = getApiKey(config);
  const model = getModelForProvider(config);

  switch (config.provider) {
    case 'groq':
      return generateGroqMessage(apiKey, model, locale, diff, completions, maxLength, type, timeout, proxy);

    case 'openrouter':
      return generateOpenRouterMessage(apiKey, model, locale, diff, completions, maxLength, type, timeout, proxy);

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
};

export const generateCommitMessageFromChunks = async (
  config: ValidConfig,
  locale: string,
  diff: string,
  completions: number,
  maxLength: number,
  type: CommitType,
  timeout: number,
  proxy?: string,
  chunkSize: number = 6000
): Promise<string[]> => {
  const apiKey = getApiKey(config);
  const model = getModelForProvider(config);

  switch (config.provider) {
    case 'groq':
      return generateGroqChunks(apiKey, model, locale, diff, completions, maxLength, type, timeout, proxy, chunkSize);

    case 'openrouter':
      return generateOpenRouterChunks(
        apiKey,
        model,
        locale,
        diff,
        completions,
        maxLength,
        type,
        timeout,
        proxy,
        chunkSize
      );

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
};

export const generateCommitMessageFromSummary = async (
  config: ValidConfig,
  locale: string,
  summary: string,
  completions: number,
  maxLength: number,
  type: CommitType,
  timeout: number,
  proxy?: string
): Promise<string[]> => {
  const apiKey = getApiKey(config);
  const model = getModelForProvider(config);

  switch (config.provider) {
    case 'groq':
      return generateGroqSummary(apiKey, model, locale, summary, completions, maxLength, type, timeout, proxy);

    case 'openrouter':
      return generateOpenRouterSummary(apiKey, model, locale, summary, completions, maxLength, type, timeout, proxy);

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
};

export const fetchAvailableModels = async (
  config: ValidConfig
): Promise<Array<{ value: string; label: string; hint: string }>> => {
  const apiKey = getApiKey(config);

  switch (config.provider) {
    case 'groq':
      return fetchGroqModels(apiKey);

    case 'openrouter':
      return fetchOpenRouterModels(apiKey);

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
};
