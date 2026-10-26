import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, Collection, PermissionFlagsBits } from 'discord.js';
import Ticket_Config_Cache from '../src/features/tickets/cache/ticketConfig.cache.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';
import { Ticket } from '../src/features/tickets/models/ticket.js';
import { buildTranscriptHtml, escapeHtml } from '../src/features/tickets/utils/transcript.js';
import { openTicket } from '../src/features/tickets/utils/openTicket.js';
import { closeTicket, DELETE_DELAY_MS } from '../src/features/tickets/utils/closeTicket.js';
import { isStaff } from '../src/features/tickets/utils/access.js';
import {
    LEGACY_BUTTONS,
    TICKET_BUTTONS,
    ticketControls,
    panelMessage,
    createButtonId,
} from '../src/features/tickets/utils/components.js';
import { ticketTypes, findTicketType } from '../src/features/tickets/utils/ticketTypes.js';

const GUILD_ID = '400000000000000001';
const CATEGORY_ID = '500000000000000001';
const TRANSCRIPTS_ID = '500000000000000002';
const STAFF_ROLE = '600000000000000001';

let config;

beforeEach(() => {
    config = {
        ...Ticket_Config_Cache.createDefault(GUILD_ID),
        enabled: true,
        categoryId: CATEGORY_ID,
        transcriptChannelId: TRANSCRIPTS_ID,
        staffRoleIds: [STAFF_ROLE],
    };
    Ticket_Config_Cache.get = async () => config;
    Ticket_Config_Cache.nextTicketNumber = async () => ++config.lastTicketNumber;
    Guild_Settings_Cache.get = async (guildId) => ({ guildId, embedColour: null, bio: null });
});

// ---------- Transcripts ----------

const transcriptDetails = (messages, extra = {}) => ({
    guildName: 'Drift <Kings>',
    ticketNumber: '0007',
    channelName: 'ticket-0007',
    ownerName: 'Owner',
    closedByName: 'Staff',
    reason: null,
    openedAt: new Date('2026-10-12T10:00:00Z'),
    closedAt: new Date('2026-10-12T11:00:00Z'),
    messages,
    ...extra,
});
const message = (overrides = {}) => ({
    authorId: '1',
    authorName: 'Owner',
    authorAvatar: 'https://cdn.discordapp.com/embed/avatars/1.png',
    bot: false,
    timestamp: Date.parse('2026-10-12T10:05:00Z'),
    content: 'Hello',
    attachments: [],
    embeds: [],
    ...overrides,
});

test('transcripts escape everything from Discord, so nothing in a message can run as code', () => {
    const html = buildTranscriptHtml(
        transcriptDetails([
            message({
                authorName: '<img src=x onerror=alert(1)>',
                content: '<script>alert("hi")</script> & "quotes"',
                embeds: [{ title: '<b>Title</b>', description: '</div><script>x</script>' }],
                attachments: [{ name: '"><svg onload=alert(1)>.png', url: 'https://cdn.discordapp.com/a.png' }],
            }),
        ])
    );

    assert.equal(html.includes('<script>'), false);
    assert.equal(html.includes('<img src=x'), false);
    assert.equal(html.includes('<svg'), false);
    assert.ok(html.includes('&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;'));
    assert.ok(html.includes('Drift &lt;Kings&gt;'));
    assert.ok(html.includes("default-src 'none'"), 'the page itself blocks scripts too');
});

test('links that are not http(s) are dropped', () => {
    const html = buildTranscriptHtml(
        transcriptDetails([
            message({ attachments: [{ name: 'evil', url: 'javascript:alert(1)' }], authorAvatar: 'javascript:x' }),
        ])
    );
    assert.equal(html.includes('javascript:'), false);
    assert.ok(html.includes('📎 evil'), 'the file name is still shown');
});

test('mentions show as names, and long tickets say only the latest messages are included', () => {
    const html = buildTranscriptHtml(
        transcriptDetails(
            [message({ authorId: '111111111111111111', authorName: 'Sakura', content: 'Hi <@111111111111111111>' })],
            {
                truncated: true,
            }
        )
    );
    assert.ok(html.includes('Hi @Sakura'));
    assert.ok(html.includes('Only the last 1 messages are included'));
    assert.equal(escapeHtml("it's"), 'it&#39;s');
});

// ---------- Opening ----------

/**
 * A guild with a ticket category; records created channels and sent messages.
 * @param {{ categoryPermissions?: string[], channelType?: number, failSend?: boolean }} [options]
 */
function makeGuild({ categoryPermissions = [], channelType = ChannelType.GuildCategory, failSend = false } = {}) {
    const created = [];
    const category = { id: CATEGORY_ID, type: channelType };
    const guild = {
        id: GUILD_ID,
        name: 'Drift Kings',
        created,
        roles: { cache: new Collection([[STAFF_ROLE, {}]]) },
        channels: {
            cache: new Collection([[CATEGORY_ID, category]]),
            async create(options) {
                const channel = {
                    id: `70000000000000000${created.length}`,
                    options,
                    sent: [],
                    deleted: false,
                    async send(payload) {
                        if (failSend) throw new Error('Missing Access');
                        channel.sent.push(payload);
                        return { id: 'control-message' };
                    },
                    async delete() {
                        channel.deleted = true;
                    },
                };
                created.push(channel);
                guild.channels.cache.set(channel.id, channel);
                return channel;
            },
        },
        members: { me: { id: 'bot', permissionsIn: () => ({ missing: () => categoryPermissions }) } },
    };
    return guild;
}

const makeMember = (guild, id = '300000000000000001') => ({ id, guild, user: { username: 'owner' } });

function stubTicketStore(existing = []) {
    const tickets = [...existing];
    Ticket.find = () => ({ lean: async () => tickets.filter((ticket) => ['open', 'closing'].includes(ticket.status)) });
    Ticket.updateMany = async () => ({});
    Ticket.create = async (ticket) => (tickets.push({ ...ticket, status: 'open' }), ticket);
    return tickets;
}

test('opening a ticket makes a private channel for the member and staff, and pings them', async () => {
    const tickets = stubTicketStore();
    const guild = makeGuild();
    const result = await openTicket(makeMember(guild));

    assert.equal(result.ok, true);
    const [channel] = guild.created;
    assert.equal(channel.options.name, 'ticket-0001');
    assert.equal(channel.options.parent, CATEGORY_ID);

    const overwrites = channel.options.permissionOverwrites;
    assert.deepEqual(overwrites[0], { id: GUILD_ID, type: 0, deny: ['ViewChannel'] }, 'hidden from everyone');
    assert.ok(
        overwrites.some((overwrite) => overwrite.id === '300000000000000001' && overwrite.allow.includes('ViewChannel'))
    );
    assert.ok(overwrites.some((overwrite) => overwrite.id === STAFF_ROLE && overwrite.allow.includes('SendMessages')));

    assert.deepEqual(channel.sent[0].allowedMentions, { users: ['300000000000000001'], roles: [STAFF_ROLE] });
    assert.equal(tickets[0].controlMessageId, 'control-message');
    assert.equal(tickets[0].number, 1);
});

test('staff are not pinged when that is switched off, and deleted staff roles are skipped', async () => {
    stubTicketStore();
    config.pingStaff = false;
    config.staffRoleIds = [STAFF_ROLE, '600000000000000099'];
    const guild = makeGuild();
    await openTicket(makeMember(guild));

    const [channel] = guild.created;
    assert.deepEqual(channel.sent[0].allowedMentions.roles, []);
    assert.equal(
        channel.options.permissionOverwrites.some((o) => o.id === '600000000000000099'),
        false
    );
});

test('tickets cannot be opened when off, without a usable category, or past the limit', async () => {
    stubTicketStore([{ ownerId: '300000000000000001', channelId: 'still-there', status: 'open' }]);
    const guild = makeGuild();
    guild.channels.cache.set('still-there', {});

    assert.equal((await openTicket(makeMember(guild))).reason, 'limit');

    config.enabled = false;
    assert.equal((await openTicket(makeMember(makeGuild()))).reason, 'disabled');

    config.enabled = true;
    assert.equal(
        (await openTicket(makeMember(makeGuild({ channelType: ChannelType.GuildText })))).reason,
        'no_category'
    );

    const noPermission = await openTicket(makeMember(makeGuild({ categoryPermissions: ['ManageRoles'] })));
    assert.deepEqual([noPermission.reason, noPermission.missing], ['bot_permissions', ['ManageRoles']]);
});

test('tickets whose channel was deleted do not count against the limit', async () => {
    stubTicketStore([{ ownerId: '300000000000000001', channelId: 'deleted-channel', status: 'open' }]);
    assert.equal((await openTicket(makeMember(makeGuild()))).ok, true);
});

test('a double click opens only one ticket', async () => {
    stubTicketStore();
    const guild = makeGuild();
    const member = makeMember(guild);
    const [first, second] = await Promise.all([openTicket(member), openTicket(member)]);
    assert.deepEqual([first.ok, second.reason], [true, 'busy']);
    assert.equal(guild.created.length, 1);
});

test('if setting up the new ticket fails, its channel is removed again', async () => {
    stubTicketStore();
    const guild = makeGuild({ failSend: true });
    await assert.rejects(openTicket(makeMember(guild)), /Missing Access/);
    assert.equal(guild.created[0].deleted, true);
});

// ---------- Closing ----------

/**
 * A ticket channel with a few messages, and a transcript channel that records what is posted.
 * @param {{ transcriptPermissions?: string[], noTranscriptChannel?: boolean }} [options]
 */
function closingSetup({ transcriptPermissions = [], noTranscriptChannel = false } = {}) {
    const posted = [];
    const dms = [];
    const transcripts = {
        isTextBased: () => true,
        async send(payload) {
            posted.push(payload);
            return {
                url: 'https://discord.com/channels/1/2/3',
                attachments: { first: () => ({ url: 'https://cdn/t.html' }) },
            };
        },
    };
    const guild = {
        id: GUILD_ID,
        name: 'Drift Kings',
        channels: { cache: new Collection(noTranscriptChannel ? [] : [[TRANSCRIPTS_ID, transcripts]]) },
        members: {
            me: { permissionsIn: () => ({ missing: () => transcriptPermissions }) },
            fetch: async () => ({ displayName: 'Owner', user: { username: 'owner' } }),
        },
        client: { users: { fetch: async () => ({ send: async (payload) => void dms.push(payload) }) } },
    };
    const history = new Collection([
        [
            '2',
            {
                author: {
                    id: '1',
                    username: 'owner',
                    displayName: 'Owner',
                    bot: false,
                    displayAvatarURL: () => 'https://x/a.png',
                },
                member: null,
                createdTimestamp: 2,
                content: 'Thanks',
                attachments: new Collection(),
                embeds: [],
            },
        ],
    ]);
    const channel = {
        id: 'ticket-channel',
        name: 'ticket-0001',
        guild,
        deleted: false,
        messages: { fetch: async () => history },
        delete: async () => {
            channel.deleted = true;
        },
    };
    const ticket = { _id: 't1', number: 1, ownerId: '300000000000000001', claimedBy: null, createdAt: new Date() };
    const closedBy = { id: '300000000000000002', displayName: 'Staff', user: { username: 'staff' } };
    return { posted, dms, channel, ticket, closedBy };
}

function stubTicketUpdates(claimable = true) {
    const updates = [];
    Ticket.findOneAndUpdate = async () => (claimable ? { status: 'closing' } : null);
    Ticket.updateOne = async (_filter, update) => void updates.push(update.$set);
    return updates;
}

test('closing saves a transcript to the transcript channel and the owner, then deletes the channel', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const updates = stubTicketUpdates();
        const setup = closingSetup();
        const result = await closeTicket({ ...setup, config, reason: 'Solved' });

        assert.deepEqual(result, { ok: true, transcriptUrl: 'https://cdn/t.html' });
        assert.equal(setup.posted.length, 1);
        assert.equal(setup.posted[0].files[0].name, 'ticket-0001.html');
        assert.deepEqual(setup.posted[0].allowedMentions, { parse: [] }, 'the summary pings nobody');
        assert.equal(setup.dms.length, 1);
        assert.equal(updates.at(-1).status, 'closed');
        assert.equal(updates.at(-1).closeReason, 'Solved');

        assert.equal(setup.channel.deleted, false, 'people get a moment to see it was closed');
        mock.timers.tick(DELETE_DELAY_MS);
        await Promise.resolve();
        assert.equal(setup.channel.deleted, true);
    } finally {
        mock.timers.reset();
    }
});

test('a ticket that is already closing is not closed twice', async () => {
    stubTicketUpdates(false);
    const setup = closingSetup();
    assert.deepEqual(await closeTicket({ ...setup, config, reason: null }), { ok: false, reason: 'already_closing' });
    assert.equal(setup.posted.length, 0);
});

test('if the transcript cannot be posted, the ticket is reopened instead of losing the conversation', async () => {
    for (const setup of [
        closingSetup({ transcriptPermissions: ['AttachFiles'] }),
        closingSetup({ noTranscriptChannel: true }),
    ]) {
        const updates = stubTicketUpdates();
        const result = await closeTicket({ ...setup, config, reason: null });
        assert.equal(result.reason, 'transcript_failed');
        assert.deepEqual(updates, [{ status: 'open' }]);
        assert.equal(setup.channel.deleted, false);
    }
});

test('without a transcript channel, closing still works (and the owner still gets the DM)', async () => {
    stubTicketUpdates();
    config.transcriptChannelId = null;
    const setup = closingSetup({ noTranscriptChannel: true });
    const result = await closeTicket({ ...setup, config, reason: null });
    assert.deepEqual(result, { ok: true, transcriptUrl: null });
    assert.equal(setup.dms.length, 1);
});

// ---------- Permissions and buttons ----------

test('staff are members with a staff role or Manage Server', () => {
    const member = (roles, manageGuild = false) => ({
        roles: { cache: new Collection(roles.map((id) => [id, {}])) },
        permissions: { has: (flag) => manageGuild && flag === PermissionFlagsBits.ManageGuild },
    });
    assert.equal(isStaff(member([STAFF_ROLE]), config), true);
    assert.equal(isStaff(member([], true), config), true);
    assert.equal(isStaff(member(['other']), config), false);
});

test('buttons from the old Ovx bot still work', () => {
    assert.equal(LEGACY_BUTTONS['ovx-ticket-create'], TICKET_BUTTONS.create);
    assert.equal(LEGACY_BUTTONS['ovx-ticket-close'], TICKET_BUTTONS.close);
    assert.equal(LEGACY_BUTTONS['ovx-ticket-lock'], TICKET_BUTTONS.lock);
    assert.equal(LEGACY_BUTTONS['ovx-ticket-unlock'], TICKET_BUTTONS.unlock);
});

test('ticket buttons swap Lock for Unlock and show who claimed it', () => {
    const ids = (row) => row.toJSON().components.map((button) => button.custom_id);
    assert.deepEqual(ids(ticketControls({ locked: false, claimedBy: null })), [
        TICKET_BUTTONS.close,
        TICKET_BUTTONS.claim,
        TICKET_BUTTONS.lock,
    ]);
    const claimed = ticketControls({ locked: true, claimedBy: '1' }, 'Sakura').toJSON().components;
    assert.equal(claimed[1].label, 'Claimed by Sakura');
    assert.equal(claimed[2].custom_id, TICKET_BUTTONS.unlock);
});

test('the catch-all for unknown buttons leaves every ticket button alone', async () => {
    const { isHandledComponent } = await import('../src/shared/constants/componentIds.js');
    for (const id of [...Object.values(TICKET_BUTTONS), ...Object.keys(LEGACY_BUTTONS)]) {
        assert.equal(isHandledComponent(id), true, id);
    }
    assert.equal(isHandledComponent('something-else'), false);
});

// ---------- Ticket types ----------

const UNBAN = {
    id: 'unban1',
    label: 'Unban Request',
    emoji: '🔓',
    style: 'secondary',
    description: 'Appeal a ban',
    channelPrefix: 'unban',
    categoryId: null,
    staffRoleIds: ['600000000000000002'],
    allowedRoleIds: [],
    openMessage: 'Tell us why.',
};
const BUGS = {
    ...UNBAN,
    id: 'bugs1',
    label: 'Report a Bug',
    emoji: '🐛',
    style: 'danger',
    description: null,
    staffRoleIds: [],
    allowedRoleIds: ['600000000000000003'],
};

test('servers without ticket types keep their single button, built from the older settings', () => {
    config.panel = { ...config.panel, buttonLabel: 'Get help' };
    config.openMessage = 'Old message';
    const [type] = ticketTypes(config);
    assert.deepEqual([type.id, type.label, type.openMessage], ['default', 'Get help', 'Old message']);
});

test('the panel has a button per type, five to a row, with described types listed', () => {
    config.ticketTypes = [
        UNBAN,
        BUGS,
        ...Array.from({ length: 4 }, (_, i) => ({ ...BUGS, id: `extra${i}`, label: `Extra ${i}` })),
    ];
    const { embeds, components } = panelMessage(config, '#000000');
    const rows = components.map((row) => row.toJSON().components);

    assert.deepEqual(
        rows.map((row) => row.length),
        [5, 1]
    );
    assert.equal(rows[0][0].custom_id, createButtonId('unban1'));
    assert.equal(rows[0][0].style, 2, 'grey');
    assert.equal(rows[0][1].style, 4, 'red');
    assert.equal(rows[0][0].emoji.name, '🔓');
    assert.match(embeds[0].toJSON().description, /🔓 \*\*Unban Request\*\*: Appeal a ban/);
    assert.doesNotMatch(embeds[0].toJSON().description, /Report a Bug/, 'types without a description are not listed');
});

test('old panels (no type in the button) open the first type; removed types are reported', () => {
    config.ticketTypes = [UNBAN, BUGS];
    assert.equal(findTicketType(config, null).id, 'unban1');
    assert.equal(findTicketType(config, 'bugs1').id, 'bugs1');
    assert.equal(findTicketType(config, 'gone'), null);
});

test('a ticket type sets the channel name, message, staff who can see it, and pings them', async () => {
    const tickets = stubTicketStore();
    config.ticketTypes = [UNBAN];
    const guild = makeGuild();
    guild.roles.cache.set('600000000000000002', {});
    await openTicket(makeMember(guild), 'unban1');

    const [channel] = guild.created;
    assert.equal(channel.options.name, 'unban-0001');
    assert.ok(
        channel.options.permissionOverwrites.some((o) => o.id === '600000000000000002'),
        'type staff can see it'
    );
    assert.ok(
        channel.options.permissionOverwrites.some((o) => o.id === STAFF_ROLE),
        'general staff still can'
    );
    assert.deepEqual(channel.sent[0].allowedMentions.roles, [STAFF_ROLE, '600000000000000002']);
    assert.equal(channel.sent[0].embeds[0].toJSON().description, 'Tell us why.');
    assert.equal(tickets[0].typeId, 'unban1');
});

test('types limited to certain roles refuse everyone else, but not staff', async () => {
    stubTicketStore();
    config.ticketTypes = [BUGS];
    const guild = makeGuild();
    guild.roles.cache.set('600000000000000003', {});

    const withRoles = (roleIds) => ({
        ...makeMember(guild),
        roles: { cache: new Collection(roleIds.map((id) => [id, {}])) },
        permissions: { has: () => false },
    });
    assert.equal((await openTicket(withRoles([]), 'bugs1')).reason, 'not_allowed');
    assert.equal((await openTicket(withRoles(['600000000000000003']), 'bugs1')).ok, true);
    stubTicketStore();
    assert.equal((await openTicket({ ...withRoles([STAFF_ROLE]), id: '300000000000000005' }, 'bugs1')).ok, true);
    assert.equal((await openTicket(withRoles([]), 'gone')).reason, 'unknown_type');
});

test('type staff can manage tickets of their type only', () => {
    config.ticketTypes = [UNBAN, BUGS];
    const member = {
        roles: { cache: new Collection([['600000000000000002', {}]]) },
        permissions: { has: () => false },
    };
    assert.equal(isStaff(member, config, 'unban1'), true);
    assert.equal(isStaff(member, config, 'bugs1'), false);
    assert.equal(isStaff(member, config), false, 'not general staff');
});
