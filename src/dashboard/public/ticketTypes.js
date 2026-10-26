// Ticket types editor: one button per kind of ticket, each with its own emoji, text and permissions.
import { el } from './ui.js';
import { field, chipPicker, textArea } from './forms.js';

export const BUTTON_COLOURS = [
    ['primary', 'Blurple'],
    ['secondary', 'Grey'],
    ['success', 'Green'],
    ['danger', 'Red'],
];

/** Common emojis for the picker (any emoji can also be typed or pasted). */
const COMMON_EMOJIS = [
    '🎫',
    '📩',
    '💬',
    '❓',
    '🆘',
    '🛠️',
    '⚙️',
    '💡',
    '📝',
    '📋',
    '🔓',
    '🔨',
    '⚖️',
    '🚫',
    '🛡️',
    '👮',
    '🚨',
    '⚠️',
    '🐛',
    '🧪',
    '🛒',
    '💳',
    '💰',
    '🧾',
    '📦',
    '🎁',
    '⭐',
    '🏆',
    '🎮',
    '🕹️',
    '👤',
    '👥',
    '🤝',
    '❤️',
    '📢',
    '📞',
    '🔑',
    '🔒',
    '✅',
    '❌',
];

/** A short random ID for a new type (it stays the same when the type is renamed). */
function newTypeId() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => alphabet[byte % alphabet.length]).join('');
}

/**
 * Shows an emoji: custom server emojis (<:name:id>) as their image, Unicode emojis as text.
 * @param {string | null} emoji
 */
export function emojiNode(emoji) {
    const custom = emoji && /^<(a?):(\w+):(\d+)>$/.exec(emoji);
    if (custom) {
        return el('img', {
            className: 'emoji-image',
            src: `https://cdn.discordapp.com/emojis/${custom[3]}.${custom[1] ? 'gif' : 'webp'}?size=48`,
            alt: `:${custom[2]}:`,
        });
    }
    return el('span', { className: 'emoji-text', textContent: emoji ?? '' });
}

/**
 * @param {{ types: any[], overview: any, limits: any, onChange: () => void }} options
 *   types is the draft list (changed in place); onChange is called after every change
 * @returns {HTMLElement}
 */
export function ticketTypesEditor({ types, overview, limits, onChange }) {
    const container = el('div', { className: 'ticket-types' });
    /** Which types have "More settings" open, kept across re-renders */
    const open = new Set();

    const roleOptions = overview.roles.map((role) => ({ id: role.id, label: `@${role.name}` }));

    function render() {
        const full = types.length >= limits.TYPES_MAX;
        const add = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: full ? `Up to ${limits.TYPES_MAX} ticket types` : '+ Add ticket type',
            disabled: full,
        });
        add.addEventListener('click', () => {
            // A blank type, ready to fill in
            const type = {
                id: newTypeId(),
                label: '',
                emoji: null,
                style: 'primary',
                description: null,
                channelPrefix: null,
                categoryId: null,
                staffRoleIds: [],
                allowedRoleIds: [],
                openMessage: null,
            };
            types.push(type);
            open.add(type.id);
            changed(true);
            const labels = container.querySelectorAll('.type-label');
            /** @type {HTMLInputElement | undefined} */ (labels[labels.length - 1])?.focus();
        });

        container.replaceChildren(
            ...types.map((type, index) => typeCard(type, index)),
            // replaceChildren (unlike el) would show a `false` as text, so the notice is spread in only when needed
            ...(types.length === 0
                ? [
                      el('p', {
                          className: 'notice',
                          textContent: 'Add at least one ticket type, or the panel will have no buttons.',
                      }),
                  ]
                : []),
            el('div', { className: 'ticket-types-add' }, [add])
        );
    }

    /** @param {boolean} [rerender] - For changes that add, remove or move cards */
    function changed(rerender = false) {
        if (rerender) render();
        onChange();
    }

    function typeCard(type, index) {
        const move = (by) => {
            types.splice(index, 1);
            types.splice(index + by, 0, type);
            changed(true);
        };
        const iconButton = (label, text, onClick, disabled = false) => {
            const button = el('button', {
                type: 'button',
                className: 'icon-button',
                textContent: text,
                title: label,
                'aria-label': label,
                disabled,
            });
            button.addEventListener('click', onClick);
            return button;
        };

        // ---- Button row: emoji, label, colour ----
        const emojiButton = el('button', {
            type: 'button',
            className: 'emoji-button',
            title: 'Choose an emoji',
            'aria-label': 'Choose an emoji',
        });
        const showEmoji = () =>
            emojiButton.replaceChildren(
                type.emoji ? emojiNode(type.emoji) : el('span', { className: 'emoji-placeholder', textContent: '＋' })
            );
        showEmoji();
        const picker = emojiPicker({
            emojis: overview.emojis,
            onPick: (emoji) => {
                type.emoji = emoji;
                showEmoji();
                changed();
            },
        });
        emojiButton.addEventListener('click', () => picker.toggle(emojiButton));

        const labelInput = el('input', {
            className: 'input type-label',
            type: 'text',
            value: type.label,
            maxLength: limits.LABEL_MAX,
            placeholder: 'Button label',
            'aria-label': 'Button label',
        });
        labelInput.addEventListener('input', () => {
            type.label = labelInput.value;
            changed();
        });

        const colour = el(
            'select',
            { className: 'select type-colour', 'aria-label': 'Button colour' },
            BUTTON_COLOURS.map(([value, label]) =>
                el('option', { value, textContent: label, selected: type.style === value })
            )
        );
        colour.addEventListener('change', () => {
            type.style = colour.value;
            changed();
        });

        // ---- More settings ----
        const textInput = (key, max, placeholder) => {
            const input = el('input', {
                className: 'input input-wide',
                type: 'text',
                value: type[key] ?? '',
                maxLength: max,
                placeholder,
            });
            input.addEventListener('input', () => {
                type[key] = input.value || null;
                changed();
            });
            return input;
        };

        const category = el('select', { className: 'select' }, [
            el('option', { value: '', textContent: 'Same as the ticket category' }),
            ...overview.categories.map((option) =>
                el('option', { value: option.id, textContent: option.name, selected: option.id === type.categoryId })
            ),
        ]);
        category.addEventListener('change', () => {
            type.categoryId = category.value || null;
            changed();
        });

        const details = el('details', { className: 'type-details', open: open.has(type.id) }, [
            el('summary', { textContent: 'More settings' }),
            field({
                label: 'Description',
                description: 'Shown next to this type on the panel. Leave empty to show only the button.',
                stacked: true,
                control: textInput('description', limits.DESCRIPTION_MAX, 'e.g. Questions and general help'),
            }),
            field({
                label: 'Staff for this type',
                description: 'Can see and manage these tickets, as well as your general staff roles.',
                stacked: true,
                control: chipPicker({
                    options: roleOptions,
                    selected: type.staffRoleIds,
                    placeholder: 'Add a role…',
                    emptyText: 'Only the general staff roles',
                    onChange: (ids) => {
                        type.staffRoleIds = ids;
                        changed();
                    },
                }),
            }),
            field({
                label: 'Who can open it',
                description: 'Leave empty so anyone can. Staff can always open every type.',
                stacked: true,
                control: chipPicker({
                    options: roleOptions,
                    selected: type.allowedRoleIds,
                    placeholder: 'Add a role…',
                    emptyText: 'Everyone',
                    onChange: (ids) => {
                        type.allowedRoleIds = ids;
                        changed();
                    },
                }),
            }),
            field({
                label: 'Opening message',
                description: 'Shown at the top of new tickets of this type.',
                stacked: true,
                control: textArea({
                    value: type.openMessage,
                    maxLength: overview.limits.TICKETS.OPEN_MESSAGE_MAX,
                    placeholder: overview.ticketDefaults.openMessage,
                    onChange: (value) => {
                        type.openMessage = value || null;
                        changed();
                    },
                }),
            }),
            field({
                label: 'Channel name',
                description: 'Tickets are named like name-0001.',
                control: textInput('channelPrefix', limits.PREFIX_MAX, 'ticket'),
            }),
            field({ label: 'Category', description: 'Where these tickets are created.', control: category }),
        ]);
        details.addEventListener('toggle', () => (details.open ? open.add(type.id) : open.delete(type.id)));

        return el('div', { className: 'type-card' }, [
            el('div', { className: 'type-row' }, [
                emojiButton,
                labelInput,
                colour,
                el('div', { className: 'type-actions' }, [
                    iconButton('Move up', '▲', () => move(-1), index === 0),
                    iconButton('Move down', '▼', () => move(1), index === types.length - 1),
                    iconButton('Remove', '✕', () => {
                        types.splice(index, 1);
                        changed(true);
                    }),
                ]),
            ]),
            picker.element,
            details,
        ]);
    }

    render();
    return container;
}

/**
 * A small panel for choosing an emoji: type or paste any emoji, or click a common one or a server emoji.
 * @param {{ emojis: { id: string, name: string, animated: boolean, url: string }[], onPick: (emoji: string | null) => void }} options
 */
export function emojiPicker({ emojis, onPick }) {
    const input = el('input', {
        className: 'input emoji-input',
        type: 'text',
        placeholder: 'Type or paste an emoji',
        maxLength: 64,
    });
    const element = el('div', {
        className: 'emoji-picker',
        hidden: true,
        role: 'dialog',
        'aria-label': 'Choose an emoji',
    });

    /** @type {HTMLElement | null} */
    let anchor = null;

    const close = () => {
        element.hidden = true;
        anchor?.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', onOutside);
        document.removeEventListener('keydown', onKey);
    };
    const pick = (emoji) => {
        onPick(emoji);
        close();
    };
    const onOutside = (event) => {
        if (!element.contains(event.target) && !anchor?.contains(event.target)) close();
    };
    const onKey = (event) => {
        if (event.key === 'Escape') close();
    };

    const choice = (content, label, value) => {
        const button = el('button', { type: 'button', className: 'emoji-choice', title: label, 'aria-label': label }, [
            content,
        ]);
        button.addEventListener('click', () => pick(value));
        return button;
    };

    const useTyped = el('button', { type: 'button', className: 'button button-ghost', textContent: 'Use' });
    useTyped.addEventListener('click', () => input.value.trim() && pick(input.value.trim()));
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && input.value.trim()) {
            event.preventDefault();
            pick(input.value.trim());
        }
    });
    const none = el('button', { type: 'button', className: 'button button-ghost', textContent: 'No emoji' });
    none.addEventListener('click', () => pick(null));

    element.append(
        el('div', { className: 'emoji-picker-row' }, [input, useTyped, none]),
        el(
            'div',
            { className: 'emoji-grid' },
            COMMON_EMOJIS.map((emoji) => choice(el('span', { textContent: emoji }), emoji, emoji))
        ),
        emojis.length > 0 && el('div', { className: 'emoji-picker-heading', textContent: 'This server' }),
        emojis.length > 0 &&
            el(
                'div',
                { className: 'emoji-grid' },
                emojis.map((emoji) =>
                    choice(
                        el('img', { className: 'emoji-image', src: emoji.url, alt: '', loading: 'lazy' }),
                        `:${emoji.name}:`,
                        `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`
                    )
                )
            )
    );

    return {
        element,
        /** @param {HTMLElement} button - The button that opens it */
        toggle(button) {
            if (!element.hidden) return close();
            anchor = button;
            element.hidden = false;
            input.value = '';
            input.focus();
            // Registered after this click finishes, so the click that opened it doesn't close it
            setTimeout(() => {
                document.addEventListener('pointerdown', onOutside);
                document.addEventListener('keydown', onKey);
            });
            button.setAttribute('aria-expanded', 'true');
        },
    };
}
