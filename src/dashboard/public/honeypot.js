// Honeypot page: a channel nobody should post in, which catches compromised accounts spamming every channel.
import { el, apiSend, toast } from './ui.js';
import { card, field, toggle, channelSelect, createSettingsState, resetCard } from './forms.js';

const DELETE_LABELS = {
    0: 'Don’t delete any (just the honeypot message)',
    3600: 'Last hour',
    21600: 'Last 6 hours',
    86400: 'Last 24 hours',
    259200: 'Last 3 days',
    604800: 'Last 7 days',
};

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderHoneypot(container, overview) {
    const { guild, channels } = overview;
    const limits = overview.limits.HONEYPOT;

    const state = createSettingsState({
        saved: overview.honeypot,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/honeypot`, draft);
            if (status === 200) {
                // Saved either way; the warning only fails to post when Ovx can't post in the channel
                const { warningError, ...saved } = data;
                overview.honeypot = saved;
                if (warningError) toast(`Honeypot saved, but the warning wasn’t posted. ${warningError}`, 'error');
                else toast('Honeypot saved');
                return { ok: true, saved };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/honeypot`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.honeypot = data;
        state.replaceSaved(data);
        render();
        toast('Honeypot reset');
        return true;
    }

    const switchField = (key, label, description) =>
        field({
            label,
            description,
            id: `honeypot-${key}`,
            control: toggle({
                id: `honeypot-${key}`,
                label,
                checked: state.draft[key],
                onChange: (checked) => {
                    state.draft[key] = checked;
                    changed();
                },
            }),
        });

    /** A dropdown of fixed choices; values are numbers or strings, matching what's saved. */
    function choiceSelect(key, id, options) {
        const select = el(
            'select',
            { className: 'select', id },
            options.map(([value, label]) => el('option', { value: String(value), textContent: label }))
        );
        select.value = String(state.draft[key]);
        select.addEventListener('change', () => {
            const picked = options.find(([value]) => String(value) === select.value);
            state.draft[key] = picked[0];
            changed();
        });
        return select;
    }

    // ---- Posting the warning again (saving posts or updates it too) ----
    const warningButton = el('button', { type: 'button', className: 'button button-primary' });
    const warningNote = el('p', { className: 'field-description' });
    const updateWarning = () => {
        const saved = state.saved;
        const live = saved.enabled && saved.postWarning && saved.channelId;
        warningButton.textContent = saved.warningPosted ? 'Update warning' : 'Post warning';
        warningButton.disabled = !live || state.dirty;
        warningNote.textContent = state.dirty
            ? 'Save your changes first: saving posts or updates the warning.'
            : !live
              ? 'The warning is posted once the honeypot and its warning message are on and saved.'
              : saved.warningPosted
                ? 'The warning is up in the honeypot channel. Post it again if someone deleted it.'
                : 'The warning isn’t posted. Check Ovx can send messages and embed links in the channel.';
    };
    warningButton.addEventListener('click', async () => {
        warningButton.disabled = true;
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/honeypot/warning`, {});
        if (status === 200) {
            overview.honeypot = data;
            state.replaceSaved(data);
            toast('Warning posted');
        } else {
            toast(data?.error ?? 'Could not post the warning. Try again.', 'error');
        }
        updateWarning();
    });
    const changed = () => {
        state.changed();
        updateWarning();
    };

    function render() {
        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Honeypot' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent:
                        'A channel nobody should post in. Compromised accounts that spam every channel they can see post here too, and are removed straight away.',
                }),
                !overview.botPermissions.banMembers &&
                    el('p', {
                        className: 'notice notice-warn',
                        textContent:
                            'Ovx needs the Ban Members permission to remove anyone. Give its role that permission in Server Settings > Roles.',
                    }),
            ]),

            card(
                'Honeypot channel',
                'Members with Manage Messages are never removed, so moderators can still post there. Members whose highest role is above Ovx’s are left alone too.',
                [
                    switchField(
                        'enabled',
                        'Honeypot',
                        'Remove anyone who posts in the channel. Choose a channel first.'
                    ),
                    field({
                        label: 'Channel',
                        description:
                            'Use a new channel everyone can see and send messages in, near the top of the list. Threads inside it count too.',
                        id: 'honeypot-channel',
                        control: channelSelect({
                            channels,
                            value: state.draft.channelId,
                            noneLabel: 'Choose a channel',
                            requirePost: false,
                            id: 'honeypot-channel',
                            onChange: (id) => {
                                state.draft.channelId = id;
                                changed();
                            },
                        }),
                    }),
                ]
            ),

            card('What happens', null, [
                field({
                    label: 'Action',
                    description:
                        'A softban bans and then unbans at once: their messages are deleted, but the real owner can rejoin once they’ve secured their account.',
                    id: 'honeypot-action',
                    control: choiceSelect(
                        'action',
                        'honeypot-action',
                        limits.ACTIONS.map((action) => [
                            action,
                            action === 'ban' ? 'Ban' : 'Softban (kick and delete messages)',
                        ])
                    ),
                }),
                field({
                    label: 'Delete their messages',
                    description: 'Removes the spam they posted in other channels too.',
                    id: 'honeypot-delete',
                    control: choiceSelect(
                        'deleteMessageSeconds',
                        'honeypot-delete',
                        limits.DELETE_SECONDS.map((seconds) => [
                            seconds,
                            DELETE_LABELS[seconds] ?? `${seconds} seconds`,
                        ])
                    ),
                }),
                switchField(
                    'notify',
                    'Tell the member why',
                    'Sends them a DM first, so the owner of a compromised account knows what happened.'
                ),
            ]),

            card('Warning message', null, [
                switchField(
                    'postWarning',
                    'Post a warning message',
                    'Ovx posts an embed in the channel saying anyone who sends a message there is banned, so real members stay out. It’s kept up to date when you change the channel or action, and removed when the honeypot is off.'
                ),
                field({
                    label: 'Warning',
                    stacked: true,
                    control: el('div', {}, [warningButton, warningNote]),
                }),
            ]),

            resetCard({
                description: 'Turns the honeypot off, clears its channel and deletes the warning message.',
                confirmMessage: 'The honeypot will be turned off and its channel cleared. This cannot be undone.',
                onReset: resetToDefaults,
            }),

            state.bar
        );
        changed();
    }

    render();
    return () => state.dispose();
}
