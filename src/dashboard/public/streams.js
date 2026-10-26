// Stream notification pages (Twitch, YouTube, Kick): post in Discord when streamers go live or upload.
import { el, apiSend, toast } from './ui.js';
import {
    card,
    field,
    toggle,
    channelSelect,
    textArea,
    createSettingsState,
    resetCard,
    confirmDialog,
} from './forms.js';

const PLATFORM_INFO = {
    twitch: {
        name: 'Twitch',
        placeholder: 'Twitch username or link, e.g. shroud',
        setup: 'Twitch notifications need TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in the bot’s .env file (from dev.twitch.tv/console).',
    },
    youtube: {
        name: 'YouTube',
        placeholder: '@handle, channel link or channel ID',
        setup: '',
    },
    kick: {
        name: 'Kick',
        placeholder: 'Kick username or link, e.g. xqc',
        setup: 'Kick notifications need KICK_CLIENT_ID and KICK_CLIENT_SECRET in the bot’s .env file (from kick.com/settings/developer).',
    },
};

/** The parts of a subscription the save bar tracks. */
const editable = (subscription) => ({
    id: subscription.id,
    channelId: subscription.channelId,
    roleId: subscription.roleId,
    liveMessage: subscription.liveMessage,
    videoMessage: subscription.videoMessage,
    notifyLive: subscription.notifyLive,
    notifyVideos: subscription.notifyVideos,
});

/**
 * @param {'twitch' | 'youtube' | 'kick'} platform
 * @returns {(container: HTMLElement, overview: any) => () => void}
 */
export function streamsPage(platform) {
    return (container, overview) => renderStreams(container, overview, platform);
}

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @param {'twitch' | 'youtube' | 'kick'} platform
 * @returns {() => void} Cleanup when leaving the page
 */
function renderStreams(container, overview, platform) {
    const { guild, channels, roles } = overview;
    const info = PLATFORM_INFO[platform];
    const status = overview.streamStatus;
    const configured = platform === 'youtube' ? true : status[platform];
    const ofPlatform = () => overview.streams.filter((subscription) => subscription.platform === platform);

    const state = createSettingsState({
        saved: ofPlatform().map(editable),
        onReset: () => render(),
        async onSave(draft) {
            const { status: code, data } = await apiSend('PUT', `/api/guilds/${guild.id}/streams/${platform}`, draft);
            if (code === 200) {
                overview.streams = [...overview.streams.filter((s) => s.platform !== platform), ...data];
                toast(`${info.name} notifications saved`);
                return { ok: true, saved: data.map(editable) };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    /** After following or unfollowing: the server's list is the new saved state. */
    function refreshSaved() {
        state.replaceSaved(ofPlatform().map(editable));
        render();
    }

    /** Ping choices: nobody, @everyone, or a role. */
    function pingSelect(value, onChange, id) {
        const select = el('select', { className: 'select', id }, [
            el('option', { value: '', textContent: 'No ping', selected: !value }),
            el('option', { value: 'everyone', textContent: '@everyone', selected: value === 'everyone' }),
            ...roles.map((role) =>
                el('option', { value: role.id, textContent: `@${role.name}`, selected: value === role.id })
            ),
        ]);
        select.addEventListener('change', () => onChange(select.value || null));
        return select;
    }

    function addCard() {
        const limit = overview.streamLimit;
        const full = limit.used >= limit.max;
        let channelId = null;
        let roleId = null;

        const query = el('input', {
            className: 'input input-wide',
            type: 'text',
            placeholder: info.placeholder,
            maxLength: 100,
        });
        const add = el('button', { type: 'button', className: 'button button-primary', textContent: 'Follow' });
        const busy = () => state.dirty;
        add.disabled = full || busy();
        add.addEventListener('click', async () => {
            if (state.dirty) return toast('Save or reset your changes first', 'error');
            if (!query.value.trim()) return toast('Enter a username, channel or link', 'error');
            if (!channelId) return toast('Choose a channel to post in', 'error');
            add.disabled = true;
            add.textContent = 'Looking up…';
            const { status: code, data } = await apiSend('POST', `/api/guilds/${guild.id}/streams`, {
                platform,
                query: query.value.trim(),
                channelId,
                roleId,
            });
            add.textContent = 'Follow';
            add.disabled = false;
            if (code !== 200)
                return toast(data?.details?.[0] ?? data?.error ?? 'Could not follow. Try again.', 'error');

            overview.streams.push(data.subscription);
            overview.streamLimit = data.limit;
            toast(`Now following ${data.subscription.account.displayName}`);
            refreshSaved();
        });

        return card(`Follow a ${info.name} ${platform === 'youtube' ? 'channel' : 'streamer'}`, null, [
            el('p', {
                className: 'field-description',
                textContent: `${limit.used} of ${limit.max} followed across Twitch, YouTube and Kick.${
                    limit.premium
                        ? ' (Premium)'
                        : ` Premium servers can follow up to ${overview.limits.STREAMS.PREMIUM}.`
                }`,
            }),
            full &&
                el('p', {
                    className: 'notice',
                    textContent: 'This server is following as many as it can. Unfollow one to add another.',
                }),
            busy() &&
                el('p', {
                    className: 'notice',
                    textContent: 'Save or reset your changes below before following someone new.',
                }),
            field({ label: platform === 'youtube' ? 'Channel' : 'Streamer', stacked: true, control: query }),
            field({
                label: 'Post in',
                control: channelSelect({
                    channels,
                    value: null,
                    noneLabel: 'Choose a channel',
                    onChange: (id) => (channelId = id),
                }),
            }),
            field({ label: 'Ping', control: pingSelect(null, (id) => (roleId = id)) }),
            el('div', { className: 'input-row' }, [add]),
        ]);
    }

    function subscriptionCard(subscription, draft) {
        const set = (key, value) => {
            draft[key] = value;
            state.changed();
        };
        const { account } = subscription;

        const testButton = el('button', { type: 'button', className: 'button button-ghost', textContent: 'Send test' });
        testButton.addEventListener('click', async () => {
            if (state.dirty) return toast('Save your changes first, so the test uses them', 'error');
            testButton.disabled = true;
            const { status: code, data } = await apiSend(
                'POST',
                `/api/guilds/${guild.id}/streams/${subscription.id}/test`,
                {}
            );
            testButton.disabled = false;
            toast(
                code === 200 ? 'Test notification sent' : (data?.error ?? 'Could not send a test.'),
                code === 200 ? 'success' : 'error'
            );
        });

        const removeButton = el('button', {
            type: 'button',
            className: 'button button-danger-ghost',
            textContent: 'Unfollow',
        });
        removeButton.addEventListener('click', async () => {
            if (state.dirty) return toast('Save or reset your changes first', 'error');
            const confirmed = await confirmDialog({
                title: `Unfollow ${account.displayName}?`,
                message: 'No more notifications will be posted for them in this server.',
                confirmLabel: 'Unfollow',
            });
            if (!confirmed) return;
            const { status: code, data } = await apiSend(
                'DELETE',
                `/api/guilds/${guild.id}/streams/${subscription.id}`,
                {}
            );
            if (code !== 200) return toast(data?.error ?? 'Could not unfollow. Try again.', 'error');
            overview.streams = overview.streams.filter((s) => s.id !== subscription.id);
            overview.streamLimit = data.limit;
            toast(`Unfollowed ${account.displayName}`);
            refreshSaved();
        });

        const isYouTube = platform === 'youtube';
        const liveAvailable = !isYouTube || status.youtubeLive;

        return el('section', { className: 'card settings-card stream-card' }, [
            el('div', { className: 'stream-header' }, [
                account.avatar
                    ? el('img', { className: 'stream-avatar', src: account.avatar, alt: '', width: 48, height: 48 })
                    : el('span', { className: 'stream-avatar', 'aria-hidden': 'true' }),
                el('div', { className: 'stream-name' }, [
                    el('a', {
                        href: account.url,
                        target: '_blank',
                        rel: 'noreferrer',
                        textContent: account.displayName,
                    }),
                    el('span', {
                        className: 'field-description',
                        textContent: isYouTube ? 'YouTube channel' : `${info.name} streamer`,
                    }),
                ]),
                el('div', { className: 'stream-actions' }, [testButton, removeButton]),
            ]),
            field({
                label: 'Post in',
                control: channelSelect({
                    channels,
                    value: draft.channelId,
                    noneLabel: 'Choose a channel',
                    onChange: (id) => set('channelId', id),
                }),
            }),
            field({ label: 'Ping', control: pingSelect(draft.roleId, (id) => set('roleId', id)) }),
            isYouTube &&
                field({
                    label: 'New videos',
                    id: `videos-${subscription.id}`,
                    control: toggle({
                        id: `videos-${subscription.id}`,
                        label: 'New videos',
                        checked: draft.notifyVideos,
                        onChange: (value) => set('notifyVideos', value),
                    }),
                }),
            field({
                label: 'Live streams',
                description: liveAvailable ? '' : 'Needs a YouTube API key (YOUTUBE_API_KEY in the bot’s .env file).',
                id: `live-${subscription.id}`,
                control: disabledUnless(
                    liveAvailable,
                    toggle({
                        id: `live-${subscription.id}`,
                        label: 'Live streams',
                        checked: draft.notifyLive && liveAvailable,
                        onChange: (value) => set('notifyLive', value),
                    })
                ),
            }),
            field({
                label: 'Live message',
                description: 'Placeholders: {streamer} {title} {game} {platform} {url}',
                stacked: true,
                control: textArea({
                    value: draft.liveMessage,
                    maxLength: overview.limits.STREAMS.MESSAGE_MAX,
                    placeholder: overview.streamDefaults.liveMessage,
                    onChange: (value) => set('liveMessage', value || null),
                }),
            }),
            isYouTube &&
                field({
                    label: 'Video message',
                    stacked: true,
                    control: textArea({
                        value: draft.videoMessage,
                        maxLength: overview.limits.STREAMS.MESSAGE_MAX,
                        placeholder: overview.streamDefaults.videoMessage,
                        onChange: (value) => set('videoMessage', value || null),
                    }),
                }),
        ]);
    }

    function render() {
        const subscriptions = ofPlatform();
        const header = el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: info.name }),
            el('p', {
                className: 'page-subtitle',
                textContent:
                    platform === 'youtube'
                        ? 'Post in Discord when channels upload a video or go live.'
                        : `Post in Discord when ${info.name} streamers go live.`,
            }),
        ]);

        if (!configured) {
            container.replaceChildren(
                header,
                card('Not set up yet', null, [el('p', { className: 'notice', textContent: info.setup })]),
                state.bar
            );
            return;
        }

        // Each subscription card edits the matching draft entry
        const drafts = new Map(state.draft.map((draft) => [draft.id, draft]));

        container.replaceChildren(
            header,
            addCard(),
            ...subscriptions.filter((s) => drafts.has(s.id)).map((s) => subscriptionCard(s, drafts.get(s.id))),
            ...(subscriptions.length > 0
                ? [
                      resetCard({
                          description: `Unfollows every ${info.name} ${platform === 'youtube' ? 'channel' : 'streamer'} in this server.`,
                          confirmMessage: `Every ${info.name} ${platform === 'youtube' ? 'channel' : 'streamer'} will be unfollowed and no more notifications posted for them. This cannot be undone.`,
                          onReset: async () => {
                              const { status: code, data } = await apiSend(
                                  'POST',
                                  `/api/guilds/${guild.id}/reset/${platform}`,
                                  {}
                              );
                              if (code !== 200) {
                                  toast(data?.error ?? 'Could not reset. Try again.', 'error');
                                  return false;
                              }
                              overview.streams = overview.streams.filter((s) => s.platform !== platform);
                              overview.streamLimit = { ...overview.streamLimit, used: overview.streams.length };
                              toast(`Unfollowed every ${info.name} ${platform === 'youtube' ? 'channel' : 'streamer'}`);
                              refreshSaved();
                              return true;
                          },
                      }),
                  ]
                : []),
            state.bar
        );
        state.changed();
    }

    render();
    return () => state.dispose();
}

/**
 * Disables a toggle (e.g. live streams without a YouTube API key).
 * @param {boolean} enabled
 * @param {HTMLElement} control - From toggle()
 */
function disabledUnless(enabled, control) {
    const input = /** @type {HTMLInputElement | null} */ (control.querySelector('input'));
    if (input && !enabled) input.disabled = true;
    return control;
}
