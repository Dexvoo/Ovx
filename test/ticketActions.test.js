import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Collection, PermissionFlagsBits } from 'discord.js';
import { stubEnvironment } from './helpers/env.js';
import Ticket_Config_Cache from '../src/features/tickets/cache/ticketConfig.cache.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';
import { Ticket } from '../src/features/tickets/models/ticket.js';

const GUILD_ID = '400000000000000001';
const OWNER = '300000000000000001';
const STAFF = '300000000000000002';
const STRANGER = '300000000000000003';
const STAFF_ROLE = '600000000000000001';

/** @type {any} */
let en;
/** @type {typeof import('../src/features/tickets/utils/ticketActions.js')} */
let actions;
let config;
let ticket;
let overwriteEdits;

before(async () => {
    stubEnvironment({});
    ({ default: en } = await import('../src/locales/en-GB.js'));
    actions = await import('../src/features/tickets/utils/ticketActions.js');
});

beforeEach(() => {
    config = { ...Ticket_Config_Cache.createDefault(GUILD_ID), enabled: true, staffRoleIds: [STAFF_ROLE] };
    ticket = {
        _id: 't1',
        guildId: GUILD_ID,
        number: 1,
        channelId: 'ticket-channel',
        controlMessageId: null,
        ownerId: OWNER,
        status: 'open',
        locked: false,
        claimedBy: null,
        addedUserIds: [],
        createdAt: new Date(),
    };
    overwriteEdits = [];
    Ticket_Config_Cache.get = async () => config;
    Guild_Settings_Cache.get = async (guildId) => ({ guildId, embedColour: null, bio: null });
    Ticket.findOne = () => ({ lean: async () => ticket });
    Ticket.findOneAndUpdate = async (_filter, update) => (ticket = { ...ticket, ...update.$set });
});

/** Translations without placeholders filled, enough to tell replies apart. */
const translate = (key) => key.split('.').reduce((value, part) => value?.[part], en) ?? key;

/**
 * An interaction in a ticket channel by one of the test users.
 * @param {string} userId
 */
function makeInteraction(userId) {
    const replies = [];
    const channel = {
        id: 'ticket-channel',
        isTextBased: () => true,
        isThread: () => false,
        messages: { fetch: async () => null },
        permissionOverwrites: {
            edit: async (id, permissions) => void overwriteEdits.push({ id, permissions }),
            delete: async (id) => void overwriteEdits.push({ id, deleted: true }),
        },
    };
    const member = {
        id: userId,
        roles: { cache: new Collection(userId === STAFF ? [[STAFF_ROLE, {}]] : []) },
        permissions: { has: (flag) => flag === PermissionFlagsBits.ManageGuild && false },
    };
    return {
        replies,
        interaction: {
            guildId: GUILD_ID,
            channelId: channel.id,
            channel,
            member,
            locale: 'en-GB',
            user: { id: userId, username: 'user', toString: () => `<@${userId}>` },
            guild: { members: { fetch: async () => ({}) } },
            client: {
                utils: {
                    Translate: translate,
                    Embed: async (_target, colour, title, description) => void replies.push({ colour, description }),
                },
            },
            isButton: () => false,
        },
    };
}

const user = (id, bot = false) => ({ id, bot, toString: () => `<@${id}>` });

test('only staff can lock, and locking stops the owner sending without hiding the ticket', async () => {
    const stranger = makeInteraction(OWNER);
    await actions.lockAction(stranger.interaction, true);
    assert.equal(stranger.replies[0].description, en.tickets.staff_only);
    assert.equal(overwriteEdits.length, 0);

    const staff = makeInteraction(STAFF);
    await actions.lockAction(staff.interaction, true);
    assert.deepEqual(overwriteEdits, [{ id: OWNER, permissions: { SendMessages: false } }]);
    assert.equal(ticket.locked, true);
});

test('owners can close their own tickets only when that is allowed', async () => {
    config.ownerCanClose = false;
    const owner = makeInteraction(OWNER);
    await actions.closeAction(owner.interaction, null);
    assert.equal(owner.replies[0].description, en.tickets.cannot_close);

    const stranger = makeInteraction(STRANGER);
    config.ownerCanClose = true;
    await actions.closeAction(stranger.interaction, null);
    assert.equal(stranger.replies[0].description, en.tickets.cannot_close, 'other members never can');
});

test('adding and removing members', async () => {
    const staff = makeInteraction(STAFF);
    await actions.addAction(staff.interaction, user(STRANGER));
    assert.deepEqual(ticket.addedUserIds, [STRANGER]);
    assert.equal(overwriteEdits[0].permissions.ViewChannel, true);

    const again = makeInteraction(STAFF);
    await actions.addAction(again.interaction, user(STRANGER));
    assert.equal(again.replies[0].description, en.tickets.already_added);

    const bot = makeInteraction(STAFF);
    await actions.addAction(bot.interaction, user('999999999999999999', true));
    assert.equal(bot.replies[0].description, en.tickets.cannot_add_bot);

    const owner = makeInteraction(STAFF);
    await actions.removeAction(owner.interaction, user(OWNER));
    assert.equal(owner.replies[0].description, en.tickets.cannot_remove_owner);

    const remove = makeInteraction(STAFF);
    await actions.removeAction(remove.interaction, user(STRANGER));
    assert.deepEqual(ticket.addedUserIds, []);
});

test('members added to a locked ticket can read but not send', async () => {
    ticket.locked = true;
    await actions.addAction(makeInteraction(STAFF).interaction, user(STRANGER));
    assert.equal(overwriteEdits[0].permissions.SendMessages, false);
});

test('claiming: take it, let it go, and someone else’s claim is protected', async () => {
    await actions.claimAction(makeInteraction(STAFF).interaction);
    assert.equal(ticket.claimedBy, STAFF);

    ticket.claimedBy = '300000000000000009';
    const other = makeInteraction(STAFF);
    await actions.claimAction(other.interaction);
    assert.equal(other.replies[0].description, en.tickets.claimed_by_other);

    ticket.claimedBy = STAFF;
    await actions.claimAction(makeInteraction(STAFF).interaction);
    assert.equal(ticket.claimedBy, null);
});

test('actions outside a ticket channel say so', async () => {
    Ticket.findOne = () => ({ lean: async () => null });
    const outside = makeInteraction(STAFF);
    await actions.lockAction(outside.interaction, true);
    assert.equal(outside.replies[0].description, en.tickets.not_ticket);
});
