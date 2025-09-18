import Groq from 'groq-sdk';
import { KnownError } from './error.js';
import type { CommitType } from './config.js';
import { generatePrompt } from './prompt.js';
import { chunkDiff, splitDiffByFile, estimateTokenCount } from './git.js';

const createChatCompletion = async (
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  top_p: number,
  frequency_penalty: number,
  presence_penalty: number,
  max_tokens: number,
  n: number,
  timeout: number,
  proxy?: string
) => {
  const client = new Groq({
    apiKey,
    timeout,
  });

  try {
    if (n > 1) {
      const completions = await Promise.all(
        Array.from({ length: n }, () =>
          client.chat.completions.create({
            model,
            messages: messages as any,
            temperature,
            top_p,
            frequency_penalty,
            presence_penalty,
            max_tokens,
            n: 1,
          })
        )
      );

      return {
        choices: completions.flatMap((completion) => completion.choices),
      };
    }

    const completion = await client.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
      top_p,
      frequency_penalty,
      presence_penalty,
      max_tokens,
      n: 1,
    });

    return completion;
  } catch (error: any) {
    if (error instanceof Groq.APIError) {
      let errorMessage = `Groq API Error: ${error.status} - ${error.name}`;

      if (error.message) {
        errorMessage += `\n\n${error.message}`;
      }

      if (error.status === 500) {
        errorMessage += '\n\nCheck the API status: https://console.groq.com/status';
      }

      if (error.status === 413 || (error.message && error.message.includes('rate_limit_exceeded'))) {
        errorMessage +=
          '\n\n💡 Tip: Your diff is too large. Try:\n' +
          '1. Commit files in smaller batches\n' +
          '2. Exclude large files with --exclude\n' +
          '3. Use a different model with --model\n' +
          '4. Check if you have build artifacts staged (dist/, .next/, etc.)';
      }

      throw new KnownError(errorMessage);
    }

    if (error.code === 'ENOTFOUND') {
      throw new KnownError(
        `Error connecting to ${error.hostname} (${error.syscall}). Are you connected to the internet?`
      );
    }

    throw error;
  }
};

const sanitizeMessage = (message: string) => message.trim().replace(/(\w)\.$/, '$1');

const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

const conventionalPrefixes = [
  'feat:',
  'fix:',
  'docs:',
  'style:',
  'refactor:',
  'perf:',
  'test:',
  'build:',
  'ci:',
  'chore:',
  'revert:',
];

const deriveMessageFromReasoning = (text: string, maxLength: number): string | null => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  // Try to find a conventional-style line inside reasoning
  const match = cleaned.match(/\b(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\b\s*:?\s+[^.\n]+/i);
  let candidate = match ? match[0] : cleaned.split(/[.!?]/)[0];
  // Ensure prefix formatting: if starts with a known type w/o colon, add colon
  const lower = candidate.toLowerCase();
  for (const prefix of conventionalPrefixes) {
    const p = prefix.slice(0, -1); // without colon
    if (lower.startsWith(p + ' ') && !lower.startsWith(prefix)) {
      candidate = p + ': ' + candidate.slice(p.length + 1);
      break;
    }
  }
  candidate = sanitizeMessage(candidate);
  if (!candidate) return null;
  if (candidate.length > maxLength) candidate = candidate.slice(0, maxLength);
  return candidate;
};

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
) => {
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

    const messages = rawMessages.map((text) => sanitizeMessage(text as string)).filter(Boolean);

    if (messages.length > 0) return deduplicateMessages(messages);

    // Fallback: some Groq models return reasoning with an empty content
    const reasoningCandidates = (completion.choices as any[])
      .map((c) => (c as any).message?.reasoning || '')
      .filter(Boolean) as string[];

    console.log(`Groq reasoning candidates:`, reasoningCandidates);

    for (const reason of reasoningCandidates) {
      const derived = deriveMessageFromReasoning(reason, maxLength);
      if (derived) {
        console.log(`Groq derived message from reasoning:`, derived);
        return [derived];
      }
    }

    console.log(`Groq: No messages generated, returning empty array`);
    return [];
  } catch (error) {
    const errorAsAny = error as any;
    if (errorAsAny.code === 'ENOTFOUND') {
      throw new KnownError(
        `Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall}). Are you connected to the internet?`
      );
    }

    throw errorAsAny;
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
) => {
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
      } else {
        const reasons = (messages.choices as any[])
          .map((c: any) => c.message?.reasoning || '')
          .filter(Boolean) as string[];
        if (reasons.length > 0) {
          const derived = deriveMessageFromReasoning(reasons[0], maxLength);
          if (derived) chunkMessages.push(derived);
        }
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
    } catch {}

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
) => {
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
    .map((t) => sanitizeMessage(t as string))
    .filter(Boolean);

  if (messages.length > 0) return deduplicateMessages(messages);

  const reasons = (completion.choices as any[]).map((c: any) => c.message?.reasoning || '').filter(Boolean) as string[];
  for (const r of reasons) {
    const derived = deriveMessageFromReasoning(r, maxLength);
    if (derived) return [derived];
  }

  return [];
};

interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export const fetchAvailableModels = async (
  apiKey: string
): Promise<Array<{ value: string; label: string; hint: string }>> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    const models: GroqModel[] = data.data || [];

    const sortedModels = models
      .filter((model) => model.id)
      .sort((a, b) => {
        // Primary sort: alphabetical by model ID (ascending)
        return a.id.localeCompare(b.id);
      });
    // No limit - show all models, sorted alphabetically

    return sortedModels.map((model) => ({
      value: model.id,
      label: `${model.id} (Paid)`,
      hint: 'Paid',
    }));
  } catch (error) {
    clearTimeout(timeoutId);
    throw new KnownError(
      `Failed to fetch Groq models: ${
        error instanceof Error ? error.message : 'Unknown error'
      }. Please check your internet connection and API key.`
    );
  }
};
