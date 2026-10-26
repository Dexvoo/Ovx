// Welcome & Goodbye page: messages posted when people join or leave.
import { el, apiSend, toast } from './ui.js';
import { card, field, toggle, channelSelect, textArea, createSettingsState, resetCard } from './forms.js';

const DEFAULT_COLOUR = '#71368a'; // Matches DEFAULT_EMBED_COLOUR in shared/cache/guildSettings.cache.js

const KINDS = [
    {
        kind: 'welcome',
        title: 'Welcome message',
        description: 'Posted when someone joins. Bots are not welcomed.',
        toggleLabel: 'Send welcome messages',
    },
    {
        kind: 'goodbye',
        title: 'Goodbye message',
        description: 'Posted when someone leaves. Nobody is pinged.',
        toggleLabel: 'Send goodbye messages',
    },
];

const PLACEHOLDERS = [
    ['{user}', 'Mention'],
    ['{username}', 'Username'],
    ['{displayName}', 'Display name'],
    ['{server}', 'Server name'],
    ['{memberCount}', 'Member count'],
];

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderWelcome(container, overview) {
    const { guild, channels, limits } = overview;

    const state = createSettingsState({
        saved: overview.welcome,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/welcome`, draft);
            if (status === 200) {
                overview.welcome = data;
                toast('Welcome messages saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/welcome`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.welcome = data;
        state.replaceSaved(data);
        render();
        toast('Welcome messages reset to defaults');
        return true;
    }

    /** @param {typeof KINDS[number]} config */
    function messageCard({ kind, title, description, toggleLabel }) {
        const settings = state.draft[kind];
        const defaultText = overview.welcomeDefaults[kind];
        const preview = el('div', { className: 'message-preview' });
        const updatePreview = () => preview.replaceChildren(renderPreview(kind, settings, defaultText, overview));

        const changed = () => {
            updatePreview();
            state.changed();
        };

        const message = textArea({
            id: `${kind}-message`,
            value: settings.message,
            maxLength: limits.WELCOME.MESSAGE_MAX,
            placeholder: defaultText,
            onChange: (value) => {
                settings.message = value || null; // Empty means the default, same as when saved
                changed();
            },
        });
        const messageInput = /** @type {HTMLTextAreaElement} */ (message.querySelector('textarea'));

        // Clicking a placeholder inserts it where the cursor is
        const placeholderButtons = el(
            'div',
            { className: 'placeholder-list' },
            PLACEHOLDERS.map(([token, label]) => {
                const button = el('button', {
                    type: 'button',
                    className: 'placeholder-chip',
                    textContent: token,
                    title: `Insert ${label.toLowerCase()}`,
                });
                button.addEventListener('click', () => {
                    if (!messageInput.value) messageInput.value = defaultText; // Start from the default
                    const start = messageInput.selectionStart ?? messageInput.value.length;
                    const end = messageInput.selectionEnd ?? start;
                    messageInput.setRangeText(token, start, end, 'end');
                    messageInput.dispatchEvent(new Event('input'));
                    messageInput.focus();
                });
                return button;
            })
        );

        const titleInput = el('input', {
            className: 'input input-wide',
            id: `${kind}-title`,
            type: 'text',
            value: settings.title ?? '',
            maxLength: limits.WELCOME.TITLE_MAX,
            placeholder: 'No title',
        });
        titleInput.addEventListener('input', () => {
            settings.title = titleInput.value || null;
            changed();
        });
        const titleField = field({
            label: 'Embed title',
            description: 'Optional. Placeholders work here too.',
            id: `${kind}-title`,
            stacked: true,
            control: titleInput,
        });
        titleField.hidden = !settings.embed;

        updatePreview();

        return card(title, description, [
            field({
                label: toggleLabel,
                id: `${kind}-enabled`,
                control: toggle({
                    id: `${kind}-enabled`,
                    label: toggleLabel,
                    checked: settings.enabled,
                    onChange: (enabled) => {
                        settings.enabled = enabled;
                        state.changed();
                    },
                }),
            }),
            field({
                label: 'Channel',
                description: 'Ovx needs to be able to post in it.',
                control: channelSelect({
                    channels,
                    value: settings.channelId,
                    noneLabel: 'Choose a channel',
                    onChange: (channelId) => {
                        settings.channelId = channelId;
                        if (!channelId) settings.enabled = false;
                        state.changed();
                        render();
                    },
                }),
            }),
            field({
                label: 'Message',
                description: 'Leave empty to use the default shown in the box. Click a placeholder to add it.',
                id: `${kind}-message`,
                stacked: true,
                control: el('div', {}, [message, placeholderButtons]),
            }),
            field({
                label: 'Send as an embed',
                description: 'Puts the message in a box with their avatar, in your embed colour.',
                id: `${kind}-embed`,
                control: toggle({
                    id: `${kind}-embed`,
                    label: 'Send as an embed',
                    checked: settings.embed,
                    onChange: (embed) => {
                        settings.embed = embed;
                        titleField.hidden = !embed;
                        changed();
                    },
                }),
            }),
            titleField,
            el('div', { className: 'preview-label', textContent: 'Preview' }),
            preview,
        ]);
    }

    function render() {
        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Welcome & Goodbye' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent: 'Greet people when they join, and say goodbye when they leave.',
                }),
            ]),
            ...KINDS.map(messageCard),
            resetCard({
                description: 'Switches both messages off and clears their channels and text.',
                confirmMessage:
                    'Welcome and goodbye messages will be switched off, and their channels, text and embed settings cleared. This cannot be undone.',
                onReset: resetToDefaults,
            }),
            state.bar
        );

        // A message can only be switched on once it has a channel
        for (const { kind } of KINDS) {
            const input = /** @type {HTMLInputElement | null} */ (container.querySelector(`#${kind}-enabled`));
            if (input) input.disabled = !state.draft[kind].channelId;
        }
        state.changed();
    }

    render();
    return () => state.dispose();
}

/**
 * A Discord-style preview of the message, with sample values for the placeholders.
 * Built from DOM nodes only (never HTML strings), since the text is typed by users.
 * @param {string} kind - 'welcome' or 'goodbye'
 * @param {any} settings
 * @param {string} defaultText
 * @param {any} overview
 */
function renderPreview(kind, settings, defaultText, overview) {
    const { guild, bot } = overview;
    const sample = {
        username: 'new_member',
        displayName: 'New Member',
        server: guild.name,
        memberCount: (guild.memberCount + (kind === 'welcome' ? 1 : -1)).toLocaleString('en-US'),
    };
    const text = settings.message?.trim() || defaultText;

    const author = el('div', { className: 'preview-author' }, [
        el('span', { className: 'preview-name', textContent: bot.nickname || bot.username }),
        el('span', { className: 'bot-preview-tag', textContent: 'APP' }),
    ]);

    let body;
    if (settings.embed) {
        const embed = el('div', { className: 'preview-embed' }, [
            el('div', { className: 'preview-embed-text' }, [
                settings.title?.trim() &&
                    el('div', { className: 'preview-embed-title' }, formatText(settings.title.trim(), sample)),
                el('div', {}, formatText(text, sample)),
            ]),
            el('img', {
                className: 'preview-embed-thumb',
                src: 'https://cdn.discordapp.com/embed/avatars/3.png',
                alt: '',
            }),
        ]);
        embed.style.borderLeftColor = bot.embedColour ?? DEFAULT_COLOUR;
        body = [kind === 'welcome' && el('div', {}, [mention(sample.displayName)]), embed];
    } else {
        body = [el('div', { className: 'preview-text' }, formatText(text, sample))];
    }

    return el('div', { className: 'preview-message' }, [
        el('img', { className: 'preview-avatar', src: bot.avatar, alt: '' }),
        el('div', { className: 'preview-content' }, [author, ...body]),
    ]);
}

/** @param {string} name */
function mention(name) {
    return el('span', { className: 'preview-mention', textContent: `@${name}` });
}

/**
 * Fills placeholders with sample values and shows **bold** text, as Discord would.
 * @param {string} text
 * @param {{ username: string, displayName: string, server: string, memberCount: string }} sample
 * @returns {Node[]}
 */
function formatText(text, sample) {
    const nodes = [];
    for (const part of text.split(/(\{user\}|\*\*[^*]+\*\*)/g)) {
        if (!part) continue;
        if (part === '{user}') nodes.push(mention(sample.displayName));
        else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            nodes.push(el('strong', {}, formatText(part.slice(2, -2), sample)));
        } else {
            const filled = part
                .replaceAll('{username}', sample.username)
                .replaceAll('{displayName}', sample.displayName)
                .replaceAll('{server}', sample.server)
                .replaceAll('{memberCount}', sample.memberCount);
            nodes.push(document.createTextNode(filled));
        }
    }
    return nodes;
}
