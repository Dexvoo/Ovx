// Starboard page: messages that get enough stars are reposted in a starboard channel.
import { el, apiSend, toast } from './ui.js';
import {
    card,
    field,
    toggle,
    channelSelect,
    numberInput,
    chipPicker,
    createSettingsState,
    resetCard,
} from './forms.js';
import { emojiNode, emojiPicker } from './ticketTypes.js';
import { markdown } from './markdown.js';

const STAR_COLOUR = '#f5b301';

/** The count emoji, as the bot shows it: the default star grows with popularity. */
function countEmoji(emoji, stars) {
    if (emoji.replace(/️/g, '') !== '⭐') return emoji;
    if (stars >= 25) return '✨';
    if (stars >= 10) return '💫';
    if (stars >= 5) return '🌟';
    return '⭐';
}

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderStarboard(container, overview) {
    const { guild, channels } = overview;
    const limits = overview.limits.STARBOARD;

    const state = createSettingsState({
        saved: overview.starboard,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/starboard`, draft);
            if (status === 200) {
                overview.starboard = data;
                toast('Starboard saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/starboard`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.starboard = data;
        state.replaceSaved(data);
        render();
        toast('Starboard reset');
        return true;
    }

    const switchField = (key, label, description) =>
        field({
            label,
            description,
            id: `star-${key}`,
            control: toggle({
                id: `star-${key}`,
                label,
                checked: state.draft[key],
                onChange: (checked) => {
                    state.draft[key] = checked;
                    state.changed();
                },
            }),
        });

    const previewHost = el('div');
    function refreshPreview() {
        const { emoji, threshold } = state.draft;
        const stars = Math.max(threshold, 5);
        const embed = el('div', { className: 'preview-embed' }, [
            el('div', { className: 'preview-embed-text' }, [
                el('div', { className: 'preview-embed-author' }, [el('span', { textContent: 'Someone' })]),
                el('div', {}, markdown('This message got enough stars to make it onto the **starboard**!')),
                el('div', { className: 'preview-embed-footer' }, [
                    el('span', { textContent: 'ID: 123456789 • Today' }),
                ]),
            ]),
        ]);
        embed.style.borderLeftColor = STAR_COLOUR;
        const channelName = channels.find((channel) => channel.type === 'text')?.name ?? 'general';
        previewHost.replaceChildren(
            el('div', { className: 'preview-message' }, [
                el('img', { className: 'preview-avatar', src: overview.bot.avatar, alt: '' }),
                el('div', { className: 'preview-content' }, [
                    el('div', { className: 'preview-author' }, [
                        el('span', {
                            className: 'preview-name',
                            textContent: overview.bot.nickname || overview.bot.username,
                        }),
                        el('span', { className: 'bot-preview-tag', textContent: 'APP' }),
                    ]),
                    el('div', { className: 'preview-text' }, [
                        emojiNode(countEmoji(emoji, stars)),
                        ' ',
                        el('strong', { textContent: String(stars) }),
                        ' | ',
                        el('span', { className: 'preview-mention', textContent: `#${channelName}` }),
                    ]),
                    embed,
                    el('div', { className: 'preview-buttons' }, [
                        el('span', {
                            className: 'preview-button preview-button-secondary',
                            textContent: 'Jump to message ↗',
                        }),
                    ]),
                ]),
            ])
        );
    }

    function emojiControl() {
        const button = el('button', {
            type: 'button',
            className: 'emoji-button',
            title: 'Choose the emoji',
            'aria-label': 'Choose the star emoji',
        });
        const show = () => button.replaceChildren(emojiNode(state.draft.emoji));
        show();
        const picker = emojiPicker({
            emojis: overview.emojis,
            onPick: (emoji) => {
                state.draft.emoji = emoji ?? '⭐';
                show();
                refreshPreview();
                state.changed();
            },
        });
        button.addEventListener('click', () => picker.toggle(button));
        return el('div', { className: 'emoji-field' }, [button, picker.element]);
    }

    function render() {
        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Starboard' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent:
                        'When a message gets enough stars, Ovx reposts it in a starboard channel, a hall of fame for the best messages.',
                }),
            ]),

            card('Starboard', null, [
                switchField('enabled', 'Starboard', 'Repost starred messages. Choose a channel first.'),
                field({
                    label: 'Channel',
                    description: 'Where starred messages are posted. Members usually can’t send messages there.',
                    id: 'star-channel',
                    control: channelSelect({
                        channels,
                        value: state.draft.channelId,
                        noneLabel: 'Choose a channel',
                        id: 'star-channel',
                        onChange: (id) => {
                            state.draft.channelId = id;
                            state.changed();
                        },
                    }),
                }),
                field({
                    label: 'Emoji',
                    description: 'The reaction that counts as a star. One of this server’s emojis works too.',
                    control: emojiControl(),
                }),
                field({
                    label: 'Stars needed',
                    description: 'How many stars a message needs to be posted.',
                    id: 'star-threshold',
                    control: numberInput({
                        value: state.draft.threshold,
                        min: 1,
                        max: limits.THRESHOLD_MAX,
                        id: 'star-threshold',
                        onChange: (value) => {
                            state.draft.threshold = value;
                            refreshPreview();
                            state.changed();
                        },
                    }),
                }),
            ]),

            card('Rules', null, [
                switchField('selfStar', 'Count self-stars', 'The author’s own star counts towards the total.'),
                switchField('allowBots', 'Bot messages', 'Messages from bots can be starred.'),
                switchField(
                    'removeBelow',
                    'Remove when unstarred',
                    'Take the post down if its stars drop below the number needed again.'
                ),
                field({
                    label: 'Ignored channels',
                    description:
                        'Messages here are never posted. Messages from age-restricted channels only go to an age-restricted starboard.',
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
                        emptyText: 'No ignored channels',
                        onChange: (ids) => {
                            state.draft.ignoredChannelIds = ids;
                            state.changed();
                        },
                    }),
                }),
            ]),

            card('Preview', 'How a starred message looks on the starboard. The star grows as it gets more popular.', [
                previewHost,
            ]),

            resetCard({
                description:
                    'Turns the starboard off and puts its settings back to the defaults. Posts already made stay.',
                confirmMessage:
                    'The starboard will be turned off and its settings reset. Posts already made are not deleted.',
                onReset: resetToDefaults,
            }),

            state.bar
        );
        refreshPreview();
        state.changed();
    }

    render();
    return () => state.dispose();
}
