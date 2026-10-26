import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * The "Create Ticket" message people click to open a ticket.
 * @typedef {Object} TicketPanelType
 * @property {string | null} channelId
 * @property {string | null} messageId - The posted panel, so it can be updated instead of posted again
 * @property {string | null} title - null uses the default
 * @property {string | null} description - null uses the default
 * @property {string | null} buttonLabel - null uses the default
 */

/**
 * One kind of ticket, with its own button on the panel (e.g. "Unban Request").
 * @typedef {Object} TicketTypeType
 * @property {string} id - Stable ID used in the panel button, so renaming a type keeps old panels working
 * @property {string} label - Button text
 * @property {string | null} emoji - A Unicode emoji or a custom emoji from the server (<:name:id>)
 * @property {'primary' | 'secondary' | 'success' | 'danger'} style - Button colour
 * @property {string | null} description - Shown next to the type on the panel
 * @property {string | null} channelPrefix - Ticket channels are named <prefix>-0001 (null: "ticket")
 * @property {string | null} categoryId - null uses the server's ticket category
 * @property {string[]} staffRoleIds - Can see and manage this type, as well as the general staff roles
 * @property {string[]} allowedRoleIds - Only these roles can open this type (empty: everyone)
 * @property {string | null} openMessage - Shown in new tickets of this type (null uses the default)
 */

/**
 * A server's ticket settings.
 * @typedef {Object} TicketConfigType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {string | null} categoryId - Category new ticket channels are created in
 * @property {string | null} transcriptChannelId - Where transcripts of closed tickets are posted (null: not posted)
 * @property {string[]} staffRoleIds - Roles that can see and manage every ticket
 * @property {boolean} pingStaff - Mention the staff roles when a ticket is opened
 * @property {number} maxOpenPerUser
 * @property {boolean} ownerCanClose - Whether the person who opened a ticket can close it
 * @property {boolean} dmTranscript - Send the transcript to the ticket owner when it's closed
 * @property {string | null} openMessage - Shown in new tickets (null uses the default)
 * @property {TicketPanelType} panel
 * @property {TicketTypeType[]} ticketTypes - Empty: one default button (see utils/ticketTypes.js)
 * @property {number} lastTicketNumber - Counter for ticket numbers (internal)
 */

const PanelSchema = new Schema(
    {
        channelId: { type: String, default: null },
        messageId: { type: String, default: null },
        title: { type: String, default: null },
        description: { type: String, default: null },
        buttonLabel: { type: String, default: null },
    },
    { _id: false }
);

const TicketTypeSchema = new Schema(
    {
        id: { type: String, required: true },
        label: { type: String, required: true },
        emoji: { type: String, default: null },
        style: { type: String, enum: ['primary', 'secondary', 'success', 'danger'], default: 'primary' },
        description: { type: String, default: null },
        channelPrefix: { type: String, default: null },
        categoryId: { type: String, default: null },
        staffRoleIds: { type: [String], default: [] },
        allowedRoleIds: { type: [String], default: [] },
        openMessage: { type: String, default: null },
    },
    { _id: false }
);

const TicketConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    categoryId: { type: String, default: null },
    transcriptChannelId: { type: String, default: null },
    staffRoleIds: { type: [String], default: [] },
    pingStaff: { type: Boolean, default: true },
    maxOpenPerUser: { type: Number, default: 1 },
    ownerCanClose: { type: Boolean, default: true },
    dmTranscript: { type: Boolean, default: true },
    openMessage: { type: String, default: null },
    panel: { type: PanelSchema, default: () => ({}) },
    ticketTypes: { type: [TicketTypeSchema], default: [] },
    lastTicketNumber: { type: Number, default: 0 },
});

export const TicketConfig = model('Guild-Ticket-Config', TicketConfigSchema);
