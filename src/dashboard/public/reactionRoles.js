// Reaction Roles page: panels with a button per role. Members click a button to get or remove the role.
import { el, api, apiSend, toast } from './ui.js';
import { card, field, channelSelect, numberInput, textArea, confirmDialog } from './forms.js';
import { BUTTON_COLOURS, emojiNode, emojiPicker } from './ticketTypes.js';
import { markdown, markdownContext } from './markdown.js';

const DEFAULT_COLOUR = '#71368a'; // Matches DEFAULT_EMBED_COLOUR in shared/cache/guildSettings.cache.js

const MODES = [
    ['normal', 'Normal', 'Members can take and remove any of the roles.'],
    ['unique', 'Only one', 'Picking a role removes the panel’s other roles, e.g. colours or regions.'],
    ['verify', 'Add only', 'Roles can be taken but not removed here, e.g. a Verified role.'],
];
const MODE_NAMES = Object.fromEntries(MODES.map(([value, name]) => [value, name]));

const newPanel = () => ({
    id: null,
    title: 'Pick your roles',
    description: '',
    colour: null,
    channelId: null,
    mode: 'normal',
    requiredRoleId: null,
    maxRoles: 0,
    buttons: [],
});

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderReactionRoles(container, overview) {
    const { guild, channels, roles } = overview;
    const limits = overview.limits.REACTION_ROLES;
    const roleById = new Map(roles.map((role) => [role.id, role]));
    // Role and channel names for mentions in the preview
    const mentions = markdownContext(overview);
    const channelName = (id) => `#${channels.find((channel) => channel.id === id)?.name ?? 'deleted-channel'}`;

    let panels = [];
    let legacyCount = 0;
    let loaded = false;
    /** The panel being edited (a copy), or null when showing the list */
    let editing = null;
    let saving = false;
    let errors = [];

    const body = el('div');
    /** Replaces the page body; skips the false left by conditional parts (`cond && element`). */
    const show = (...nodes) => body.replaceChildren(...nodes.filter(Boolean));

    // ---------- List ----------

    async function load() {
        const { status, data } = await api(`/api/guilds/${guild.id}/reaction-roles`);
        if (status !== 200) {
            toast(data?.error ?? 'Could not load reaction roles.', 'error');
            return;
        }
        panels = data.panels;
        legacyCount = data.legacyCount;
        loaded = true;
        if (!editing) render();
    }

    async function remove(panel) {
        const confirmed = await confirmDialog({
            title: `Delete “${panel.title}”?`,
            message: 'The panel’s message is deleted from Discord. Members keep the roles they already have.',
            confirmLabel: 'Delete panel',
        });
        if (!confirmed) return;
        const { status, data } = await apiSend('DELETE', `/api/guilds/${guild.id}/reaction-roles/${panel.id}`, {});
        if (status !== 200 && status !== 404) return toast(data?.error ?? 'Could not delete the panel.', 'error');
        panels = panels.filter((item) => item.id !== panel.id);
        toast('Panel deleted');
        render();
    }

    function panelRow(panel) {
        const editButton = el('button', {
            type: 'button',
            className: 'button button-ghost button-small',
            textContent: 'Edit',
        });
        editButton.addEventListener('click', () => startEditing(panel));
        const deleteButton = el('button', {
            type: 'button',
            className: 'button button-danger-ghost button-small',
            textContent: 'Delete',
        });
        deleteButton.addEventListener('click', () => remove(panel));

        const roleNames = panel.buttons.map((button) => `@${roleById.get(button.roleId)?.name ?? 'deleted-role'}`);
        return el('article', { className: 'giveaway-row' }, [
            el('div', { className: 'giveaway-main' }, [
                el('div', { className: 'giveaway-title-line' }, [
                    el('span', { className: 'case-badge', textContent: MODE_NAMES[panel.mode] }),
                    panel.messageUrl
                        ? el('a', {
                              className: 'giveaway-prize',
                              href: panel.messageUrl,
                              target: '_blank',
                              rel: 'noopener',
                              textContent: panel.title,
                          })
                        : el('span', { className: 'giveaway-prize', textContent: panel.title }),
                ]),
                el('p', {
                    className: 'case-meta',
                    textContent: `${channelName(panel.channelId)} · ${panel.buttons.length} role${panel.buttons.length === 1 ? '' : 's'}${panel.posted ? '' : ' · not posted'}`,
                }),
                el('p', { className: 'case-meta', textContent: roleNames.join(', ') }),
            ]),
            el('div', { className: 'giveaway-actions' }, [editButton, deleteButton]),
        ]);
    }

    function renderList() {
        const create = el('button', {
            type: 'button',
            className: 'button button-primary',
            textContent: '+ New panel',
            disabled: !loaded || panels.length >= limits.PANELS_MAX,
        });
        create.addEventListener('click', () => startEditing(null));

        show(
            legacyCount > 0 &&
                el('p', {
                    className: 'notice',
                    textContent: `${legacyCount} dropdown panel${legacyCount === 1 ? '' : 's'} from the old Ovx still work${legacyCount === 1 ? 's' : ''}. To change one, make a new panel here and delete the old message.`,
                }),
            card(
                'Panels',
                'Each panel is a message with a button per role. Members click a button to get or remove it.',
                [
                    !loaded
                        ? el('p', { className: 'empty-note', textContent: 'Loading…' })
                        : panels.length === 0
                          ? el('p', { className: 'empty-note', textContent: 'No panels yet.' })
                          : el('div', { className: 'giveaway-list' }, panels.map(panelRow)),
                    el('div', { className: 'card-actions' }, [create]),
                ]
            )
        );
    }

    // ---------- Editor ----------

    function startEditing(panel) {
        editing = panel ? structuredClone(panel) : newPanel();
        errors = [];
        render();
        container.scrollIntoView({ block: 'start' });
    }

    async function save() {
        if (saving) return;
        saving = true;
        errors = [];
        render();

        const body = {
            title: editing.title,
            description: editing.description,
            colour: editing.colour,
            channelId: editing.channelId,
            mode: editing.mode,
            requiredRoleId: editing.requiredRoleId,
            maxRoles: editing.mode === 'normal' ? editing.maxRoles : 0,
            buttons: editing.buttons,
        };
        const { status, data } = editing.id
            ? await apiSend('PUT', `/api/guilds/${guild.id}/reaction-roles/${editing.id}`, body)
            : await apiSend('POST', `/api/guilds/${guild.id}/reaction-roles`, body);
        saving = false;

        if (status !== 200) {
            errors = data?.details ?? [data?.error ?? 'Could not save. Try again.'];
            return render();
        }
        const saved = data.panel;
        panels = editing.id ? panels.map((item) => (item.id === saved.id ? saved : item)) : [...panels, saved];
        if (data.warning) toast(`Saved, but not posted: ${data.warning}`, 'error');
        else toast(editing.id ? 'Panel updated' : 'Panel posted');
        editing = null;
        render();
    }

    function preview() {
        const colour = editing.colour ?? overview.bot.embedColour ?? DEFAULT_COLOUR;
        const list = editing.buttons.map((button) =>
            el('div', {}, [
                button.emoji && emojiNode(button.emoji),
                button.emoji && ' ',
                el('span', {
                    className: 'preview-mention',
                    textContent: `@${roleById.get(button.roleId)?.name ?? 'choose a role'}`,
                }),
            ])
        );
        const embed = el('div', { className: 'preview-embed' }, [
            el('div', { className: 'preview-embed-text' }, [
                el('div', { className: 'preview-embed-title', textContent: editing.title || 'Untitled' }),
                editing.description ? el('div', {}, markdown(editing.description, mentions)) : el('div', {}, list),
            ]),
        ]);
        embed.style.borderLeftColor = colour;

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
                embed,
                el(
                    'div',
                    { className: 'preview-buttons' },
                    editing.buttons.map((button) =>
                        el('span', { className: `preview-button preview-button-${button.style}` }, [
                            button.emoji && emojiNode(button.emoji),
                            el('span', {
                                textContent: button.label || roleById.get(button.roleId)?.name || 'Choose a role',
                            }),
                        ])
                    )
                ),
            ]),
        ]);
    }

    function buttonCard(button, index) {
        const changed = (rerender = false) => (rerender ? render() : refreshPreview());
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
        const move = (by) => {
            editing.buttons.splice(index, 1);
            editing.buttons.splice(index + by, 0, button);
            changed(true);
        };

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
                changed();
            },
        });
        emojiButton.addEventListener('click', () => picker.toggle(emojiButton));

        const roleSelect = el('select', { className: 'select type-label', 'aria-label': 'Role' }, [
            el('option', { value: '', textContent: 'Choose a role', disabled: true }),
            ...roles.map((role) => {
                const reason = role.managed
                    ? ' — managed by an integration'
                    : !role.assignable
                      ? ' — above Ovx’s role'
                      : '';
                return el('option', {
                    value: role.id,
                    textContent: `@${role.name}${reason}`,
                    disabled: Boolean(reason) && role.id !== button.roleId,
                });
            }),
        ]);
        roleSelect.value = button.roleId ?? '';
        roleSelect.addEventListener('change', () => {
            button.roleId = roleSelect.value;
            labelInput.placeholder = roleById.get(button.roleId)?.name ?? 'Button label';
            changed();
        });

        const labelInput = el('input', {
            className: 'input type-label',
            type: 'text',
            value: button.label ?? '',
            maxLength: limits.LABEL_MAX,
            placeholder: roleById.get(button.roleId)?.name ?? 'Button label',
            'aria-label': 'Button label (leave empty to use the role name)',
        });
        labelInput.addEventListener('input', () => {
            button.label = labelInput.value || null;
            changed();
        });

        const colour = el(
            'select',
            { className: 'select type-colour', 'aria-label': 'Button colour' },
            BUTTON_COLOURS.map(([value, label]) =>
                el('option', { value, textContent: label, selected: button.style === value })
            )
        );
        colour.addEventListener('change', () => {
            button.style = colour.value;
            changed();
        });

        return el('div', { className: 'type-card' }, [
            el('div', { className: 'type-row' }, [
                emojiButton,
                roleSelect,
                labelInput,
                colour,
                el('div', { className: 'type-actions' }, [
                    iconButton('Move up', '▲', () => move(-1), index === 0),
                    iconButton('Move down', '▼', () => move(1), index === editing.buttons.length - 1),
                    iconButton('Remove', '✕', () => {
                        editing.buttons.splice(index, 1);
                        changed(true);
                    }),
                ]),
            ]),
            picker.element,
        ]);
    }

    const previewHost = el('div');
    const refreshPreview = () => previewHost.replaceChildren(preview());

    function renderEditor() {
        const title = el('input', {
            className: 'input input-wide',
            type: 'text',
            id: 'rr-title',
            value: editing.title,
            maxLength: limits.TITLE_MAX,
        });
        title.addEventListener('input', () => {
            editing.title = title.value;
            refreshPreview();
        });

        const mode = el(
            'select',
            { className: 'select', id: 'rr-mode' },
            MODES.map(([value, name]) => el('option', { value, textContent: name, selected: editing.mode === value }))
        );
        mode.addEventListener('change', () => {
            editing.mode = mode.value;
            render();
        });

        const requiredRole = el('select', { className: 'select', id: 'rr-required' }, [
            el('option', { value: '', textContent: 'Anyone can use it' }),
            ...roles.map((role) => el('option', { value: role.id, textContent: `@${role.name}` })),
        ]);
        requiredRole.value = editing.requiredRoleId ?? '';
        requiredRole.addEventListener('change', () => (editing.requiredRoleId = requiredRole.value || null));

        const colourInput = el('input', {
            className: 'colour-input',
            type: 'color',
            value: editing.colour ?? overview.bot.embedColour ?? DEFAULT_COLOUR,
            'aria-label': 'Embed colour',
            disabled: editing.colour === null,
        });
        colourInput.addEventListener('input', () => {
            editing.colour = colourInput.value;
            refreshPreview();
        });
        const useServerColour = el('input', {
            type: 'checkbox',
            id: 'rr-server-colour',
            checked: editing.colour === null,
        });
        useServerColour.addEventListener('change', () => {
            editing.colour = useServerColour.checked ? null : colourInput.value;
            colourInput.disabled = useServerColour.checked;
            refreshPreview();
        });

        const addButton = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: '+ Add role',
            disabled: editing.buttons.length >= limits.BUTTONS_MAX,
        });
        addButton.addEventListener('click', () => {
            editing.buttons.push({ roleId: '', label: null, emoji: null, style: 'secondary' });
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

        refreshPreview();
        show(
            card(editing.id ? 'Edit panel' : 'New panel', null, [
                field({ label: 'Title', id: 'rr-title', control: title }),
                field({
                    label: 'Text',
                    description: 'Leave empty to list the roles instead.',
                    stacked: true,
                    control: textArea({
                        value: editing.description,
                        maxLength: limits.DESCRIPTION_MAX,
                        onChange: (value) => {
                            editing.description = value;
                            refreshPreview();
                        },
                    }),
                }),
                field({
                    label: 'Colour',
                    control: el('div', { className: 'inline-controls' }, [
                        colourInput,
                        el('label', { className: 'checkbox-label', for: 'rr-server-colour' }, [
                            useServerColour,
                            ' Use the server’s embed colour',
                        ]),
                    ]),
                }),
                field({
                    label: 'Channel',
                    description: editing.id ? 'Changing it moves the panel: the old message is deleted.' : undefined,
                    id: 'rr-channel',
                    control: channelSelect({
                        channels,
                        value: editing.channelId,
                        noneLabel: 'Choose a channel',
                        id: 'rr-channel',
                        onChange: (id) => (editing.channelId = id),
                    }),
                }),
                field({
                    label: 'How it works',
                    description: MODES.find(([value]) => value === editing.mode)[2],
                    id: 'rr-mode',
                    control: mode,
                }),
                editing.mode === 'normal' &&
                    field({
                        label: 'Most roles per member',
                        description: 'How many of this panel’s roles someone can have. 0 for no limit.',
                        id: 'rr-max',
                        control: numberInput({
                            value: editing.maxRoles,
                            min: 0,
                            max: limits.BUTTONS_MAX,
                            id: 'rr-max',
                            onChange: (value) => (editing.maxRoles = value),
                        }),
                    }),
                field({
                    label: 'Required role',
                    description: 'Only members with this role can use the panel.',
                    id: 'rr-required',
                    control: requiredRole,
                }),
            ]),
            card(
                'Roles',
                'One button per role. Leave a label empty to use the role’s name. Ovx can only give roles below its own.',
                [
                    editing.buttons.length === 0 && el('p', { className: 'empty-note', textContent: 'No roles yet.' }),
                    el('div', { className: 'type-list' }, editing.buttons.map(buttonCard)),
                    el('div', { className: 'card-actions' }, [addButton]),
                ]
            ),
            card('Preview', null, [previewHost]),
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
            el('h1', { className: 'page-title', textContent: 'Reaction Roles' }),
            el('p', {
                className: 'page-subtitle',
                textContent:
                    'Let members pick their own roles with buttons: colours, pings, regions, a verified role and more.',
            }),
        ]),
        body
    );

    if (!overview.botPermissions.manageRoles) {
        container.insertBefore(
            el('p', { className: 'notice', textContent: 'Ovx needs the Manage Roles permission to give roles.' }),
            body
        );
    }

    render();
    load();
    return () => {};
}
