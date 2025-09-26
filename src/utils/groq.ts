import { createGroq } from '@ai-sdk/groq';
import { generateText, ToolSet, type GenerateTextResult } from 'ai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { KnownError } from './error.js';
import type { CommitType } from './config.js';
import { generatePrompt } from './prompt.js';

/** Helper to safely access reasoning property if it exists */
function getReasoningFromResult(result: GenerateTextResult<ToolSet, never>): string {
	const resultWithReasoning = result as GenerateTextResult<ToolSet, never> & { reasoning?: string };
	return resultWithReasoning.reasoning || '';
}

const createChatCompletion = async (
	apiKey: string,
	model: string,
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
	temperature: number,
	top_p: number,
	frequency_penalty: number,
	presence_penalty: number,
	max_tokens: number,
	n: number,
	timeout: number,
	proxy?: string
) => {
	// Configure Groq provider with proxy support if provided
	const groqConfig: Parameters<typeof createGroq>[0] = {
		apiKey,
	};

	if (proxy) {
		const proxyAgent = new HttpsProxyAgent(proxy);
		// Use a custom fetch that includes the proxy agent
		// Note: Node.js fetch accepts agent in RequestInit
		groqConfig.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			// Node.js fetch accepts agent in RequestInit, but TypeScript types don't reflect this
			// We need to extend the type to include the agent property
			interface NodeRequestInit extends RequestInit {
				agent?: HttpsProxyAgent<string>;
			}
			const requestInit: NodeRequestInit = {
				...init,
				agent: proxyAgent,
			};
			// Cast is required because TypeScript's fetch type doesn't include agent
			// but Node.js fetch does accept it at runtime
			return fetch(input, requestInit as RequestInit);
		};
	}

	const groq = createGroq(groqConfig);

	try {
		if (n > 1) {
			const completions = await Promise.all(
				Array.from({ length: n }, async () => {
					const result = await generateText({
						model: groq(model),
						messages,
						temperature,
						topP: top_p,
						frequencyPenalty: frequency_penalty,
						presencePenalty: presence_penalty,
						maxOutputTokens: max_tokens,
						abortSignal: AbortSignal.timeout(timeout),
					});
					return {
						choices: [{
							message: {
								content: result.text,
								reasoning: getReasoningFromResult(result),
							}
						}]
					};
				})
			);

			return {
				choices: completions.flatMap(completion => completion.choices),
			};
		}

		const result = await generateText({
			model: groq(model),
			messages,
			temperature,
			topP: top_p,
			frequencyPenalty: frequency_penalty,
			presencePenalty: presence_penalty,
			maxOutputTokens: max_tokens,
			abortSignal: AbortSignal.timeout(timeout),
		});

		return {
			choices: [{
				message: {
					content: result.text,
					reasoning: getReasoningFromResult(result),
				}
			}]
		};
	} catch (error: any) {
		// Handle Vercel AI SDK errors
		if (error.name === 'AI_APICallError' || error.statusCode) {
			let errorMessage = `Groq API Error: ${error.statusCode || 'Unknown'} - ${error.name || 'API Error'}`;

			if (error.message) {
				errorMessage += `\n\n${error.message}`;
			}

			if (error.statusCode === 500) {
				errorMessage += '\n\nCheck the API status: https://console.groq.com/status';
			}

			if (error.statusCode === 413 || error.statusCode === 429 ||
				(error.message && (error.message.includes('rate_limit') || error.message.includes('token limit')))) {
				errorMessage += '\n\n💡 Tip: Your diff is too large. Try:\n' +
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

		if (error.name === 'AbortError') {
			throw new KnownError(`Request timeout after ${timeout}ms. Try increasing the timeout with --timeout`);
		}

		throw error;
	}
};

const sanitizeMessage = (message: string) =>
	message
		.trim()
		.replace(/^["']|["']\.?$/g, '')
		.replace(/[\n\r]/g, '')
		.replace(/(\w)\.$/, '$1');

const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

const conventionalPrefixes = [
    'feat:', 'fix:', 'docs:', 'style:', 'refactor:', 'perf:', 'test:', 'build:', 'ci:', 'chore:', 'revert:'
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
		.map((t) => sanitizeMessage(t))
		.filter(Boolean);

	if (messages.length > 0) return deduplicateMessages(messages);

	// Extract reasoning from messages if available (not part of standard type but may exist)
	const reasons = completion.choices
		.map((c) => {
			const message = c.message as { reasoning?: string };
			return message?.reasoning || '';
		})
		.filter(Boolean) as string[];
	for (const r of reasons) {
		const derived = deriveMessageFromReasoning(r, maxLength);
		if (derived) return [derived];
	}

	return [];
};
