import { KnownError } from './error.js';
import type { CommitType } from './config.js';
import { generatePrompt } from './prompt.js';

interface OpenRouterMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface OpenRouterChoice {
	message: {
		content: string;
		role: string;
	};
	finish_reason: string;
	index: number;
}

interface OpenRouterResponse {
	id: string;
	choices: OpenRouterChoice[];
	model: string;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

interface OpenRouterError {
	error: {
		message: string;
		type: string;
		code?: string | number;
	};
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
	proxy?: string
): Promise<{ choices: OpenRouterChoice[] }> => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		if (n > 1) {
			// OpenRouter doesn't support n > 1, so we make multiple requests
			const completions = await Promise.all(
				Array.from({ length: n }, () =>
					makeRequest(apiKey, model, messages, temperature, top_p, frequency_penalty, presence_penalty, max_tokens, timeout, proxy)
				)
			);
			return {
				choices: completions.flatMap(completion => completion.choices),
			};
		}

		return await makeRequest(apiKey, model, messages, temperature, top_p, frequency_penalty, presence_penalty, max_tokens, timeout, proxy);
	} finally {
		clearTimeout(timeoutId);
	}
};

const makeRequest = async (
	apiKey: string,
	model: string,
	messages: OpenRouterMessage[],
	temperature: number,
	top_p: number,
	frequency_penalty: number,
	presence_penalty: number,
	max_tokens: number,
	timeout: number,
	proxy?: string
): Promise<OpenRouterResponse> => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(OPENROUTER_API_URL, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://github.com/lazycommit',
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
			}),
			signal: controller.signal,
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({})) as OpenRouterError;
			let errorMessage = `OpenRouter API Error: ${response.status}`;

			if (errorData.error?.message) {
				errorMessage += ` - ${errorData.error.message}`;
			}

			if (response.status === 401) {
				errorMessage += '\n\nInvalid API key. Get your key from https://openrouter.ai/keys';
			}

			if (response.status === 402) {
				errorMessage += '\n\nInsufficient credits. Add credits at https://openrouter.ai/credits';
			}

			if (response.status === 413 || response.status === 429) {
				errorMessage += '\n\n💡 Tip: Your request is too large or rate limited. Try:\n' +
					'1. Commit files in smaller batches\n' +
					'2. Exclude large files with --exclude\n' +
					'3. Use a different model\n' +
					'4. Check if you have build artifacts staged (dist/, .next/, etc.)';
			}

			if (response.status >= 500) {
				errorMessage += '\n\nOpenRouter server error. Check status at https://openrouter.ai';
			}

			throw new KnownError(errorMessage);
		}

		return await response.json() as OpenRouterResponse;
	} catch (error: any) {
		if (error instanceof KnownError) {
			throw error;
		}

		if (error.name === 'AbortError') {
			throw new KnownError(`Request timed out after ${timeout}ms. Try increasing timeout with: lazycommit config set timeout=20000`);
		}

		if (error.code === 'ENOTFOUND' || error.cause?.code === 'ENOTFOUND') {
			throw new KnownError('Error connecting to OpenRouter. Are you connected to the internet?');
		}

		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
};

const sanitizeMessage = (message: string) =>
	message
		.trim()
		.replace(/^["']|["']\.?$/g, '')
		.replace(/[\n\r]/g, '')
		.replace(/(\w)\.$/, '$1');

const enforceMaxLength = (message: string, maxLength: number): string => {
	if (message.length <= maxLength) return message;

	const cut = message.slice(0, maxLength);

	// Look for sentence endings first (., !, ?)
	const sentenceEnd = Math.max(
		cut.lastIndexOf('. '),
		cut.lastIndexOf('! '),
		cut.lastIndexOf('? ')
	);

	if (sentenceEnd > maxLength * 0.7) {
		return cut.slice(0, sentenceEnd + 1);
	}

	// Look for comma or semicolon as secondary break point
	const clauseEnd = Math.max(
		cut.lastIndexOf(', '),
		cut.lastIndexOf('; ')
	);

	if (clauseEnd > maxLength * 0.6) {
		return cut.slice(0, clauseEnd + 1);
	}

	// Fall back to word boundary
	const lastSpace = cut.lastIndexOf(' ');
	if (lastSpace > maxLength * 0.5) {
		return cut.slice(0, lastSpace);
	}

	// Last resort: hard cut but add ellipsis if it seems incomplete
	if (message.length > maxLength + 10) {
		return cut + '...';
	}

	return cut;
};

const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

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
	const prompt = summary;
	const completion = await createChatCompletion(
		apiKey,
		model,
		[
			{ role: 'system', content: generatePrompt(locale, maxLength, type) },
			{ role: 'user', content: prompt },
		],
		0.3, // Lower temperature for more consistent, focused responses
		1,
		0,
		0,
		Math.max(300, maxLength * 12),
		completions,
		timeout,
		proxy
	);

	const messages = (completion.choices || [])
		.map((c) => c.message?.content || '')
		.map((t) => sanitizeMessage(t))
		.filter(Boolean)
		.map((t) => {
			// Only enforce max length if significantly over limit
			if (t.length > maxLength * 1.1) {
				return enforceMaxLength(t, maxLength);
			}
			return t;
		})
		.filter(msg => msg.length >= 10); // Ensure minimum meaningful length

	return deduplicateMessages(messages);
};
