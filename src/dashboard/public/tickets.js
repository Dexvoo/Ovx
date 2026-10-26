// Tickets page: private support channels people open from a "Create Ticket" panel.
import { el, apiSend, toast } from './ui.js';
import {
    card,
    field,
    toggle,
    channelSelect,
    chipPicker,
    numberInput,
    textArea,
    createSettingsState,
    resetCard,
} from './forms.js';
import { ticketTypesEditor, emojiNode } from './ticketTypes.js';

const DEFAULT_COLOUR = '#71368a'; // Matches DEFAULT_EMBED_COLOUR in shared/cache/guildSettings.cache.js

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderTickets(container, overview) {
    const { guild, channels, roles, categories, limits } = overview;
    const L = limits.TICKETS;
    const defaults = overview.ticketDefaults;
    let panelChannelId = overview.ticketPanel.channelId;

    const state = createSettingsState({
        saved: overview.tickets,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/tickets`, draft);
            if (status === 200) {
                overview.tickets = data;
                toast('Ticket settings saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    // The post button follows the save state (it's disabled while there are unsaved changes)
    let afterChange = () => {};
    const baseChanged = state.changed;
    state.changed = () => {
        baseChanged();
        afterChange();
    };

    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/tickets`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.tickets = data;
        state.replaceSaved(data);
        render();
        toast('Ticket settings reset to defaults');
        return true;
    }

    /** One-line text box that stores null when empty (the default is shown as the placeholder). */
    function textInput({ id, value, maxLength, placeholder, onInput }) {
        const input = el('input', {
            className: 'input input-wide',
            id,
            type: 'text',
            value: value ?? '',
            maxLength,
            placeholder,
        });
        input.addEventListener('input', () => onInput(input.value || null));
        return input;
    }

    function render() {
        const draft = state.draft;
        const set = (key, value) => {
            draft[key] = value;
            state.changed();
        };

        // ---- Panel preview ----
        const previewTitle = el('div', { className: 'preview-embed-title' });
        const previewText = el('div', { className: 'preview-embed-text' });
        const previewList = el('div', { className: 'preview-embed-list' });
        const previewButtons = el('div', { className: 'preview-buttons' });
        const panelPreview = el('div', { className: 'preview-message' }, [
            el('img', { className: 'preview-avatar', src: overview.bot.avatar, alt: '' }),
            el('div', { className: 'preview-content' }, [
                el('div', { className: 'preview-author' }, [
                    el('span', {
                        className: 'preview-name',
                        textContent: overview.bot.nickname || overview.bot.username,
                    }),
                    el('span', { className: 'bot-preview-tag', textContent: 'APP' }),
                ]),
                el('div', { className: 'preview-embed' }, [
                    el('div', { className: 'preview-embed-text' }, [previewTitle, previewText, previewList]),
                ]),
                previewButtons,
            ]),
        ]);
        /** @type {HTMLElement} */ (panelPreview.querySelector('.preview-embed')).style.borderLeftColor =
            overview.bot.embedColour ?? DEFAULT_COLOUR;
        const updatePreview = () => {
            previewTitle.textContent = draft.panel.title || defaults.panelTitle;
            previewText.textContent = draft.panel.description || defaults.panelDescription;
            // Types with a description are listed in the embed, like the bot does
            previewList.replaceChildren(
                ...draft.ticketTypes
                    .filter((type) => type.description)
                    .map((type) =>
                        el('div', {}, [
                            type.emoji && emojiNode(type.emoji),
                            type.emoji && ' ',
                            el('strong', { textContent: type.label || 'Untitled' }),
                            `: ${type.description}`,
                        ])
                    )
            );
            previewButtons.replaceChildren(
                ...draft.ticketTypes.map((type) =>
                    el('span', { className: `preview-button preview-button-${type.style}` }, [
                        type.emoji && emojiNode(type.emoji),
                        el('span', { textContent: type.label || 'Untitled' }),
                    ])
                )
            );
        };
        updatePreview();
        const setPanel = (key, value) => {
            draft.panel[key] = value;
            updatePreview();
            state.changed();
            updatePostButton();
        };

        // ---- Posting the panel (separate from saving) ----
        const postButton = el('button', { type: 'button', className: 'button button-primary' });
        const postNote = el('p', { className: 'field-description' });
        const updatePostButton = () => {
            const updating = overview.ticketPanel.posted && panelChannelId === overview.ticketPanel.channelId;
            postButton.textContent = updating ? 'Update panel' : 'Post panel';
            postButton.disabled = !panelChannelId || state.dirty;
            postNote.textContent = state.dirty
                ? 'Save your changes first, so the panel shows them.'
                : overview.ticketPanel.posted
                  ? 'Posting in another channel moves the panel there.'
                  : 'Posts the message people click to open a ticket.';
        };
        postButton.addEventListener('click', async () => {
            postButton.disabled = true;
            const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/tickets/panel`, {
                channelId: panelChannelId,
            });
            if (status === 200) {
                overview.ticketPanel = { channelId: data.channelId, posted: true };
                toast('Ticket panel posted');
            } else {
                toast(data?.error ?? 'Could not post the panel. Try again.', 'error');
            }
            updatePostButton();
        });

        const categoryOptions = el('select', { className: 'select', id: 'ticket-category' }, [
            el('option', { value: '', textContent: 'Choose a category' }),
            ...categories.map((category) =>
                el('option', {
                    value: category.id,
                    textContent: category.botCanUse ? category.name : `${category.name} (Ovx is missing permissions)`,
                    selected: category.id === draft.categoryId,
                })
            ),
        ]);
        categoryOptions.addEventListener('change', () => {
            set('categoryId', categoryOptions.value || null);
            if (!draft.categoryId) draft.enabled = false;
            render();
        });

        const nothingSaved = !draft.transcriptChannelId && !draft.dmTranscript;

        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Tickets' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent: 'Private channels where members can talk to your staff team.',
                }),
            ]),

            card('Tickets', null, [
                field({
                    label: 'Tickets on',
                    description: 'When off, nobody can open new tickets. Open ones stay open.',
                    id: 'tickets-enabled',
                    control: toggle({
                        id: 'tickets-enabled',
                        label: 'Tickets on',
                        checked: draft.enabled,
                        onChange: (value) => set('enabled', value),
                    }),
                }),
                field({
                    label: 'Ticket category',
                    description:
                        'New ticket channels are created here. Ovx needs Manage Channels and Manage Permissions in it.',
                    id: 'ticket-category',
                    control: categoryOptions,
                }),
                field({
                    label: 'Staff roles',
                    description:
                        'Can see every ticket and close, lock, claim and add people. Anyone with Manage Server can too.',
                    stacked: true,
                    control: chipPicker({
                        options: roles.map((role) => ({ id: role.id, label: `@${role.name}` })),
                        selected: draft.staffRoleIds,
                        placeholder: 'Add a role…',
                        emptyText: 'No staff roles',
                        onChange: (ids) => set('staffRoleIds', ids),
                    }),
                }),
                field({
                    label: 'Ping staff on new tickets',
                    id: 'tickets-ping',
                    control: toggle({
                        id: 'tickets-ping',
                        label: 'Ping staff on new tickets',
                        checked: draft.pingStaff,
                        onChange: (value) => set('pingStaff', value),
                    }),
                }),
                field({
                    label: 'Open tickets per member',
                    description: 'How many tickets one person can have open at once.',
                    control: numberInput({
                        value: draft.maxOpenPerUser,
                        min: L.MAX_OPEN_MIN,
                        max: L.MAX_OPEN_MAX,
                        onChange: (value) => set('maxOpenPerUser', value),
                    }),
                }),
                field({
                    label: 'Members can close their own tickets',
                    description: 'Staff can always close tickets.',
                    id: 'tickets-owner-close',
                    control: toggle({
                        id: 'tickets-owner-close',
                        label: 'Members can close their own tickets',
                        checked: draft.ownerCanClose,
                        onChange: (value) => set('ownerCanClose', value),
                    }),
                }),
            ]),

            card(
                'Transcripts',
                'When a ticket is closed, its messages are saved as a web page before the channel is deleted.',
                [
                    nothingSaved &&
                        el('p', {
                            className: 'notice',
                            textContent:
                                'With no transcript channel and DMs off, closed tickets are not saved anywhere.',
                        }),
                    field({
                        label: 'Transcript channel',
                        description: 'Ovx also needs Attach Files there. If it can’t post, the ticket stays open.',
                        control: channelSelect({
                            channels,
                            value: draft.transcriptChannelId,
                            noneLabel: 'Don’t post transcripts',
                            onChange: (channelId) => {
                                set('transcriptChannelId', channelId);
                                render();
                            },
                        }),
                    }),
                    field({
                        label: 'Send the transcript to the member',
                        description: 'By DM, if they allow DMs from server members.',
                        id: 'tickets-dm',
                        control: toggle({
                            id: 'tickets-dm',
                            label: 'Send the transcript to the member',
                            checked: draft.dmTranscript,
                            onChange: (value) => {
                                set('dmTranscript', value);
                                render();
                            },
                        }),
                    }),
                ]
            ),

            card(
                'Ticket types',
                'Each type is a button on the panel, with its own emoji, text and who can see it. Up to 10.',
                [
                    ticketTypesEditor({
                        types: draft.ticketTypes,
                        overview,
                        limits: limits.TICKET_TYPES,
                        onChange: () => {
                            updatePreview();
                            state.changed();
                        },
                    }),
                ]
            ),

            card('Panel', 'The message people click to open a ticket.', [
                field({
                    label: 'Title',
                    id: 'panel-title',
                    stacked: true,
                    control: textInput({
                        id: 'panel-title',
                        value: draft.panel.title,
                        maxLength: L.PANEL_TITLE_MAX,
                        placeholder: defaults.panelTitle,
                        onInput: (value) => setPanel('title', value),
                    }),
                }),
                field({
                    label: 'Text',
                    id: 'panel-description',
                    stacked: true,
                    control: textArea({
                        id: 'panel-description',
                        value: draft.panel.description,
                        maxLength: L.PANEL_DESCRIPTION_MAX,
                        placeholder: defaults.panelDescription,
                        onChange: (value) => setPanel('description', value || null),
                    }),
                }),
                el('div', { className: 'preview-label', textContent: 'Preview' }),
                panelPreview,
                field({
                    label: 'Post in',
                    description: '',
                    control: el('div', { className: 'input-row' }, [
                        channelSelect({
                            channels,
                            value: panelChannelId,
                            noneLabel: 'Choose a channel',
                            onChange: (channelId) => {
                                panelChannelId = channelId;
                                updatePostButton();
                            },
                        }),
                        postButton,
                    ]),
                }),
                postNote,
            ]),

            resetCard({
                description:
                    'Turns tickets off and puts every setting back to the default. Open tickets are not closed.',
                confirmMessage:
                    'Tickets will be turned off and every setting, including staff roles and the transcript channel, goes back to the default. Open tickets stay open, and ticket numbers keep counting. This cannot be undone.',
                onReset: resetToDefaults,
            }),

            state.bar
        );

        // Tickets can only be turned on once there's a category
        const enabledInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#tickets-enabled'));
        if (enabledInput) enabledInput.disabled = !draft.categoryId;

        afterChange = updatePostButton;
        updatePostButton();
        state.changed();
    }

    render();
    return () => state.dispose();
}
