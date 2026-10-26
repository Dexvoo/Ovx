import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { reportError } from '../shared/utils/errorReport.js';

/**
 * @typedef {import('../core/extendedClient.js').default} Client
 * @param { Client } client
 * @param { string } dir
 * @returns { Promise<void> }
 */

export default async function loadEvents(client, dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
            await loadEvents(client, fullPath);
            continue;
        }

        if (!file.name.endsWith('.js')) continue;

        try {
            const event = await import(pathToFileURL(fullPath).href);

            if (!event.name || !event.execute) {
                client.utils.LogData('Event Load Error', `Missing name or execute at ${fullPath}`, 'error');
                continue;
            }

            const listener = async (...args) => {
                try {
                    await event.execute(...args, client);
                } catch (error) {
                    const where = `${event.name} (${path.relative(process.cwd(), fullPath)})`;
                    client.utils.LogData('Event Error', `${where}\n${error.stack ?? error.message}`, 'error');
                    // Most events carry the server they happened in (a member, message, channel…)
                    const guild = args.find((arg) => arg?.guild)?.guild ?? null;
                    reportError(client, { source: `Event: ${where}`, error, guild });
                }
            };

            // Each feature listens for its own events (every feature with buttons has an interactionCreate listener),
            // so there are more than Node's default of 10. The limit grows only here, while features load at startup:
            // a listener added later while running (a real leak) still gets Node's warning.
            const needed = client.listenerCount(event.name) + 1;
            if (needed > client.getMaxListeners()) client.setMaxListeners(needed);

            if (event.once) {
                client.once(event.name, listener);
            } else {
                client.on(event.name, listener);
            }

            const description = event.description ?? 'No description provided.';

            client.utils.LogData('Event', `${description}`, 'success');
        } catch (error) {
            client.utils.LogData('Event Loader', `Failed loading ${fullPath}: ${error.message}`, 'error');
        }
    }
}
