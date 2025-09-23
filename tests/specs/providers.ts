import { testSuite, expect } from 'manten';
import { getConfig } from '../../src/utils/config.js';

export default testSuite(({ test }) => {
	test('provider configuration', async () => {
		// Test default provider (Groq)
		const defaultConfig = await getConfig({}, true);
		expect(defaultConfig.provider).toBe('groq');
		expect(defaultConfig.model).toBeDefined();
	});

	test('OpenAI provider configuration', async () => {
		const openaiConfig = await getConfig({
			provider: 'openai',
			OPENAI_API_KEY: 'sk-test123456789',
		}, true);

		expect(openaiConfig.provider).toBe('openai');
		expect(openaiConfig.OPENAI_API_KEY).toBe('sk-test123456789');
		// Default model for OpenAI
		expect(openaiConfig.model).toBe('gpt-4o-mini');
	});

	test('Anthropic provider configuration', async () => {
		const anthropicConfig = await getConfig({
			provider: 'anthropic',
			ANTHROPIC_API_KEY: 'sk-ant-test123456789',
		}, true);

		expect(anthropicConfig.provider).toBe('anthropic');
		expect(anthropicConfig.ANTHROPIC_API_KEY).toBe('sk-ant-test123456789');
		// Default model for Anthropic
		expect(anthropicConfig.model).toBe('claude-3-5-sonnet-20241022');
	});

	test('provider validation', async () => {
		// Test invalid provider
		try {
			await getConfig({
				provider: 'invalid-provider',
			}, false);
			expect(false).toBe(true); // Should not reach here
		} catch (error: any) {
			expect(error.message).toContain('Must be "groq", "openai", or "anthropic"');
		}
	});

	test('API key validation for providers', async () => {
		// Test missing Groq API key
		try {
			await getConfig({
				provider: 'groq',
			}, false);
			expect(false).toBe(true); // Should not reach here
		} catch (error: any) {
			expect(error.message).toContain('Please set your Groq API key');
		}

		// Test missing OpenAI API key
		try {
			await getConfig({
				provider: 'openai',
			}, false);
			expect(false).toBe(true); // Should not reach here
		} catch (error: any) {
			expect(error.message).toContain('Please set your OpenAI API key');
		}

		// Test missing Anthropic API key
		try {
			await getConfig({
				provider: 'anthropic',
			}, false);
			expect(false).toBe(true); // Should not reach here
		} catch (error: any) {
			expect(error.message).toContain('Please set your Anthropic API key');
		}
	});

	test('API key format validation', async () => {
		// Test invalid Groq key format
		try {
			await getConfig({
				provider: 'groq',
				GROQ_API_KEY: 'invalid-key',
			}, false);
			expect(false).toBe(true);
		} catch (error: any) {
			expect(error.message).toContain('Must start with "gsk_"');
		}

		// Test invalid OpenAI key format
		try {
			await getConfig({
				provider: 'openai',
				OPENAI_API_KEY: 'invalid-key',
			}, false);
			expect(false).toBe(true);
		} catch (error: any) {
			expect(error.message).toContain('Must start with "sk-" or "sk_"');
		}

		// Test invalid Anthropic key format
		try {
			await getConfig({
				provider: 'anthropic',
				ANTHROPIC_API_KEY: 'invalid-key',
			}, false);
			expect(false).toBe(true);
		} catch (error: any) {
			expect(error.message).toContain('Must start with "sk-ant-"');
		}
	});

	test('custom model configuration', async () => {
		// Test custom Groq model
		const groqConfig = await getConfig({
			provider: 'groq',
			GROQ_API_KEY: 'gsk_test123',
			model: 'mixtral-8x7b-32768',
		}, true);
		expect(groqConfig.model).toBe('mixtral-8x7b-32768');

		// Test custom OpenAI model
		const openaiConfig = await getConfig({
			provider: 'openai',
			OPENAI_API_KEY: 'sk-test123',
			model: 'gpt-4o',
		}, true);
		expect(openaiConfig.model).toBe('gpt-4o');

		// Test custom Anthropic model
		const anthropicConfig = await getConfig({
			provider: 'anthropic',
			ANTHROPIC_API_KEY: 'sk-ant-test123',
			model: 'claude-3-opus-20240229',
		}, true);
		expect(anthropicConfig.model).toBe('claude-3-opus-20240229');
	});
});