import './helpers/setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import loadEvents from '../src/core/baseEvents.js';

test('the listener limit grows only to what the features need, so a later extra listener still warns', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ovx-events-'));
    try {
        for (let i = 0; i < 12; i++) {
            await fs.writeFile(
                path.join(dir, `feature${i}.js`),
                "export const name = 'interactionCreate';\nexport async function execute() {}\n"
            );
        }
        const client = Object.assign(new EventEmitter(), { utils: { LogData: () => {} } });

        await loadEvents(/** @type {any} */ (client), dir);
        assert.equal(client.listenerCount('interactionCreate'), 12);
        assert.equal(client.getMaxListeners(), 12, 'exactly what the features need, so loading gave no warning');
        // One more added while running (a real leak) goes over the limit, which is when Node warns
        assert.ok(client.listenerCount('interactionCreate') + 1 > client.getMaxListeners());
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});
