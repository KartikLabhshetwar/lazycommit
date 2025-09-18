import { KnownError } from './error.js';
import type { CommitType } from './config.js';
import { generatePrompt } from './prompt.js';
import { chunkDiff, splitDiffByFile, estimateTokenCount } from './git.js';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterChoice {
  message?: {
    content?: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}

const createChatCompletion = async (
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  temperature: number,
  top_p: number,
  frequency_penalty: number,
  presence_penalty: number,
  max_tokens: number,
  n: number,
  timeout: number,
  _proxy?: string
): Promise<OpenRouterResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/KartikLabhshetwar/lazycommit',
        'X-Title': 'lazycommit',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        n: Math.min(n, 1), // OpenRouter typically handles n=1 best
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenRouter API Error: ${response.status} - ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage += `\n\n${errorData.error.message}`;
        }
      } catch {
        if (errorText) {
          errorMessage += `\n\n${errorText}`;
        }
      }

      if (response.status === 413) {
        errorMessage +=
          '\n\n💡 Tip: Your diff is too large. Try:\n' +
          '1. Commit files in smaller batches\n' +
          '2. Exclude large files with --exclude\n' +
          '3. Use a different model\n' +
          '4. Check if you have build artifacts staged (dist/, .next/, etc.)';
      }

      if (response.status === 401) {
        errorMessage += '\n\n💡 Check your OpenRouter API key: https://openrouter.ai/keys';
      }

      throw new KnownError(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof KnownError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new KnownError(`Request timed out after ${timeout}ms`);
      }

      if (error.message.includes('fetch')) {
        throw new KnownError(`Error connecting to OpenRouter API. Are you connected to the internet?`);
      }
    }

    throw error;
  }
};

const sanitizeMessage = (message: string): string =>
  message
    .trim()
    .replace(/[\n\r]/g, '')
    .replace(/(\w)\.$/, '$1');

const deduplicateMessages = (array: string[]): string[] => Array.from(new Set(array));

export const generateCommitMessage = async (
  apiKey: string,
  model: string,
  locale: string,
  diff: string,
  completions: number,
  maxLength: number,
  type: CommitType,
  timeout: number,
  proxy?: string
): Promise<string[]> => {
  try {
    const completion = await createChatCompletion(
      apiKey,
      model,
      [
        {
          role: 'system',
          content: generatePrompt(locale, maxLength, type),
        },
        {
          role: 'user',
          content: diff,
        },
      ],
      0.7,
      1,
      0,
      0,
      Math.max(200, maxLength * 8),
      completions,
      timeout,
      proxy
    );

    const rawMessages = completion.choices.map((choice) => choice.message?.content || '');

    const messages = rawMessages.map((text) => sanitizeMessage(text)).filter(Boolean);

    if (messages.length > 0) return deduplicateMessages(messages);

    console.log(`OpenRouter: No messages generated, returning empty array`);
    return [];
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new KnownError(`Error connecting to OpenRouter API. Are you connected to the internet?`);
    }

    throw error;
  }
};

export const generateCommitMessageFromChunks = async (
  apiKey: string,
  model: string,
  locale: string,
  diff: string,
  completions: number,
  maxLength: number,
  type: CommitType,
  timeout: number,
  proxy?: string,
  chunkSize: number = 6000
): Promise<string[]> => {
  // Strategy: split by file first to avoid crossing file boundaries
  const fileDiffs = splitDiffByFile(diff);
  const perFileChunks = fileDiffs.flatMap((fd) => chunkDiff(fd, chunkSize));
  const chunks = perFileChunks.length > 0 ? perFileChunks : chunkDiff(diff, chunkSize);

  if (chunks.length === 1) {
    try {
      return await generateCommitMessage(apiKey, model, locale, diff, completions, maxLength, type, timeout, proxy);
    } catch (error) {
      throw new KnownError(
        `Failed to generate commit message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Multiple chunks - generate commit messages for each chunk
  const chunkMessages: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const approxInputTokens = estimateTokenCount(chunk) + 1200; // reserve for prompt/system
    let effectiveMaxTokens = Math.max(200, maxLength * 8);
    // If close to model limit, reduce output tokens
    if (approxInputTokens + effectiveMaxTokens > 7500) {
      effectiveMaxTokens = Math.max(200, 7500 - approxInputTokens);
    }

    const chunkPrompt = `Analyze this git diff and propose a concise commit message limited to ${maxLength} characters. Focus on the most significant intent of the change.\n\n${chunk}`;

    try {
      const messages = await createChatCompletion(
        apiKey,
        model,
        [
          { role: 'system', content: generatePrompt(locale, maxLength, type) },
          { role: 'user', content: chunkPrompt },
        ],
        0.7,
        1,
        0,
        0,
        effectiveMaxTokens,
        1,
        timeout,
        proxy
      );

      const texts = (messages.choices || []).map((c) => c.message?.content).filter(Boolean) as string[];
      if (texts.length > 0) {
        chunkMessages.push(sanitizeMessage(texts[0]));
      }
    } catch (error) {
      console.warn(`Failed to process chunk ${i + 1}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  if (chunkMessages.length === 0) {
    // Fallback: summarize per-file names only to craft a high-level message
    const fileNames = splitDiffByFile(diff)
      .map((block) => {
        const first = block.split('\n', 1)[0] || '';
        const parts = first.split(' ');
        return parts[2]?.replace('a/', '') || '';
      })
      .filter(Boolean)
      .slice(0, 15);

    const fallbackPrompt = `Generate a single, concise commit message (<= ${maxLength} chars) summarizing changes across these files:\n${fileNames
      .map((f) => `- ${f}`)
      .join('\n')}`;

    try {
      const completion = await createChatCompletion(
        apiKey,
        model,
        [
          { role: 'system', content: generatePrompt(locale, maxLength, type) },
          { role: 'user', content: fallbackPrompt },
        ],
        0.7,
        1,
        0,
        0,
        Math.max(200, maxLength * 8),
        1,
        timeout,
        proxy
      );
      const texts = (completion.choices || []).map((c) => c.message?.content).filter(Boolean) as string[];
      if (texts.length > 0) return [sanitizeMessage(texts[0])];
    } catch {
      // Ignore fallback errors
    }

    throw new KnownError('Failed to generate commit messages for any chunks');
  }

  // If we have multiple chunk messages, try to combine them intelligently
  if (chunkMessages.length > 1) {
    const combinedPrompt = `I have ${chunkMessages.length} commit messages for different parts of a large change:

${chunkMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}

Please generate a single, comprehensive commit message that captures the overall changes.
The message should be concise but cover the main aspects of all the changes.`;

    try {
      const combinedMessages = await generateCommitMessage(
        apiKey,
        model,
        locale,
        combinedPrompt,
        completions,
        maxLength,
        type,
        timeout,
        proxy
      );

      return combinedMessages;
    } catch (error) {
      // If combining fails, return the individual chunk messages
      return chunkMessages;
    }
  }

  return chunkMessages;
};

export const generateCommitMessageFromSummary = async (
  apiKey: string,
  model: string,
  locale: string,
  summary: string,
  completions: number,
  maxLength: number,
  type: CommitType,
  timeout: number,
  proxy?: string
): Promise<string[]> => {
  const prompt = `This is a compact summary of staged changes. Generate a single, concise commit message within ${maxLength} characters that reflects the overall intent.\n\n${summary}`;
  const completion = await createChatCompletion(
    apiKey,
    model,
    [
      { role: 'system', content: generatePrompt(locale, maxLength, type) },
      { role: 'user', content: prompt },
    ],
    0.7,
    1,
    0,
    0,
    Math.max(200, maxLength * 8),
    completions,
    timeout,
    proxy
  );

  const messages = (completion.choices || [])
    .map((c) => c.message?.content || '')
    .map((t) => sanitizeMessage(t))
    .filter(Boolean);

  if (messages.length > 0) return deduplicateMessages(messages);

  return [];
};

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
  // Additional fields that might be available from the API
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: any;
  // Add other potential popularity indicators
  created?: number; // timestamp when model was added
  // Note: OpenRouter doesn't seem to provide explicit popularity metrics
  // in their public API, so we'll rely on intelligent defaults
}

const getPricingHint = (pricing?: { prompt: string; completion: string }): string => {
  if (!pricing) return 'Paid';

  const promptCost = parseFloat(pricing.prompt);
  const completionCost = parseFloat(pricing.completion);

  // Consider it free if both costs are 0
  if (promptCost === 0 && completionCost === 0) {
    return 'Free';
  }

  return 'Paid';
};

export const fetchAvailableModels = async (
  apiKey: string
): Promise<Array<{ value: string; label: string; hint: string }>> => {
  // Validate API key format
  if (!apiKey) {
    throw new KnownError(
      `OpenRouter API key is missing. Set the OPENROUTER_API_KEY environment variable. Get a key from: https://openrouter.ai/keys`
    );
  }

  if (!apiKey.startsWith('sk-or-')) {
    throw new KnownError(
      `Invalid OpenRouter API key format. Keys should start with 'sk-or-'. Get a key from: https://openrouter.ai/keys`
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    console.log(`Fetching OpenRouter models with API key: ${apiKey.substring(0, 10)}...`);

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/KartikLabhshetwar/lazycommit',
        'X-Title': 'lazycommit',
      },
      signal: controller.signal,
    });

    console.log(`OpenRouter API response status: ${response.status}`);

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API Error ${response.status}:`, errorText);

      // Provide helpful error messages for common issues
      if (response.status === 401) {
        throw new KnownError(
          `OpenRouter API key is invalid or missing. Please check your OPENROUTER_API_KEY environment variable. Get a key from: https://openrouter.ai/keys`
        );
      } else if (response.status === 403) {
        throw new KnownError(`OpenRouter API access forbidden. Your API key may not have permission to access models.`);
      } else if (response.status === 429) {
        throw new KnownError(`OpenRouter API rate limit exceeded. Please try again later.`);
      } else {
        throw new KnownError(
          `Failed to fetch OpenRouter models: ${response.status} - ${response.statusText}. Check your internet connection and API key.`
        );
      }
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];

    console.log(`Successfully fetched ${models.length} models from OpenRouter`);

    const sortedModels = models
      .filter((model) => model.id && model.name)
      .sort((a, b) => {
        // Primary sort: alphabetical by model name (ascending)
        return a.name.localeCompare(b.name);
      });
    // No limit - show all models, sorted alphabetically

    return sortedModels.map((model) => ({
      value: model.id,
      label: `${model.id} (${getPricingHint(model.pricing)})`,
      hint: getPricingHint(model.pricing),
    }));
  } catch (error) {
    clearTimeout(timeoutId);
    throw new KnownError(
      `Failed to fetch OpenRouter models: ${
        error instanceof Error ? error.message : 'Unknown error'
      }. Please check your internet connection and API key.`
    );
  }
};
