import { LogData } from '../shared/utils/logger.js';
import { parseEnvironment } from './parseEnvironment.js';

try {
    process.loadEnvFile();
} catch {
    // Fine when variables come from the host instead (Docker, PM2, CI)
    LogData('Environment Variables', 'No .env file found, using the existing environment.', 'warning');
}

const { env, errors, warnings } = parseEnvironment(process.env);

for (const warning of warnings) LogData('Environment Variables', warning, 'warning');

if (errors.length > 0) {
    for (const error of errors) LogData('Environment Variables', error, 'error');
    process.exit(1);
}

/** @type {import('./parseEnvironment.js').Environment} */
export const ENV = env;
