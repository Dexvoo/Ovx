import './helpers/setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { adminChange, syncRewardRoles, applyAdminChange } from '../src/features/levels/utils/admin.js';
import { ExpForLevel } from '../src/features/levels/utils/levels.js';
import User_Levels_Cache from '../src/features/levels/cache/userLevels.cache.js';
import { commandData } from '../src/features/levels/commands/leveladmin.js';

const start = { xp: ExpForLevel(5) + 10, level: 5 };

test('giving and taking XP moves the level with it, never below 0 or past the max level', () => {
    assert.deepEqual(adminChange(start, 'give', ExpForLevel(8) - start.xp, 100), { xp: ExpForLevel(8), level: 8 });
    assert.deepEqual(adminChange(start, 'take', start.xp - ExpForLevel(2), 100), { xp: ExpForLevel(2), level: 2 });
    assert.deepEqual(adminChange(start, 'take', 999_999, 100), { xp: 0, level: 0 });
    assert.deepEqual(adminChange(start, 'give', 999_999_999, 10), { xp: ExpForLevel(10), level: 10 });
});

test('setting XP or a level, and resetting', () => {
    assert.deepEqual(adminChange(start, 'set-xp', ExpForLevel(3) + 5, 100), { xp: ExpForLevel(3) + 5, level: 3 });
    assert.deepEqual(adminChange(start, 'set-level', 20, 100), { xp: ExpForLevel(20), level: 20 });
    assert.deepEqual(adminChange(start, 'set-level', 500, 50), { xp: ExpForLevel(50), level: 50 }, 'capped at the max');
    assert.deepEqual(adminChange(start, 'reset', 0, 100), { xp: 0, level: 0 });
});

/** A member with these roles, and a server with level rewards at 5, 10 and 20. */
function setup(held, removePastRewards = false) {
    const roles = new Map(['r5', 'r10', 'r20'].map((id) => [id, { id }]));
    const cache = new Map(held.map((id) => [id, {}]));
    const member = /** @type {any} */ ({
        guild: { roles: { cache: roles } },
        roles: {
            cache,
            add: async (role) => cache.set(role.id, {}),
            remove: async (role) => cache.delete(role.id),
        },
    });
    const guildData = /** @type {any} */ ({
        removePastRewards,
        rewards: [
            { level: 5, roleId: 'r5' },
            { level: 10, roleId: 'r10' },
            { level: 20, roleId: 'r20' },
        ],
    });
    return { member, guildData, held: () => [...cache.keys()].sort() };
}

test('raising a level gives the reward for it, and keeps earlier ones unless past rewards are removed', async () => {
    const keep = setup(['r5']);
    const result = await syncRewardRoles(keep.member, keep.guildData, 12);
    assert.deepEqual(result.added, ['r10']);
    assert.deepEqual(keep.held(), ['r10', 'r5']);

    const replace = setup(['r5'], true);
    await syncRewardRoles(replace.member, replace.guildData, 12);
    assert.deepEqual(replace.held(), ['r10']);
});

test('lowering a level takes away rewards they no longer qualify for', async () => {
    const { member, guildData, held } = setup(['r5', 'r10', 'r20']);
    const result = await syncRewardRoles(member, guildData, 7);
    assert.deepEqual(result.removed.sort(), ['r10', 'r20']);
    assert.deepEqual(held(), ['r5']);

    const reset = setup(['r5', 'r10']);
    await syncRewardRoles(reset.member, reset.guildData, 0);
    assert.deepEqual(reset.held(), []);
});

test("lower rewards a member never had aren't handed out, like normal levelling", async () => {
    const { member, guildData, held } = setup([]);
    await syncRewardRoles(member, guildData, 25);
    assert.deepEqual(held(), ['r20']);
});

test('a deleted reward role is reported, not thrown', async () => {
    const { member, guildData } = setup([]);
    member.guild.roles.cache.delete('r10');
    const result = await syncRewardRoles(member, guildData, 10);
    assert.deepEqual(result.failed, ['r10']);
});

test('the change is saved, and reward roles are only touched when asked', async () => {
    const saved = [];
    const realGet = User_Levels_Cache.get;
    const realSet = User_Levels_Cache.setXP;
    User_Levels_Cache.get = /** @type {any} */ (async () => ({ xp: 0, level: 0 }));
    User_Levels_Cache.setXP = /** @type {any} */ (
        async (guildId, userId, xp, level) => (saved.push({ xp, level }), { xp, level })
    );
    try {
        const { member, guildData, held } = setup([]);
        member.guild.id = 'g';
        member.id = 'u';
        guildData.maxLevel = 100;
        const result = await applyAdminChange(member, guildData, 'set-level', 10, { syncRoles: false });
        assert.deepEqual(result.after, { xp: ExpForLevel(10), level: 10 });
        assert.deepEqual(saved, [{ xp: ExpForLevel(10), level: 10 }]);
        assert.deepEqual(held(), [], 'roles left alone');
    } finally {
        User_Levels_Cache.get = realGet;
        User_Levels_Cache.setXP = realSet;
    }
});

test('/leveladmin is hidden from members without Manage Server', () => {
    const json = commandData.toJSON();
    assert.equal(json.default_member_permissions, String(PermissionFlagsBits.ManageGuild));
    assert.deepEqual(
        json.options.map((option) => option.name),
        ['give', 'take', 'set-xp', 'set-level', 'reset']
    );
});
