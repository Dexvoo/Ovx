// Levels settings page.
import { el, apiSend, toast } from './ui.js';
import {
    card,
    field,
    toggle,
    channelSelect,
    roleSelect,
    numberInput,
    textArea,
    chipPicker,
    createSettingsState,
    resetCard,
} from './forms.js';
import { channelXPStatus, levelsBlocker } from './levelsStatus.js';

const DEFAULT_MESSAGE = '{user} leveled up to **{level}**!';

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderLevels(container, overview) {
    const { guild, channels, roles, limits } = overview;

    const state = createSettingsState({
        saved: overview.levels,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/levels`, draft);
            if (status === 200) {
                overview.levels = data;
                toast('Level settings saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    /** Resets this section on the server, then shows the defaults. */
    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/levels`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.levels = data;
        state.replaceSaved(data);
        render();
        toast('Level settings reset to defaults');
        return true;
    }

    const set = (key, value) => {
        state.draft[key] = value;
        state.changed();
        updateCoverage();
    };

    // "Where members earn XP": follows the settings as they're changed, before saving
    const coverage = el('div');
    let showChannels = false;

    function updateCoverage() {
        const draft = state.draft;
        const blocker = levelsBlocker(draft, overview.levels, channels);
        const xpChannels = channels.filter((channel) => channel.type !== 'other');
        const statuses = xpChannels.map((channel) => ({ channel, ...channelXPStatus(channel, draft) }));
        const earning = statuses.filter((status) => status.earns).length;
        const excludedRoles = roles.filter((role) => draft.blacklisted.roleIds.includes(role.id));

        const lines = [];
        if (blocker) lines.push(el('p', { className: 'notice notice-warn', textContent: blocker.text }));
        lines.push(
            el('p', {
                className: 'coverage-summary',
                textContent: blocker
                    ? `Once that’s fixed, members will earn XP in ${earning} of ${xpChannels.length} channels.`
                    : `Members earn XP in ${earning} of ${xpChannels.length} channels.`,
            })
        );
        if (excludedRoles.length) {
            lines.push(
                el('p', {
                    className: 'field-description',
                    textContent: `Members with ${excludedRoles.map((role) => `@${role.name}`).join(', ')} don’t earn XP anywhere.`,
                })
            );
        }

        const toggleList = el('button', {
            type: 'button',
            className: 'button button-ghost button-small',
            textContent: showChannels ? 'Hide channels' : 'Show every channel',
            'aria-expanded': String(showChannels),
        });
        toggleList.addEventListener('click', () => {
            showChannels = !showChannels;
            updateCoverage();
        });
        lines.push(toggleList);

        if (showChannels) {
            // Channels that don't earn XP first: those are what people come here to find
            const sorted = [...statuses].sort((a, b) => Number(a.earns) - Number(b.earns));
            lines.push(
                el(
                    'ul',
                    { className: 'coverage-list' },
                    sorted.map(({ channel, earns, reason }) =>
                        el('li', { className: `coverage-row${earns ? '' : ' coverage-off'}` }, [
                            el('span', {
                                className: 'coverage-icon',
                                textContent: earns ? '✓' : '✕',
                                'aria-hidden': 'true',
                            }),
                            el('span', {
                                className: 'coverage-name',
                                textContent: `${channel.type === 'voice' ? '🔊 ' : '# '}${channel.name}`,
                            }),
                            el('span', {
                                className: 'coverage-reason',
                                textContent: earns ? `Earns XP · ${reason}` : `No XP · ${reason}`,
                            }),
                        ])
                    )
                )
            );
        }
        coverage.replaceChildren(...lines);
    }

    function rewardsList() {
        const list = el('div', { className: 'rewards' });

        const renderRows = () => {
            const rows = state.draft.rewards.map((reward, index) => {
                const remove = el('button', {
                    type: 'button',
                    className: 'button button-ghost button-small',
                    textContent: 'Remove',
                });
                remove.addEventListener('click', () => {
                    state.draft.rewards.splice(index, 1);
                    state.changed();
                    renderRows();
                });
                return el('div', { className: 'reward-row' }, [
                    el('span', { className: 'reward-label', textContent: 'Level' }),
                    numberInput({
                        value: reward.level,
                        min: 1,
                        max: state.draft.maxLevel,
                        onChange: (level) => {
                            reward.level = level;
                            state.changed();
                        },
                    }),
                    roleSelect({
                        roles,
                        value: reward.roleId,
                        onChange: (roleId) => {
                            reward.roleId = roleId;
                            state.changed();
                        },
                    }),
                    remove,
                ]);
            });

            const add = el('button', { type: 'button', className: 'button button-ghost', textContent: '+ Add reward' });
            add.disabled = state.draft.rewards.length >= limits.MAX_REWARDS;
            add.addEventListener('click', () => {
                const highest = Math.max(0, ...state.draft.rewards.map((reward) => reward.level));
                state.draft.rewards.push({ level: Math.min(highest + 5, state.draft.maxLevel), roleId: null });
                state.changed();
                renderRows();
            });

            list.replaceChildren(
                ...(rows.length ? rows : [el('p', { className: 'chips-empty', textContent: 'No rewards yet.' })]),
                add
            );
        };

        renderRows();
        return list;
    }

    function render() {
        const draft = state.draft;
        const channelOptions = channels
            .filter((channel) => channel.type !== 'other')
            .map((channel) => ({ id: channel.id, label: `${channel.type === 'voice' ? '🔊 ' : '# '}${channel.name}` }));
        const roleOptions = roles.map((role) => ({ id: role.id, label: `@${role.name}` }));

        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Levels' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent: 'Members earn XP for chatting and talking in voice, and level up over time.',
                }),
            ]),

            card('General', null, [
                field({
                    label: 'Levels',
                    description: 'Turn XP and levelling on for this server.',
                    id: 'levels-enabled',
                    control: toggle({
                        id: 'levels-enabled',
                        label: 'Levels',
                        checked: draft.enabled,
                        onChange: (value) => set('enabled', value),
                    }),
                }),
                field({
                    label: 'Level-up channel',
                    description: 'Where level-up messages are posted. Required for levels to work.',
                    id: 'levels-channel',
                    control: channelSelect({
                        id: 'levels-channel',
                        channels,
                        value: draft.channelId,
                        noneLabel: 'Choose a channel',
                        onChange: (value) => set('channelId', value),
                    }),
                }),
                field({
                    label: 'Level-up message',
                    description:
                        'Use {user} for the member and {level} for their new level. Leave empty for the default.',
                    id: 'levels-message',
                    stacked: true,
                    control: textArea({
                        id: 'levels-message',
                        value: draft.levelUpMessage,
                        maxLength: limits.LEVEL_UP_MESSAGE_MAX,
                        placeholder: DEFAULT_MESSAGE,
                        onChange: (value) => set('levelUpMessage', value),
                    }),
                }),
            ]),

            card(
                'Where members earn XP',
                'Ovx only sees messages in channels it can view. Messages under 5 characters (without an attachment) don’t count, and voice XP needs 2 or more people in the channel who aren’t deafened.',
                [coverage]
            ),

            card('XP', null, [
                field({
                    label: 'Message cooldown',
                    description: 'How long a member waits between messages that earn XP.',
                    id: 'levels-cooldown',
                    control: numberInput({
                        id: 'levels-cooldown',
                        value: draft.messageCooldown,
                        min: limits.MESSAGE_COOLDOWN_MIN,
                        max: limits.MESSAGE_COOLDOWN_MAX,
                        suffix: 'seconds',
                        onChange: (value) => set('messageCooldown', value),
                    }),
                }),
                field({
                    label: 'Max level',
                    description: 'Members stop earning XP at this level.',
                    id: 'levels-max',
                    control: numberInput({
                        id: 'levels-max',
                        value: draft.maxLevel,
                        min: limits.MAX_LEVEL_MIN,
                        max: limits.MAX_LEVEL_MAX,
                        onChange: (value) => set('maxLevel', value),
                    }),
                }),
            ]),

            card('Level rewards', 'Roles members get when they reach a level. Ovx can only give roles below its own.', [
                rewardsList(),
                field({
                    label: 'Remove past rewards',
                    description: 'Take away lower reward roles when a member gets a higher one.',
                    id: 'levels-remove-past',
                    control: toggle({
                        id: 'levels-remove-past',
                        label: 'Remove past rewards',
                        checked: draft.removePastRewards,
                        onChange: (value) => set('removePastRewards', value),
                    }),
                }),
            ]),

            card('No-XP list', 'Members with these roles, or in these channels, don’t earn XP.', [
                field({
                    label: 'Roles',
                    stacked: true,
                    control: chipPicker({
                        options: roleOptions,
                        selected: draft.blacklisted.roleIds,
                        placeholder: 'Add a role…',
                        emptyText: 'No roles',
                        onChange: (ids) => {
                            draft.blacklisted.roleIds = ids;
                            state.changed();
                            updateCoverage();
                        },
                    }),
                }),
                field({
                    label: 'Channels',
                    stacked: true,
                    control: chipPicker({
                        options: channelOptions,
                        selected: draft.blacklisted.channelIds,
                        placeholder: 'Add a channel…',
                        emptyText: 'No channels',
                        onChange: (ids) => {
                            draft.blacklisted.channelIds = ids;
                            state.changed();
                            updateCoverage();
                        },
                    }),
                }),
            ]),

            card('Leaderboard', null, [
                field({
                    label: 'Public leaderboard',
                    description:
                        'Let anyone with the link see member names and levels, without logging in. (The public page is coming soon.)',
                    id: 'levels-public',
                    control: toggle({
                        id: 'levels-public',
                        label: 'Public leaderboard',
                        checked: draft.publicLeaderboard,
                        onChange: (value) => set('publicLeaderboard', value),
                    }),
                }),
            ]),

            resetCard({
                description:
                    'Turns levels off and puts every level setting back to its default. Members keep their XP and levels.',
                confirmMessage:
                    'Levels will be turned off and every level setting, including rewards and no-XP roles and channels, goes back to its default. Members keep their XP and levels. This cannot be undone.',
                onReset: resetToDefaults,
            }),

            state.bar
        );
        state.changed();
        updateCoverage();
    }

    render();
    return () => state.dispose();
}
