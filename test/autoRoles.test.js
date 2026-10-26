import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from 'discord.js';
import Auto_Roles_Cache from '../src/features/autoRoles/cache/autoRoles.cache.js';
import { assignAutoRoles, splitAssignableRoles } from '../src/features/autoRoles/utils/assignAutoRoles.js';
import { execute as onJoin } from '../src/features/autoRoles/events/guildMemberAdd.js';
import { execute as onMemberUpdate } from '../src/features/autoRoles/events/guildMemberUpdate.js';

const GUILD_ID = 'g1';
let config;

beforeEach(() => {
    config = { guildId: GUILD_ID, enabled: true, humanRoleIds: ['member'], botRoleIds: ['bots'] };
    Auto_Roles_Cache.get = async () => config;
});

/**
 * A guild where the bot's highest role is at position 10.
 * @param {{ manageRoles?: boolean }} [options]
 */
function makeGuild({ manageRoles = true } = {}) {
    const role = (id, position, managed = false) => [id, { id, position, managed }];
    return {
        id: GUILD_ID,
        name: 'Test',
        roles: {
            cache: new Collection([
                role(GUILD_ID, 0),
                role('member', 2),
                role('bots', 3),
                role('second', 4),
                role('integration', 5, true),
                role('admin', 20),
            ]),
        },
        members: { me: { roles: { highest: { position: 10 } }, permissions: { has: () => manageRoles } } },
    };
}

/**
 * A new member that records the roles it is given.
 * @param {{ bot?: boolean, pending?: boolean, has?: string[], guild?: any, fail?: boolean }} [options]
 */
function makeMember({ bot = false, pending = false, has = [], guild = makeGuild(), fail = false } = {}) {
    const given = [];
    return {
        id: 'u1',
        guild,
        pending,
        user: { bot },
        given,
        roles: {
            cache: new Collection(has.map((id) => [id, {}])),
            async add(ids, reason) {
                if (fail) throw new Error('Missing Permissions');
                given.push({ ids, reason });
            },
        },
    };
}

test('people get the member roles and bots get the bot roles', async () => {
    const person = makeMember();
    await assignAutoRoles(person);
    assert.deepEqual(person.given, [{ ids: ['member'], reason: 'Auto roles' }]);

    const bot = makeMember({ bot: true });
    await assignAutoRoles(bot);
    assert.deepEqual(bot.given, [{ ids: ['bots'], reason: 'Auto roles' }]);
});

test('roles the bot can no longer give are skipped, and the rest are still given', async () => {
    config.humanRoleIds = ['member', 'admin', 'integration', 'deleted', 'second'];
    const member = makeMember();
    assert.deepEqual(await assignAutoRoles(member), ['member', 'second']);
    assert.deepEqual(member.given[0].ids, ['member', 'second']);
});

test('nothing is given when auto roles are off, the bot lacks Manage Roles, or the member already has them', async () => {
    config.enabled = false;
    const off = makeMember();
    await assignAutoRoles(off);
    assert.equal(off.given.length, 0);

    config.enabled = true;
    const noPermission = makeMember({ guild: makeGuild({ manageRoles: false }) });
    await assignAutoRoles(noPermission);
    assert.equal(noPermission.given.length, 0);

    const alreadyHas = makeMember({ has: ['member'] });
    await assignAutoRoles(alreadyHas);
    assert.equal(alreadyHas.given.length, 0);
});

test('a failed role change is logged instead of crashing', async () => {
    assert.deepEqual(await assignAutoRoles(makeMember({ fail: true })), []);
});

test('people waiting on Rules Screening get their roles only once they accept the rules', async () => {
    const pending = makeMember({ pending: true });
    await onJoin(pending);
    assert.equal(pending.given.length, 0, 'not on join');

    const accepted = { ...pending, pending: false };
    await onMemberUpdate(pending, accepted);
    assert.deepEqual(pending.given, [{ ids: ['member'], reason: 'Auto roles' }]);

    // Other member updates (nickname changes etc.) don't give roles again
    const later = makeMember();
    await onMemberUpdate(later, later);
    assert.equal(later.given.length, 0);
});

test('bots and people without Rules Screening get roles straight away', async () => {
    const person = makeMember();
    await onJoin(person);
    assert.equal(person.given.length, 1);

    const bot = makeMember({ bot: true, pending: true });
    await onJoin(bot);
    assert.equal(bot.given.length, 1, 'bots never go through screening');
});

test('splitAssignableRoles never treats the everyone role as givable', () => {
    assert.deepEqual(splitAssignableRoles(makeGuild(), [GUILD_ID, 'member']), {
        usable: ['member'],
        unusable: [GUILD_ID],
    });
});
