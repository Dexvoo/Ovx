// Custom Embeds page: build a message (text, an embed, link buttons) with a live preview, post it, and edit it later.
import { el, api, apiSend, toast } from './ui.js';
import { card, field, channelSelect, textArea, toggle, confirmDialog } from './forms.js';
import { emojiNode, emojiPicker } from './ticketTypes.js';
import { markdown, inline, markdownContext } from './markdown.js';

const DEFAULT_COLOUR = '#71368a'; // Matches DEFAULT_EMBED_COLOUR in shared/cache/guildSettings.cache.js
/** Image hosts the dashboard is allowed to load (see the Content Security Policy in server.js) */
const PREVIEWABLE_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

const emptyMessage = () => ({
    id: null,
    name: 'New message',
    channelId: null,
    content: '',
    embed: {
        title: '',
        url: '',
        description: '',
        colour: null,
        author: { name: '', iconUrl: '', url: '' },
        fields: [],
        thumbnailUrl: '',
        imageUrl: '',
        footer: { text: '', iconUrl: '' },
        timestamp: false,
    },
    buttons: [],
    allowPings: false,
});

/** Discord counts these together towards an embed's 6000-character limit. */
function embedLength(embed) {
    const count = (text) => [...(text ?? '')].length;
    return (
        count(embed.title) +
        count(embed.description) +
        count(embed.author.name) +
        count(embed.footer.text) +
        embed.fields.reduce((sum, item) => sum + count(item.name) + count(item.value), 0)
    );
}

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderCustomEmbeds(container, overview) {
    const { guild, channels } = overview;
    const limits = overview.limits.CUSTOM_EMBEDS;
    const channelName = (id) => `#${channels.find((channel) => channel.id === id)?.name ?? 'deleted-channel'}`;
    // Role and channel names for mentions in the preview
    const mentions = markdownContext(overview);
    const timeNow = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

    let messages = [];
    let loaded = false;
    /** The message being edited (a copy), or null when showing the list */
    let editing = null;
    let saving = false;
    let errors = [];

    const body = el('div');
    /** Replaces the page body; skips the false left by conditional parts (`cond && element`). */
    const show = (...nodes) => body.replaceChildren(...nodes.filter(Boolean));

    // ---------- List ----------

    async function load() {
        const { status, data } = await api(`/api/guilds/${guild.id}/custom-embeds`);
        if (status !== 200) return toast(data?.error ?? 'Could not load custom messages.', 'error');
        messages = data.messages;
        loaded = true;
        if (!editing) render();
    }

    async function remove(message) {
        const confirmed = await confirmDialog({
            title: `Delete “${message.name}”?`,
            message: 'The message is deleted from Discord too.',
            confirmLabel: 'Delete message',
        });
        if (!confirmed) return;
        const { status, data } = await apiSend('DELETE', `/api/guilds/${guild.id}/custom-embeds/${message.id}`, {});
        if (status !== 200 && status !== 404) return toast(data?.error ?? 'Could not delete it.', 'error');
        messages = messages.filter((item) => item.id !== message.id);
        toast('Message deleted');
        render();
    }

    function messageRow(message) {
        const button = (label, onClick, danger = false) => {
            const element = el('button', {
                type: 'button',
                className: `button ${danger ? 'button-danger-ghost' : 'button-ghost'} button-small`,
                textContent: label,
            });
            element.addEventListener('click', onClick);
            return element;
        };
        const preview = message.embed.title || message.embed.description || message.content || '';
        return el('article', { className: 'giveaway-row' }, [
            el('div', { className: 'giveaway-main' }, [
                el('div', { className: 'giveaway-title-line' }, [
                    message.messageUrl
                        ? el('a', {
                              className: 'giveaway-prize',
                              href: message.messageUrl,
                              target: '_blank',
                              rel: 'noopener',
                              textContent: message.name,
                          })
                        : el('span', { className: 'giveaway-prize', textContent: message.name }),
                ]),
                el('p', {
                    className: 'case-meta',
                    textContent: `${channelName(message.channelId)}${message.posted ? '' : ' · not posted'}`,
                }),
                preview && el('p', { className: 'case-meta', textContent: preview.slice(0, 120) }),
            ]),
            el('div', { className: 'giveaway-actions' }, [
                button('Edit', () => startEditing(message)),
                button('Duplicate', () =>
                    startEditing({
                        ...structuredClone(message),
                        id: null,
                        name: `${message.name} (copy)`.slice(0, limits.NAME_MAX),
                    })
                ),
                button('Delete', () => remove(message), true),
            ]),
        ]);
    }

    function renderList() {
        const create = el('button', {
            type: 'button',
            className: 'button button-primary',
            textContent: '+ New message',
            disabled: !loaded || messages.length >= limits.MESSAGES_MAX,
        });
        create.addEventListener('click', () => startEditing(null));
        show(
            card(
                'Messages',
                'Messages Ovx has posted for you. Editing one updates it in Discord, so announcements and rules stay current.',
                [
                    !loaded
                        ? el('p', { className: 'empty-note', textContent: 'Loading…' })
                        : messages.length === 0
                          ? el('p', { className: 'empty-note', textContent: 'No messages yet.' })
                          : el('div', { className: 'giveaway-list' }, messages.map(messageRow)),
                    el('div', { className: 'card-actions' }, [create]),
                ]
            )
        );
    }

    // ---------- Editor ----------

    function startEditing(message) {
        editing = message ? structuredClone(message) : emptyMessage();
        // Inputs work with empty text rather than null
        const blank = (value) => value ?? '';
        const { embed } = editing;
        editing.content = blank(editing.content);
        for (const key of ['title', 'url', 'description', 'thumbnailUrl', 'imageUrl']) embed[key] = blank(embed[key]);
        for (const key of ['name', 'iconUrl', 'url']) embed.author[key] = blank(embed.author[key]);
        for (const key of ['text', 'iconUrl']) embed.footer[key] = blank(embed.footer[key]);
        errors = [];
        render();
        container.scrollIntoView({ block: 'start' });
    }

    async function save() {
        if (saving) return;
        saving = true;
        errors = [];
        render();
        const payload = {
            name: editing.name,
            channelId: editing.channelId,
            content: editing.content,
            embed: editing.embed,
            buttons: editing.buttons,
            allowPings: editing.allowPings,
        };
        const { status, data } = editing.id
            ? await apiSend('PUT', `/api/guilds/${guild.id}/custom-embeds/${editing.id}`, payload)
            : await apiSend('POST', `/api/guilds/${guild.id}/custom-embeds`, payload);
        saving = false;
        if (status !== 200) {
            errors = data?.details ?? [data?.error ?? 'Could not save. Try again.'];
            return render();
        }
        const saved = data.message;
        messages = [saved, ...messages.filter((item) => item.id !== saved.id)];
        if (data.warning) toast(`Saved, but not posted: ${data.warning}`, 'error');
        else toast(editing.id ? 'Message updated' : 'Message posted');
        editing = null;
        render();
    }

    /**
     * A text input bound to obj[key] that refreshes the preview as you type.
     * @param {any} obj
     * @param {string} key
     * @param {{ max?: number, placeholder?: string, id?: string, type?: string }} [options]
     */
    function input(obj, key, { max = limits.URL_MAX, placeholder, id, type = 'text' } = {}) {
        // max must always be a number: maxLength = undefined becomes 0, which blocks all typing
        const element = el('input', {
            className: 'input input-wide',
            type,
            id,
            value: obj[key] ?? '',
            maxLength: max,
            placeholder,
        });
        element.addEventListener('input', () => {
            obj[key] = element.value;
            refreshPreview();
        });
        return element;
    }

    function image(url, className) {
        try {
            const { hostname } = new URL(url);
            if (PREVIEWABLE_HOSTS.has(hostname)) return el('img', { className, src: url, alt: '' });
            return el('div', { className: `${className} preview-image-placeholder`, textContent: `🖼 ${hostname}` });
        } catch {
            return null;
        }
    }

    function preview() {
        const { embed } = editing;
        const colour = embed.colour ?? overview.bot.embedColour ?? DEFAULT_COLOUR;
        const hasEmbed =
            embed.title ||
            embed.description ||
            embed.author.name ||
            embed.footer.text ||
            embed.imageUrl ||
            embed.thumbnailUrl ||
            embed.fields.length;

        const fields = embed.fields.map((item) =>
            el('div', { className: `preview-field${item.inline ? ' preview-field-inline' : ''}` }, [
                el('div', { className: 'preview-field-name' }, inline(item.name || 'Field name', mentions)),
                el('div', { className: 'preview-text' }, markdown(item.value || 'Field text', mentions)),
            ])
        );
        // Footers aren't formatted in Discord, so this stays plain text
        const footerText = [embed.footer.text, embed.timestamp && `Today at ${timeNow.format(new Date())}`]
            .filter(Boolean)
            .join(' • ');

        const embedBox =
            hasEmbed &&
            el('div', { className: 'preview-embed' }, [
                el('div', { className: 'preview-embed-text' }, [
                    embed.author.name &&
                        el('div', { className: 'preview-embed-author' }, [
                            embed.author.iconUrl && image(embed.author.iconUrl, 'preview-embed-icon'),
                            el('span', { textContent: embed.author.name }),
                        ]),
                    embed.title &&
                        el(
                            'div',
                            { className: `preview-embed-title${embed.url ? ' preview-embed-link' : ''}` },
                            inline(embed.title, mentions)
                        ),
                    embed.description && el('div', {}, markdown(embed.description, mentions)),
                    fields.length > 0 && el('div', { className: 'preview-fields' }, fields),
                    embed.imageUrl && image(embed.imageUrl, 'preview-embed-image'),
                    footerText &&
                        el('div', { className: 'preview-embed-footer' }, [
                            embed.footer.iconUrl && image(embed.footer.iconUrl, 'preview-embed-icon'),
                            el('span', { textContent: footerText }),
                        ]),
                ]),
                embed.thumbnailUrl && image(embed.thumbnailUrl, 'preview-embed-thumb'),
            ]);
        if (embedBox) embedBox.style.borderLeftColor = colour;

        return el('div', { className: 'preview-message' }, [
            el('img', { className: 'preview-avatar', src: overview.bot.avatar, alt: '' }),
            el('div', { className: 'preview-content' }, [
                el('div', { className: 'preview-author' }, [
                    el('span', {
                        className: 'preview-name',
                        textContent: overview.bot.nickname || overview.bot.username,
                    }),
                    el('span', { className: 'bot-preview-tag', textContent: 'APP' }),
                ]),
                editing.content && el('div', { className: 'preview-text' }, markdown(editing.content, mentions)),
                embedBox,
                editing.buttons.length > 0 &&
                    el(
                        'div',
                        { className: 'preview-buttons' },
                        editing.buttons.map((button) =>
                            el('span', { className: 'preview-button preview-button-secondary' }, [
                                button.emoji && emojiNode(button.emoji),
                                button.label && el('span', { textContent: button.label }),
                                el('span', { textContent: '↗', 'aria-hidden': 'true' }),
                            ])
                        )
                    ),
                !editing.content &&
                    !hasEmbed &&
                    el('p', { className: 'empty-note', textContent: 'Add some text or fill in the embed.' }),
            ]),
        ]);
    }

    const previewHost = el('div');
    const counter = el('p', { className: 'field-description' });
    const refreshPreview = () => {
        previewHost.replaceChildren(preview());
        const used = embedLength(editing.embed);
        counter.textContent = `Embed text: ${used.toLocaleString()} / ${limits.EMBED_TOTAL_MAX.toLocaleString()} characters`;
        counter.classList.toggle('over-limit', used > limits.EMBED_TOTAL_MAX);
    };

    const iconButton = (label, text, onClick, disabled = false) => {
        const element = el('button', {
            type: 'button',
            className: 'icon-button',
            textContent: text,
            title: label,
            'aria-label': label,
            disabled,
        });
        element.addEventListener('click', onClick);
        return element;
    };

    function fieldCard(item, index) {
        const list = editing.embed.fields;
        const move = (by) => {
            list.splice(index, 1);
            list.splice(index + by, 0, item);
            render();
        };
        const inlineId = `ce-inline-${index}`;
        return el('div', { className: 'type-card' }, [
            el('div', { className: 'type-row' }, [
                el('input', {
                    className: 'input type-label',
                    type: 'text',
                    value: item.name,
                    maxLength: limits.FIELD_NAME_MAX,
                    placeholder: 'Field name',
                    'aria-label': `Field ${index + 1} name`,
                }),
                el('label', { className: 'checkbox-label', for: inlineId }, [
                    el('input', { type: 'checkbox', id: inlineId, checked: item.inline }),
                    ' Side by side',
                ]),
                el('div', { className: 'type-actions' }, [
                    iconButton('Move up', '▲', () => move(-1), index === 0),
                    iconButton('Move down', '▼', () => move(1), index === list.length - 1),
                    iconButton('Remove', '✕', () => {
                        list.splice(index, 1);
                        render();
                    }),
                ]),
            ]),
            textArea({
                value: item.value,
                maxLength: limits.FIELD_VALUE_MAX,
                placeholder: 'Field text',
                onChange: (value) => {
                    item.value = value;
                    refreshPreview();
                },
            }),
        ]);
    }

    /** Wires the name input and inline checkbox of each field card (el() takes no event props). */
    function bindFieldCards(host) {
        host.querySelectorAll('.type-card').forEach((cardElement, index) => {
            const item = editing.embed.fields[index];
            const nameInput = /** @type {HTMLInputElement} */ (cardElement.querySelector('input[type=text]'));
            const inline = /** @type {HTMLInputElement} */ (cardElement.querySelector('input[type=checkbox]'));
            nameInput.addEventListener('input', () => {
                item.name = nameInput.value;
                refreshPreview();
            });
            inline.addEventListener('change', () => {
                item.inline = inline.checked;
                refreshPreview();
            });
        });
    }

    function buttonCard(button, index) {
        const emojiButton = el('button', {
            type: 'button',
            className: 'emoji-button',
            title: 'Choose an emoji',
            'aria-label': 'Choose an emoji',
        });
        const showEmoji = () =>
            emojiButton.replaceChildren(
                button.emoji
                    ? emojiNode(button.emoji)
                    : el('span', { className: 'emoji-placeholder', textContent: '＋' })
            );
        showEmoji();
        const picker = emojiPicker({
            emojis: overview.emojis,
            onPick: (emoji) => {
                button.emoji = emoji;
                showEmoji();
                refreshPreview();
            },
        });
        emojiButton.addEventListener('click', () => picker.toggle(emojiButton));

        const label = input(button, 'label', { max: limits.BUTTON_LABEL_MAX, placeholder: 'Label' });
        label.className = 'input type-label';
        const url = input(button, 'url', { placeholder: 'https://…', type: 'url' });
        url.className = 'input type-label';

        return el('div', { className: 'type-card' }, [
            el('div', { className: 'type-row' }, [
                emojiButton,
                label,
                url,
                el('div', { className: 'type-actions' }, [
                    iconButton('Remove', '✕', () => {
                        editing.buttons.splice(index, 1);
                        render();
                    }),
                ]),
            ]),
            picker.element,
        ]);
    }

    function renderEditor() {
        const { embed } = editing;

        const colourInput = el('input', {
            className: 'colour-input',
            type: 'color',
            value: embed.colour ?? overview.bot.embedColour ?? DEFAULT_COLOUR,
            'aria-label': 'Embed colour',
            disabled: embed.colour === null,
        });
        colourInput.addEventListener('input', () => {
            embed.colour = colourInput.value;
            refreshPreview();
        });
        const serverColour = el('input', { type: 'checkbox', id: 'ce-server-colour', checked: embed.colour === null });
        serverColour.addEventListener('change', () => {
            embed.colour = serverColour.checked ? null : colourInput.value;
            colourInput.disabled = serverColour.checked;
            refreshPreview();
        });

        const addField = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: '+ Add field',
            disabled: embed.fields.length >= limits.FIELDS_MAX,
        });
        addField.addEventListener('click', () => {
            embed.fields.push({ name: '', value: '', inline: false });
            render();
        });
        const addButton = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: '+ Add link button',
            disabled: editing.buttons.length >= limits.BUTTONS_MAX,
        });
        addButton.addEventListener('click', () => {
            editing.buttons.push({ label: '', url: '', emoji: null });
            render();
        });

        const saveButton = el('button', {
            type: 'button',
            className: 'button button-primary',
            textContent: saving ? 'Saving…' : editing.id ? 'Save and update message' : 'Save and post',
            disabled: saving,
        });
        saveButton.addEventListener('click', save);
        const cancel = el('button', { type: 'button', className: 'button button-ghost', textContent: 'Cancel' });
        cancel.addEventListener('click', () => {
            editing = null;
            render();
        });

        const fieldList = el('div', { className: 'type-list' }, embed.fields.map(fieldCard));
        bindFieldCards(fieldList);
        refreshPreview();

        show(
            card(editing.id ? 'Edit message' : 'New message', null, [
                field({
                    label: 'Name',
                    description: 'Only shown here, to tell your messages apart.',
                    id: 'ce-name',
                    control: input(editing, 'name', { max: limits.NAME_MAX, id: 'ce-name' }),
                }),
                field({
                    label: 'Channel',
                    description: editing.id ? 'Changing it moves the message: the old one is deleted.' : undefined,
                    id: 'ce-channel',
                    control: channelSelect({
                        channels,
                        value: editing.channelId,
                        noneLabel: 'Choose a channel',
                        id: 'ce-channel',
                        onChange: (id) => (editing.channelId = id),
                    }),
                }),
                field({
                    label: 'Message text',
                    description: 'Shown above the embed. Supports Discord formatting like **bold** and mentions.',
                    stacked: true,
                    control: textArea({
                        value: editing.content,
                        maxLength: limits.CONTENT_MAX,
                        onChange: (value) => {
                            editing.content = value;
                            refreshPreview();
                        },
                    }),
                }),
                field({
                    label: 'Allow pings',
                    description:
                        'Off: mentions are shown but nobody is notified. On: @mentions, roles and @everyone ping.',
                    id: 'ce-pings',
                    control: toggle({
                        id: 'ce-pings',
                        label: 'Allow pings',
                        checked: editing.allowPings,
                        onChange: (checked) => (editing.allowPings = checked),
                    }),
                }),
            ]),
            card('Embed', 'Leave it all empty to send only the message text.', [
                field({
                    label: 'Colour',
                    control: el('div', { className: 'inline-controls' }, [
                        colourInput,
                        el('label', { className: 'checkbox-label', for: 'ce-server-colour' }, [
                            serverColour,
                            ' Use the server’s embed colour',
                        ]),
                    ]),
                }),
                field({
                    label: 'Author',
                    id: 'ce-author',
                    control: input(embed.author, 'name', { max: limits.AUTHOR_MAX, id: 'ce-author' }),
                }),
                field({
                    label: 'Author icon',
                    description: 'An image link.',
                    control: input(embed.author, 'iconUrl', { placeholder: 'https://…', type: 'url' }),
                }),
                field({
                    label: 'Author link',
                    control: input(embed.author, 'url', { placeholder: 'https://…', type: 'url' }),
                }),
                field({
                    label: 'Title',
                    id: 'ce-title',
                    control: input(embed, 'title', { max: limits.TITLE_MAX, id: 'ce-title' }),
                }),
                field({
                    label: 'Title link',
                    description: 'Makes the title clickable.',
                    control: input(embed, 'url', { placeholder: 'https://…', type: 'url' }),
                }),
                field({
                    label: 'Description',
                    stacked: true,
                    control: textArea({
                        value: embed.description,
                        maxLength: limits.DESCRIPTION_MAX,
                        onChange: (value) => {
                            embed.description = value;
                            refreshPreview();
                        },
                    }),
                }),
                field({
                    label: 'Thumbnail',
                    description: 'A small image in the top right.',
                    control: input(embed, 'thumbnailUrl', { placeholder: 'https://…', type: 'url' }),
                }),
                field({
                    label: 'Image',
                    description: 'A large image at the bottom.',
                    control: input(embed, 'imageUrl', { placeholder: 'https://…', type: 'url' }),
                }),
                field({ label: 'Footer', control: input(embed.footer, 'text', { max: limits.FOOTER_MAX }) }),
                field({
                    label: 'Footer icon',
                    control: input(embed.footer, 'iconUrl', { placeholder: 'https://…', type: 'url' }),
                }),
                field({
                    label: 'Timestamp',
                    description: 'Shows when the message was posted, in each reader’s own time.',
                    id: 'ce-time',
                    control: toggle({
                        id: 'ce-time',
                        label: 'Timestamp',
                        checked: embed.timestamp,
                        onChange: (checked) => {
                            embed.timestamp = checked;
                            refreshPreview();
                        },
                    }),
                }),
                counter,
            ]),
            card('Fields', 'Titled blocks of text. Side-by-side fields sit up to three in a row.', [
                fieldList,
                el('div', { className: 'card-actions' }, [addField]),
            ]),
            card('Link buttons', 'Buttons under the message that open a website.', [
                el('div', { className: 'type-list' }, editing.buttons.map(buttonCard)),
                el('div', { className: 'card-actions' }, [addButton]),
            ]),
            card('Preview', 'Images from outside Discord show as placeholders here, but appear in Discord.', [
                previewHost,
            ]),
            errors.length > 0 &&
                el(
                    'ul',
                    { className: 'form-errors', role: 'alert' },
                    errors.map((error) => el('li', { textContent: error }))
                ),
            el('div', { className: 'card-actions' }, [saveButton, cancel])
        );
    }

    function render() {
        if (editing) renderEditor();
        else renderList();
    }

    container.replaceChildren(
        el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: 'Custom Embeds' }),
            el('p', {
                className: 'page-subtitle',
                textContent:
                    'Post announcements, rules and info as Ovx, with embeds and link buttons, and edit them any time.',
            }),
        ]),
        body
    );

    render();
    load();
    return () => {};
}
