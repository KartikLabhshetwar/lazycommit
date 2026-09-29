import { command } from 'cleye';
import { red } from 'kolorist';
import { intro, outro, select, isCancel } from '@clack/prompts';
import { getConfig, setConfigs } from '../utils/config.js';
import { defaultModels, listModels, resolveModel } from '../utils/ai.js';
import { handleCliError } from '../utils/error.js';

const defaults = Object.entries(defaultModels).map(([provider, model]) => `${provider}/${model}`);

export default command(
	{
		name: 'model',
		help: { description: 'List the models your API keys can use and pick the default one' },
	},
	() => {
		(async () => {
			const config = await getConfig({}, true);
			const providers = listModels(config);
			if (!process.stdin.isTTY) {
				console.log(providers.flatMap(provider => provider.models).join('\n'));
				return;
			}
			let current: string | undefined;
			try { current = resolveModel(config).id; } catch {}
			intro(`lazycommit · current model: ${current ?? 'none'}`);
			const provider = providers.length === 1 ? providers[0] : await select({
				message: 'Choose a provider',
				options: providers.map(value => ({ value, label: value.name, hint: `${value.models.length} models` })),
				initialValue: providers.find(value => current?.startsWith(`${value.id}/`)),
				maxItems: 12,
			});
			if (isCancel(provider)) { outro('Model unchanged'); return; }
			const model = await select({
				message: `Choose a model from ${provider.name}`,
				options: provider.models.map(value => ({
					value, label: value.slice(provider.id.length + 1),
					hint: value === current ? 'current' : defaults.includes(value) ? 'default' : undefined,
				})),
				initialValue: current,
				maxItems: 12,
			});
			if (isCancel(model)) { outro('Model unchanged'); return; }
			await setConfigs([['model', model]]);
			outro(`Model set to ${model}`);
		})().catch((error) => {
			console.error(`${red('✖')} ${error.message}`);
			handleCliError(error);
			process.exit(1);
		});
	}
);
