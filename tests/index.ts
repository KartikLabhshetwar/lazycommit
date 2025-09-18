import { describe } from 'manten';

describe('lazycommit', ({ runTestSuite }) => {
  runTestSuite(import('./specs/cli/index.js'));
  runTestSuite(import('./specs/groq/index.js'));
  runTestSuite(import('./specs/openrouter/index.js'));
  runTestSuite(import('./specs/config.js'));
  runTestSuite(import('./specs/git-hook.js'));
});
