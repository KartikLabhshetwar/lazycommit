import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { KnownError } from './error.js';
import type { CommitType, ValidConfig } from './config.js';
import { generatePrompt } from './prompt.js';

const sanitizeMessage = (message: string) =>
	message
		.trim()
		.replace(/^["']|["']\.?$/g, '')
		.replace(/[\n\r]/g, '')
		.replace(/(\w)\.$/, '$1');

const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

const createChatCompletion = async (
	config: ValidConfig,
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
	temperature: number,
	top_p: number,
	frequency_penalty: number,
	presence_penalty: number,
	max_tokens: number,
	n: number
) => {
	const provider = config.provider || 'groq';
	const model = config.model;
	const timeout = config.timeout;
	const proxy = config.proxy;

	// Create the appropriate AI provider
	let aiProvider;
	let modelInstance;

	if (provider === 'anthropic') {
		const anthropicConfig: Parameters<typeof createAnthropic>[0] = {
			apiKey: config.ANTHROPIC_API_KEY!,
		};

		if (proxy) {
			const proxyAgent = new HttpsProxyAgent(proxy);
			anthropicConfig.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				interface NodeRequestInit extends RequestInit {
					agent?: HttpsProxyAgent<string>;
				}
				const requestInit: NodeRequestInit = {
					...init,
					agent: proxyAgent,
				};
				return fetch(input, requestInit as RequestInit);
			};
		}

		aiProvider = createAnthropic(anthropicConfig);
		modelInstance = aiProvider(model!);
	} else if (provider === 'openai') {
		const openaiConfig: Parameters<typeof createOpenAI>[0] = {
			apiKey: config.OPENAI_API_KEY!,
		};

		if (proxy) {
			const proxyAgent = new HttpsProxyAgent(proxy);
			openaiConfig.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				interface NodeRequestInit extends RequestInit {
					agent?: HttpsProxyAgent<string>;
				}
				const requestInit: NodeRequestInit = {
					...init,
					agent: proxyAgent,
				};
				return fetch(input, requestInit as RequestInit);
			};
		}

		aiProvider = createOpenAI(openaiConfig);
		modelInstance = aiProvider(model!);
	} else {
		// Default to Groq
		const groqConfig: Parameters<typeof createGroq>[0] = {
			apiKey: config.GROQ_API_KEY!,
		};

		if (proxy) {
			const proxyAgent = new HttpsProxyAgent(proxy);
			groqConfig.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				interface NodeRequestInit extends RequestInit {
					agent?: HttpsProxyAgent<string>;
				}
				const requestInit: NodeRequestInit = {
					...init,
					agent: proxyAgent,
				};
				return fetch(input, requestInit as RequestInit);
			};
		}

		aiProvider = createGroq(groqConfig);
		modelInstance = aiProvider(model!);
	}

	try {
		if (n > 1) {
			const completions = await Promise.all(
				Array.from({ length: n }, () =>
					generateText({
						model: modelInstance,
						messages,
						temperature,
						topP: top_p,
						frequencyPenalty: frequency_penalty,
						presencePenalty: presence_penalty,
						maxOutputTokens: max_tokens,
						abortSignal: AbortSignal.timeout(timeout),
					})
				)
			);

			return {
				choices: completions.map(completion => ({
					message: {
						content: completion.text,
					},
				})),
			};
		} else {
			const completion = await generateText({
				model: modelInstance,
				messages,
				temperature,
				topP: top_p,
				frequencyPenalty: frequency_penalty,
				presencePenalty: presence_penalty,
				maxOutputTokens: max_tokens,
				abortSignal: AbortSignal.timeout(timeout),
			});

			return {
				choices: [
					{
						message: {
							content: completion.text,
						},
					},
				],
			};
		}
	} catch (error: any) {
		const errorAsAny = error as any;
		if (errorAsAny.code === 'ENOTFOUND') {
			const providerName = provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Groq';
			throw new KnownError(
				`Error connecting to ${providerName} API.\nCause: ${errorAsAny.message}\n\nPossible reasons:\n- Check your internet connection\n- If you're behind a VPN, proxy or firewall, make sure it's configured correctly`
			);
		}

		if (errorAsAny.code === 'ECONNREFUSED') {
			const providerName = provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Groq';
			throw new KnownError(
				`Error connecting to ${providerName} API.\nCause: ${errorAsAny.message}\n\nPossible reasons:\n- Check your proxy settings\n- Ensure proxy server is running and accessible\n- Verify proxy URL is correct in your config`
			);
		}

		throw errorAsAny;
	}
};

export const generateCommitMessage = async (
	config: ValidConfig,
	diff: string,
	completions: number,
	maxLength: number,
	type?: CommitType
): Promise<string[]> => {
	try {
		const completion = await createChatCompletion(
			config,
			[
				{
					role: 'system',
					content: generatePrompt(config.locale, maxLength, type || ''),
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
			196,
			completions
		);

		const messages = completion.choices
			.map((choice) => choice.message?.content || '')
			.map(sanitizeMessage)
			.filter(Boolean);

		return deduplicateMessages(messages);
	} catch (error) {
		const errorAsAny = error as any;
		if (errorAsAny.name === 'AbortError' || errorAsAny.code === 'UND_ERR_ABORTED') {
			throw new KnownError('Request timed out. Try increasing the timeout in your config (`lazycommit config set timeout=<timeout in ms>`)');
		}

		throw errorAsAny;
	}
};

export const generateCommitMessageFromSummary = async (
	config: ValidConfig,
	prompt: string,
	completions: number,
	maxLength: number,
	type?: CommitType
): Promise<string[]> => {
	try {
		const completion = await createChatCompletion(
			config,
			[
				{
					role: 'system',
					content: generatePrompt(config.locale, maxLength, type || ''),
				},
				{
					role: 'user',
					content: prompt,
				},
			],
			0.7,
			1,
			0,
			0,
			196,
			completions
		);

		const messages = completion.choices
			.map((choice) => choice.message?.content || '')
			.map(sanitizeMessage)
			.filter(Boolean);

		return deduplicateMessages(messages);
	} catch (error) {
		const errorAsAny = error as any;
		if (errorAsAny.name === 'AbortError' || errorAsAny.code === 'UND_ERR_ABORTED') {
			throw new KnownError('Request timed out. Try increasing the timeout in your config (`lazycommit config set timeout=<timeout in ms>`)');
		}

		throw errorAsAny;
	}
};