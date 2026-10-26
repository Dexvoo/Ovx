// Logging settings page.
import { el, apiSend, toast } from './ui.js';
import { card, field, toggle, channelSelect, chipPicker, createSettingsState, resetCard } from './forms.js';

const LOG_TYPES = [
    ['message', 'Messages', 'Edited, deleted and bulk-deleted messages.'],
    ['join', 'Joins', 'Members joining, with their account age and member number.'],
    ['leave', 'Leaves', 'Members leaving, with when they joined and the roles they had.'],
    ['member', 'Members', 'Nickname and role changes, profile updates.'],
    ['punishment', 'Punishments', 'Bans, unbans and timeouts.'],
    ['channel', 'Channels', 'Channels created, updated or deleted.'],
    ['role', 'Roles', 'Roles created or deleted.'],
    ['voice', 'Voice', 'Joining, leaving and moving between voice channels, server mutes and deafens.'],
    ['server', 'Server', 'Server settings like the name, icon and verification level, plus emojis and stickers.'],
];

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderLogging(container, overview) {
    const { guild, channels } = overview;

    const state = createSettingsState({
        saved: overview.logging,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/logging`, draft);
            if (status === 200) {
                overview.logging = data;
                toast('Logging settings saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    /** Resets this section on the server, then shows the defaults. */
    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/logging`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.logging = data;
        state.replaceSaved(data);
        render();
        toast('Logging settings reset to defaults');
        return true;
    }

    /** The last test's results, kept while the page is open */
    let testResults = null;
    let testing = false;

    async function sendTestLogs() {
        if (state.dirty) return toast('Save your changes first, so the test uses them', 'error');
        testing = true;
        render();
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/logging/test`, {});
        testing = false;
        if (status === 200) {
            testResults = data.results;
            const failed = testResults.filter((result) => !result.ok).length;
            toast(failed ? `${failed} test log(s) could not be sent` : 'Test logs sent', failed ? 'error' : undefined);
        } else {
            toast(data?.error ?? 'Could not send test logs. Try again.', 'error');
        }
        render();
    }

    function testCard() {
        const button = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: testing ? 'Sending…' : 'Send test logs',
            disabled: testing,
        });
        button.addEventListener('click', sendTestLogs);
        const names = Object.fromEntries(LOG_TYPES.map(([type, name]) => [type, name]));

        return card(
            'Test your logs',
            'Posts a test message in the channel of every log type that is switched on, so you can check Ovx can post there.',
            [
                el('div', { className: 'card-actions' }, [button]),
                ...(testResults
                    ? [
                          el(
                              'ul',
                              { className: 'test-results' },
                              testResults.map((result) =>
                                  el('li', { className: result.ok ? 'test-ok' : 'test-failed' }, [
                                      el('strong', { textContent: names[result.type] ?? result.type }),
                                      result.ok ? ` posted in #${result.channel}` : `: ${result.error}`,
                                  ])
                              )
                          ),
                      ]
                    : []),
            ]
        );
    }

    function logRow([type, name, description]) {
        const settings = state.draft.types[type];
        const id = `log-${type}`;
        return el('div', { className: 'log-row' }, [
            el('div', { className: 'field-text' }, [
                el('label', { className: 'field-label', textContent: name, for: id }),
                el('p', { className: 'field-description', textContent: description }),
            ]),
            el('div', { className: 'log-controls' }, [
                channelSelect({
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
                toggle({
                    id,
                    label: `${name} logs`,
                    checked: settings.enabled,
                    onChange: (enabled) => {
                        settings.enabled = enabled;
                        state.changed();
                    },
                }),
            ]),
        ]);
    }

    function render() {
        const channelOptions = channels
            .filter((channel) => channel.type !== 'other')
            .map((channel) => ({ id: channel.id, label: `${channel.type === 'voice' ? '🔊 ' : '# '}${channel.name}` }));

        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Logging' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent: 'Post a record of what happens in your server to channels of your choice.',
                }),
            ]),

            card(
                'Log types',
                'Pick a channel for each type, then switch it on. Ovx needs to be able to post in the channel.',
                LOG_TYPES.map(logRow)
            ),

            card('Ignored channels', 'Nothing that happens in these channels is logged.', [
                field({
                    label: 'Channels',
                    stacked: true,
                    control: chipPicker({
                        options: channelOptions,
                        selected: state.draft.ignoredChannels,
                        placeholder: 'Add a channel…',
                        emptyText: 'No ignored channels',
                        onChange: (ids) => {
                            state.draft.ignoredChannels = ids;
                            state.changed();
                        },
                    }),
                }),
            ]),

            testCard(),

            resetCard({
                description: 'Turns every log type off and clears their channels and the ignored channels.',
                confirmMessage:
                    'Every log type will be turned off, and their channels and the ignored channels will be cleared. This cannot be undone.',
                onReset: resetToDefaults,
            }),

            state.bar
        );

        // A type can only be switched on once it has a channel
        for (const [type] of LOG_TYPES) {
            const input = /** @type {HTMLInputElement | null} */ (container.querySelector(`#log-${type}`));
            if (input) input.disabled = !state.draft.types[type].channelId;
        }
        state.changed();
    }

    render();
    return () => state.dispose();
}
