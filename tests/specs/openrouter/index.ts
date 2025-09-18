import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
  describe('OpenRouter', ({ runTestSuite }) => {
    runTestSuite(import('./config.ts'));
    runTestSuite(import('./provider.ts'));
  });
});
