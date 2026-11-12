import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDiscordError } from '../src/dashboard/auth.js';

test("a failed OAuth request shows Discord's error and description", () => {
    const body = JSON.stringify({ error: 'invalid_client', error_description: 'Unknown client' });
    assert.equal(
        describeDiscordError(401, '/oauth2/token', body),
        'Discord /oauth2/token responded 401: invalid_client (Unknown client)'
    );
    assert.equal(
        describeDiscordError(400, '/oauth2/token', JSON.stringify({ error: 'invalid_grant' })),
        'Discord /oauth2/token responded 400: invalid_grant'
    );
});

test("a failed API request shows Discord's message", () => {
    const body = JSON.stringify({ message: '401: Unauthorized', code: 0 });
    assert.equal(describeDiscordError(401, '/users/@me', body), 'Discord /users/@me responded 401: 401: Unauthorized');
});

test('an empty or unexpected body still gives a message, without throwing', () => {
    assert.equal(describeDiscordError(502, '/oauth2/token', ''), 'Discord /oauth2/token responded 502');
    assert.equal(describeDiscordError(500, '/oauth2/token', '{}'), 'Discord /oauth2/token responded 500');
    assert.equal(
        describeDiscordError(502, '/oauth2/token', '<html>\n  Bad gateway\n</html>'),
        'Discord /oauth2/token responded 502: <html> Bad gateway </html>'
    );
});

test('a long reason is cut short', () => {
    const message = describeDiscordError(500, '/oauth2/token', 'x'.repeat(1000));
    assert.ok(message.length < 260, `message is ${message.length} characters`);
    assert.ok(message.endsWith('…'));
});
