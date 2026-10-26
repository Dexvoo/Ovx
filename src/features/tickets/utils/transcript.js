/**
 * HTML transcripts of closed tickets.
 *
 * Everything that came from Discord (names, messages, embed text, file names, links) is escaped before it goes
 * into the page, and the page has no scripts, so a message can't run code when the transcript is opened.
 */

/** Most messages saved in one transcript (fetched 100 at a time). */
export const TRANSCRIPT_MESSAGE_LIMIT = 5000;

/**
 * @typedef {Object} TranscriptMessage
 * @property {string} authorId
 * @property {string} authorName
 * @property {string} authorAvatar
 * @property {boolean} bot
 * @property {number} timestamp
 * @property {string} content
 * @property {{ name: string, url: string }[]} attachments
 * @property {{ title: string | null, description: string | null }[]} embeds
 */

/**
 * The parts of a Discord message a transcript keeps.
 * @param {import('discord.js').Message} message
 * @returns {TranscriptMessage}
 */
export function toTranscriptMessage(message) {
    return {
        authorId: message.author.id,
        authorName: message.member?.displayName ?? message.author.displayName ?? message.author.username,
        authorAvatar: message.author.displayAvatarURL({ extension: 'png', size: 64 }),
        bot: message.author.bot,
        timestamp: message.createdTimestamp,
        content: message.content,
        attachments: message.attachments.map((file) => ({ name: file.name, url: file.url })),
        embeds: message.embeds.map((embed) => ({ title: embed.title, description: embed.description })),
    };
}

/**
 * Fetches a channel's messages, oldest first.
 * @param {import('discord.js').GuildTextBasedChannel} channel
 * @param {number} [limit]
 * @returns {Promise<TranscriptMessage[]>}
 */
export async function fetchTranscriptMessages(channel, limit = TRANSCRIPT_MESSAGE_LIMIT) {
    const messages = [];
    let before;
    while (messages.length < limit) {
        const batch = await channel.messages.fetch({ limit: Math.min(100, limit - messages.length), before });
        if (batch.size === 0) break;
        messages.push(...batch.values());
        before = batch.lastKey();
        if (batch.size < 100) break;
    }
    return messages.reverse().map(toTranscriptMessage);
}

/**
 * @param {unknown} text
 */
export function escapeHtml(text) {
    return String(text ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Only http(s) links are kept, so a "javascript:" link can't sneak in.
 * @param {string} url
 */
function safeUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
    } catch {
        return null;
    }
}

/**
 * Message text with mentions shown as names, escaped for HTML.
 * @param {string} content
 * @param {Map<string, string>} names - User ID → name
 */
function formatContent(content, names) {
    const withNames = content.replace(/<@!?(\d{17,20})>/g, (match, id) => `@${names.get(id) ?? 'unknown user'}`);
    return escapeHtml(withNames);
}

/**
 * Builds the transcript page.
 * @param {{ guildName: string, ticketNumber: string, channelName: string, ownerName: string, closedByName: string,
 *   reason: string | null, openedAt: Date, closedAt: Date, messages: TranscriptMessage[], truncated?: boolean }} details
 * @returns {string}
 */
export function buildTranscriptHtml(details) {
    const names = new Map(details.messages.map((message) => [message.authorId, message.authorName]));
    const time = (value) => new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    const rows = details.messages
        .map((message) => {
            const avatar = safeUrl(message.authorAvatar);
            const attachments = message.attachments
                .map((file) => {
                    const url = safeUrl(file.url);
                    return url
                        ? `<a class="file" href="${escapeHtml(url)}" rel="noreferrer">📎 ${escapeHtml(file.name)}</a>`
                        : `<span class="file">📎 ${escapeHtml(file.name)}</span>`;
                })
                .join('');
            const embeds = message.embeds
                .filter((embed) => embed.title || embed.description)
                .map(
                    (embed) =>
                        `<div class="embed">${embed.title ? `<strong>${escapeHtml(embed.title)}</strong>` : ''}${
                            embed.description ? `<div>${formatContent(embed.description, names)}</div>` : ''
                        }</div>`
                )
                .join('');

            return `<div class="message">
<img class="avatar" src="${avatar ? escapeHtml(avatar) : ''}" alt="">
<div class="body">
<div class="meta"><span class="name">${escapeHtml(message.authorName)}</span>${message.bot ? '<span class="tag">APP</span>' : ''}<time>${time(message.timestamp)}</time></div>
${message.content ? `<div class="content">${formatContent(message.content, names)}</div>` : ''}${embeds}${attachments}
</div>
</div>`;
        })
        .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'">
<title>Ticket #${escapeHtml(details.ticketNumber)} | ${escapeHtml(details.guildName)}</title>
<style>
body { margin: 0; padding: 24px; background: #1e1f22; color: #dbdee1; font: 15px/1.45 system-ui, sans-serif; }
header { max-width: 900px; margin: 0 auto 24px; padding: 16px 20px; border-radius: 12px; background: #2b2d31; }
h1 { margin: 0 0 8px; font-size: 20px; color: #fff; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
dt { color: #949ba4; }
dd { margin: 0; }
main { max-width: 900px; margin: 0 auto; }
.message { display: flex; gap: 14px; padding: 8px 4px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: #2b2d31; flex-shrink: 0; }
.body { min-width: 0; }
.meta { display: flex; align-items: center; gap: 8px; }
.name { font-weight: 600; color: #fff; }
.tag { padding: 0 5px; border-radius: 4px; background: #5865f2; color: #fff; font-size: 11px; font-weight: 700; }
time { color: #949ba4; font-size: 12px; }
.content { white-space: pre-wrap; overflow-wrap: anywhere; }
.embed { margin-top: 4px; padding: 8px 12px; border-left: 4px solid #a78bfa; border-radius: 4px; background: #2b2d31; white-space: pre-wrap; overflow-wrap: anywhere; }
.file { display: inline-block; margin: 4px 8px 0 0; color: #00a8fc; }
.note { color: #949ba4; text-align: center; }
</style>
</head>
<body>
<header>
<h1>Ticket #${escapeHtml(details.ticketNumber)}</h1>
<dl>
<dt>Server</dt><dd>${escapeHtml(details.guildName)}</dd>
<dt>Channel</dt><dd>#${escapeHtml(details.channelName)}</dd>
<dt>Opened by</dt><dd>${escapeHtml(details.ownerName)}</dd>
<dt>Opened</dt><dd>${time(details.openedAt)}</dd>
<dt>Closed by</dt><dd>${escapeHtml(details.closedByName)}</dd>
<dt>Closed</dt><dd>${time(details.closedAt)}</dd>
<dt>Reason</dt><dd>${details.reason ? escapeHtml(details.reason) : 'None given'}</dd>
<dt>Messages</dt><dd>${details.messages.length}</dd>
</dl>
</header>
<main>
${details.truncated ? `<p class="note">Only the last ${details.messages.length} messages are included.</p>\n` : ''}${rows || '<p class="note">No messages.</p>'}
</main>
</body>
</html>
`;
}
