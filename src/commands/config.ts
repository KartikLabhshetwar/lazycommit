import { command } from 'cleye';
import { red } from 'kolorist';
import { hasOwn, getConfig, setConfigs } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { intro, outro, select, confirm, isCancel, log, note } from '@clack/prompts';
import { fetchAvailableModels } from '../utils/ai-provider.js';

async function selectModelWithFiltering(
  allModels: Array<{ value: string; label: string; hint: string }>,
  provider: 'groq' | 'openrouter',
  initialValue?: string
) {
  const hasMixedPricing = allModels.some((m) => m.hint === 'Free') && allModels.some((m) => m.hint === 'Paid');

  let filteredModels: Array<{ value: string; label: string; hint: string }>;

  if (hasMixedPricing) {
    // Step 1: Choose filter mode when there are mixed pricing tiers
    const filterOptions = [
      {
        value: 'all',
        label: `🔄 Show All Models (${allModels.length})`,
        hint: 'Browse complete model catalog',
      },
      {
        value: 'free',
        label: `🆓 Show Free Models (${allModels.filter((m) => m.hint === 'Free').length})`,
        hint: 'Only show free models',
      },
      {
        value: 'paid',
        label: `💰 Show Paid Models (${allModels.filter((m) => m.hint === 'Paid').length})`,
        hint: 'Only show paid models',
      },
    ];

    const filterResult = await select({
      message: `Choose model filter for ${provider === 'groq' ? 'Groq' : 'OpenRouter'}:`,
      options: filterOptions,
      initialValue: 'all',
    });

    if (isCancel(filterResult)) {
      return filterResult;
    }

    // Step 2: Filter models based on selection
    switch (filterResult) {
      case 'free':
        filteredModels = allModels.filter((model) => model.hint === 'Free');
        if (filteredModels.length === 0) {
          log.warn('No free models available, showing all models instead');
          filteredModels = allModels;
        }
        break;
      case 'paid':
        filteredModels = allModels.filter((model) => model.hint === 'Paid');
        if (filteredModels.length === 0) {
          log.warn('No paid models available, showing all models instead');
          filteredModels = allModels;
        }
        break;
      default:
        filteredModels = allModels;
    }
  } else {
    // Skip filter selection when all models are the same price class
    filteredModels = allModels;
  }

  // Step 3: Select the actual model from filtered list
  const modelResult = await select({
    message: `Select your preferred model (${filteredModels.length} available):`,
    options: filteredModels,
    initialValue: initialValue || filteredModels[0]?.value,
  });

  return modelResult;
}

export default command(
  {
    name: 'config',
    description: 'Manage lazycommit configuration settings',

    parameters: ['[mode]', '[key=value...]'],

    help: {
      description: 'Manage lazycommit configuration settings',
      examples: [
        'lazycommit config                    # Launch interactive setup wizard',
        'lazycommit config get model         # Get current model setting',
        'lazycommit config get provider timeout # Get multiple settings',
        'lazycommit config set model=gpt-4o-mini # Set model',
        'lazycommit config set provider=openrouter timeout=15000 # Set multiple values',
      ],
    },
  },
  (argv) => {
    (async () => {
      const { mode, keyValue: keyValues } = argv._;

      // If no mode is provided, launch the setup wizard
      if (!mode) {
        console.clear();
        intro('🚀 Welcome to lazycommit!');

        try {
          // Check current configuration
          const currentConfig = await getConfig();

          // Check if already configured
          const hasGroqKey = !!(process.env.GROQ_API_KEY || currentConfig.GROQ_API_KEY);
          const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
          const hasAnyKey = hasGroqKey || hasOpenRouterKey;

          if (hasAnyKey && currentConfig.provider) {
            const continueSetup = await confirm({
              message: 'lazycommit is already configured. Would you like to update your settings?',
              initialValue: false,
            });

            if (!continueSetup || isCancel(continueSetup)) {
              outro('Setup cancelled.');
              return;
            }
          }

          // Provider selection
          const providerResult = await select({
            message: 'Which AI provider would you like to use?',
            options: [
              {
                value: 'groq',
                label: 'Groq',
                hint: 'Fast inference with open-source models',
              },
              {
                value: 'openrouter',
                label: 'OpenRouter',
                hint: 'Access to multiple providers and models',
              },
            ],
            initialValue: currentConfig.provider || 'groq',
          });

          if (isCancel(providerResult)) {
            outro('Setup cancelled.');
            return;
          }

          const selectedProvider = providerResult as 'groq' | 'openrouter';

          // Create a temporary config for fetching models
          const tempConfig = {
            provider: selectedProvider,
            locale: 'en',
            generate: 1,
            type: '' as const,
            proxy: undefined,
            model: '',
            timeout: 10000,
            'max-length': 50,
            'chunk-size': 4000,
            GROQ_API_KEY:
              selectedProvider === 'groq' ? process.env.GROQ_API_KEY || currentConfig.GROQ_API_KEY : undefined,
          };

          // Fetch available models dynamically
          log.step(`Fetching available models from ${selectedProvider === 'groq' ? 'Groq' : 'OpenRouter'}...`);
          const availableModels = await fetchAvailableModels(tempConfig);

          // Model selection with filtering
          const modelResult = await selectModelWithFiltering(
            availableModels,
            selectedProvider,
            currentConfig.model || availableModels[0]?.value
          );

          if (isCancel(modelResult)) {
            outro('Setup cancelled.');
            return;
          }

          const selectedModel = modelResult as string;

          // Update configuration
          const updates: [string, string][] = [
            ['provider', selectedProvider],
            ['model', selectedModel],
          ];

          await setConfigs(updates);

          // Check if API key is configured and show instructions only if missing
          const hasApiKey =
            selectedProvider === 'groq'
              ? !!(process.env.GROQ_API_KEY || currentConfig.GROQ_API_KEY)
              : !!process.env.OPENROUTER_API_KEY;

          if (!hasApiKey) {
            // Show API key setup instructions only when key is missing
            const providerInfo = {
              groq: {
                name: 'Groq',
                apiKeyInstructions: `To complete setup, set your Groq API key:

1. Get your API key from: https://console.groq.com/keys
2. Set the environment variable:
   export GROQ_API_KEY=your_api_key_here

3. Or set it in config (less secure):
   lazycommit config set GROQ_API_KEY=your_api_key_here`,
              },
              openrouter: {
                name: 'OpenRouter',
                apiKeyInstructions: `To complete setup, set your OpenRouter API key:

1. Get your API key from: https://openrouter.ai/keys
2. Set the environment variable:
   export OPENROUTER_API_KEY=your_api_key_here

Note: OpenRouter keys are environment-only for security.`,
              },
            }[selectedProvider];

            log.step(`Selected: ${providerInfo.name} provider`);
            note(providerInfo.apiKeyInstructions, `🔑 ${providerInfo.name} API Key Required`);
            log.warn('⚠️  API key not found. Set it using the instructions above.');
          } else {
            log.step(`Selected: ${selectedProvider === 'groq' ? 'Groq' : 'OpenRouter'} provider`);
          }

          outro('✅ Configuration updated successfully!');
        } catch (error) {
          outro('❌ Setup failed.');
          throw error;
        }
        return;
      }

      if (mode === 'get') {
        const config = await getConfig({}, true);
        for (const key of keyValues) {
          if (hasOwn(config, key)) {
            console.log(`${key}=${config[key as keyof typeof config]}`);
          }
        }
        return;
      }

      if (mode === 'set') {
        await setConfigs(keyValues.map((keyValue) => keyValue.split('=') as [string, string]));
        return;
      }

      throw new KnownError(`Invalid mode: ${mode}`);
    })().catch((error) => {
      console.error(`${red('✖')} ${error.message}`);
      handleCliError(error);
      process.exit(1);
    });
  }
);
