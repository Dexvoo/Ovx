// Discord-style formatting for previews: **bold**, headings, quotes, lists, code, spoilers, links, mentions,
// custom emojis and timestamps. Everything is built as DOM nodes with textContent, never HTML, so text typed
// on the dashboard can't inject anything into the page.
import { el } from './ui.js';
import { emojiNode } from './ticketTypes.js';

/**
 * What mentions should show as.
 * @typedef {Object} MarkdownContext
 * @property {Map<string, { name: string, color?: string }>} [roles]
 * @property {Map<string, string>} [channels] - ID → name
 */

const dateTime = (options) => new Intl.DateTimeFormat(undefined, options);
const TIMESTAMP_FORMATS = {
    t: dateTime({ timeStyle: 'short' }),
    T: dateTime({ timeStyle: 'medium' }),
    d: dateTime({ dateStyle: 'short' }),
    D: dateTime({ dateStyle: 'long' }),
    f: dateTime({ dateStyle: 'long', timeStyle: 'short' }),
    F: dateTime({ dateStyle: 'full', timeStyle: 'short' }),
};
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "in 3 hours", "2 days ago", like Discord's <t:...:R> */
function relativeTime(date) {
    const seconds = (date.getTime() - Date.now()) / 1000;
    /** @type {[Intl.RelativeTimeFormatUnit, number][]} */
    const units = [
        ['year', 31_536_000],
        ['month', 2_592_000],
        ['day', 86_400],
        ['hour', 3600],
        ['minute', 60],
    ];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
    }
    return relative.format(Math.round(seconds), 'second');
}

const pill = (text, colour) => {
    const node = el('span', { className: 'preview-mention', textContent: text });
    if (colour && colour !== '#000000') {
        node.style.color = colour;
        node.style.backgroundColor = `color-mix(in srgb, ${colour} 18%, transparent)`;
    }
    return node;
};

/**
 * Inline rules, tried in order at each position. Each returns the node for its match.
 * @type {[RegExp, (match: RegExpExecArray, ctx: MarkdownContext) => Node][]}
 */
const INLINE = [
    [/^\\([^\w\s])/, (m) => document.createTextNode(m[1])],
    [/^`([^`]+)`/, (m) => el('code', { className: 'md-code', textContent: m[1] })],
    [/^\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/, (m, ctx) => el('strong', {}, [el('em', {}, inline(m[1], ctx))])],
    [/^\*\*(?=\S)([\s\S]*?\S)\*\*/, (m, ctx) => el('strong', {}, inline(m[1], ctx))],
    [/^__(?=\S)([\s\S]*?\S)__/, (m, ctx) => el('u', {}, inline(m[1], ctx))],
    [/^\*(?=\S)([\s\S]*?\S)\*(?!\*)/, (m, ctx) => el('em', {}, inline(m[1], ctx))],
    [/^_(?=\S)([\s\S]*?\S)_(?!\w)/, (m, ctx) => el('em', {}, inline(m[1], ctx))],
    [/^~~(?=\S)([\s\S]*?\S)~~/, (m, ctx) => el('s', {}, inline(m[1], ctx))],
    [/^\|\|([\s\S]+?)\|\|/, (m, ctx) => el('span', { className: 'md-spoiler', title: 'Spoiler' }, inline(m[1], ctx))],
    [
        /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/,
        (m, ctx) => el('span', { className: 'md-link', title: m[2] }, inline(m[1], ctx)),
    ],
    [/^<a?:\w+:\d+>/, (m) => emojiNode(m[0])],
    [/^<@!?(\d+)>/, () => pill('@user')],
    [
        /^<@&(\d+)>/,
        (m, ctx) => {
            const role = ctx.roles?.get(m[1]);
            return pill(`@${role?.name ?? 'unknown-role'}`, role?.color);
        },
    ],
    [/^<#(\d+)>/, (m, ctx) => pill(`#${ctx.channels?.get(m[1]) ?? 'unknown-channel'}`)],
    [
        /^<t:(-?\d{1,13})(?::([tTdDfFR]))?>/,
        (m) => {
            const date = new Date(Number(m[1]) * 1000);
            const text = m[2] === 'R' ? relativeTime(date) : TIMESTAMP_FORMATS[m[2] ?? 'f'].format(date);
            return el('span', { className: 'md-timestamp', textContent: text });
        },
    ],
    [/^@(everyone|here)\b/, (m) => pill(`@${m[1]}`)],
    [/^https?:\/\/[^\s<]+[^\s<.,:;"')\]]/, (m) => el('span', { className: 'md-link', textContent: m[0] })],
];

/**
 * Formatting within a line: bold, italic, code, links, mentions and so on.
 * @param {string} text
 * @param {MarkdownContext} [ctx]
 * @returns {Node[]}
 */
export function inline(text, ctx = {}) {
    const nodes = [];
    let plain = '';
    let index = 0;
    outer: while (index < text.length) {
        const rest = text.slice(index);
        for (const [pattern, build] of INLINE) {
            const match = pattern.exec(rest);
            if (!match) continue;
            if (plain) nodes.push(document.createTextNode(plain));
            plain = '';
            nodes.push(build(match, ctx));
            index += match[0].length;
            continue outer;
        }
        plain += text[index];
        index++;
    }
    if (plain) nodes.push(document.createTextNode(plain));
    return nodes;
}

/**
 * Lines of text: headings, quotes, lists and plain lines (each with inline formatting).
 * @param {string[]} lines
 * @param {MarkdownContext} ctx
 * @returns {Node[]}
 */
function blocks(lines, ctx) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // ">>> " quotes everything after it
        if (line.startsWith('>>> ')) {
            out.push(el('div', { className: 'md-quote' }, blocks([line.slice(4), ...lines.slice(i + 1)], ctx)));
            break;
        }
        // "> " quotes this line, and the quoted lines right after it
        if (/^> /.test(line) || line === '>') {
            const quoted = [];
            while (i < lines.length && (/^> /.test(lines[i]) || lines[i] === '>')) quoted.push(lines[i++].slice(2));
            i--;
            out.push(el('div', { className: 'md-quote' }, blocks(quoted, ctx)));
            continue;
        }

        const heading = /^(#{1,3}) (.+)$/.exec(line);
        if (heading) {
            out.push(el('div', { className: `md-h${heading[1].length}` }, inline(heading[2], ctx)));
            continue;
        }
        const subtext = /^-# (.+)$/.exec(line);
        if (subtext) {
            out.push(el('div', { className: 'md-subtext' }, inline(subtext[1], ctx)));
            continue;
        }
        const bullet = /^(\s*)[-*] (.+)$/.exec(line);
        if (bullet) {
            const item = el('div', { className: 'md-li' }, [
                el('span', { className: 'md-bullet', textContent: '•' }),
                el('span', {}, inline(bullet[2], ctx)),
            ]);
            item.style.marginLeft = `${Math.min(bullet[1].length, 4) * 8}px`;
            out.push(item);
            continue;
        }
        const numbered = /^(\s*)(\d{1,3})\. (.+)$/.exec(line);
        if (numbered) {
            out.push(
                el('div', { className: 'md-li' }, [
                    el('span', { className: 'md-bullet', textContent: `${numbered[2]}.` }),
                    el('span', {}, inline(numbered[3], ctx)),
                ])
            );
            continue;
        }

        out.push(el('div', { className: 'md-line' }, line ? inline(line, ctx) : [el('br')]));
    }
    return out;
}

/**
 * A whole message or embed description, formatted like Discord shows it.
 * @param {string} text
 * @param {MarkdownContext} [ctx]
 * @returns {Node[]}
 */
export function markdown(text, ctx = {}) {
    const out = [];
    const codeBlock = /```(?:([\w+-]+)\n)?([\s\S]*?)```/g;
    let last = 0;
    let match;
    const textPart = (part) => {
        // Discord drops the line break right before and after a code block
        const trimmed = part.replace(/^\n/, '').replace(/\n$/, '');
        if (trimmed || part === '') out.push(...blocks(trimmed.split('\n'), ctx));
    };
    while ((match = codeBlock.exec(text)) !== null) {
        if (match.index > last) textPart(text.slice(last, match.index));
        out.push(el('pre', { className: 'md-codeblock' }, [el('code', { textContent: match[2].replace(/\n$/, '') })]));
        last = match.index + match[0].length;
    }
    if (last < text.length) textPart(text.slice(last));
    return out;
}

/**
 * Mention names from the dashboard's server overview.
 * @param {any} overview
 * @returns {MarkdownContext}
 */
export function markdownContext(overview) {
    return {
        roles: new Map(overview.roles.map((role) => [role.id, { name: role.name, color: role.color }])),
        channels: new Map(overview.channels.map((channel) => [channel.id, channel.name])),
    };
}
