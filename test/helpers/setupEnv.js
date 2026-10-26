// Import first in test files whose static imports load the environment, so placeholder values
// (and switched-off stream platforms) are in place before src/bootstrap/environment.js reads them.
import { stubEnvironment } from './env.js';

stubEnvironment();
