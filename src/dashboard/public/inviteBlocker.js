// Invite Blocker page: removes Discord invite links to other servers.
import { el, apiSend, toast } from './ui.js';
import { card, field, toggle, chipPicker, createSettingsState, resetCard } from './forms.js';

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderInviteBlocker(container, overview) {
    const { guild, channels, roles } = overview;
    const limits = overview.limits.INVITES;

    const state = createSettingsState({
        saved: overview.inviteBlocker,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/invite-blocker`, draft);
            if (status === 200) {
                overview.inviteBlocker = data;
                toast('Invite blocker saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/invites`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.inviteBlocker = data;
        state.replaceSaved(data);
        render();
        toast('Invite blocker reset');
        return true;
    }

    const switchField = (key, label, description) =>
        field({
            label,
            description,
            id: `invite-${key}`,
            control: toggle({
                id: `invite-${key}`,
                label,
                checked: state.draft[key],
                onChange: (checked) => {
                    state.draft[key] = checked;
                    state.changed();
                },
            }),
        });

    function render() {
        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Invite Blocker' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent:
                        'Removes Discord invite links to other servers, including disguised ones and links added by editing a message.',
                }),
            ]),

            card('Invite blocker', 'Members with Manage Messages can always post invites.', [
                switchField('enabled', 'Block invite links', 'Ovx needs Manage Messages in the channels it checks.'),
                switchField('allowOwnInvites', 'Allow invites to this server', 'Links to this server are left alone.'),
                switchField(
                    'notify',
                    'Tell the member why',
                    'Posts a short note in the channel, which deletes itself after a few seconds.'
                ),
                switchField(
                    'warn',
                    'Give a warning',
                    'Adds a warning to their record (at most one a minute), which counts towards the automatic actions on the Moderation page.'
                ),
            ]),

            card('Exceptions', null, [
                field({
                    label: 'Ignored channels',
                    description: 'Invites are allowed here, and in threads inside them, e.g. a partners channel.',
                    stacked: true,
                    control: chipPicker({
                        options: channels
                            .filter((channel) => channel.type !== 'other')
                            .map((channel) => ({
                                id: channel.id,
                                label: `${channel.type === 'voice' ? '🔊 ' : '# '}${channel.name}`,
                            })),
                        selected: state.draft.ignoredChannelIds,
                        placeholder: 'Add a channel…',
                        emptyText: `No ignored channels (up to ${limits.IGNORED_CHANNELS_MAX})`,
                        onChange: (ids) => {
                            state.draft.ignoredChannelIds = ids;
                            state.changed();
                        },
                    }),
                }),
                field({
                    label: 'Allowed roles',
                    description: 'Members with any of these roles can post invites anywhere.',
                    stacked: true,
                    control: chipPicker({
                        options: roles.map((role) => ({ id: role.id, label: `@${role.name}` })),
                        selected: state.draft.ignoredRoleIds,
                        placeholder: 'Add a role…',
                        emptyText: `No allowed roles (up to ${limits.IGNORED_ROLES_MAX})`,
                        onChange: (ids) => {
                            state.draft.ignoredRoleIds = ids;
                            state.changed();
                        },
                    }),
                }),
            ]),

            resetCard({
                description: 'Turns the invite blocker off and clears its exceptions.',
                confirmMessage:
                    'The invite blocker will be turned off and its exceptions cleared. This cannot be undone.',
                onReset: resetToDefaults,
            }),

            state.bar
        );
        state.changed();
    }

    render();
    return () => state.dispose();
}
