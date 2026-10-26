// Levels page: where members earn XP, and what stops it. No page code here, so the tests can load it.

/**
 * Whether a channel earns XP with these settings, and if not, why.
 * @param {any} channel - From the overview's channel list
 * @param {any} draft - The level settings
 * @returns {{ earns: boolean, reason: string }}
 */
export function channelXPStatus(channel, draft) {
    if (draft.blacklisted.channelIds.includes(channel.id)) return { earns: false, reason: 'On the no-XP list' };
    if (channel.afk) return { earns: false, reason: 'The AFK channel' };
    if (!channel.botCanView) return { earns: false, reason: 'Ovx can’t see this channel' };
    return { earns: true, reason: channel.type === 'voice' ? 'Voice and its chat' : 'Messages' };
}

/**
 * What stops XP everywhere, if anything: the most important problem first.
 * @param {any} draft - The level settings being edited
 * @param {any} saved - The level settings as saved
 * @param {any[]} channels
 * @returns {{ kind: 'warn' | 'ok', text: string } | null}
 */
export function levelsBlocker(draft, saved, channels) {
    const levelUp = channels.find((channel) => channel.id === draft.channelId);
    const cannotPost = (channel) =>
        `Ovx can’t post in #${channel.name}. It needs View Channel, Send Messages and Embed Links there`;
    if (!draft.enabled) {
        const savedChannel = channels.find((channel) => channel.id === saved.channelId);
        if (!saved.enabled && savedChannel && !savedChannel.botCanPost) {
            return {
                kind: 'warn',
                text: `Levels are off, so nobody earns XP. ${cannotPost(savedChannel)}, and Ovx turns levels off by itself when it can’t post level-ups. Fix that, then turn levels back on.`,
            };
        }
        return { kind: 'warn', text: 'Levels are off, so nobody earns XP.' };
    }
    if (!draft.channelId) return { kind: 'warn', text: 'Nobody earns XP until you choose a level-up channel.' };
    if (!levelUp) return { kind: 'warn', text: 'The level-up channel was deleted. Choose another one.' };
    if (!levelUp.botCanPost) {
        return {
            kind: 'warn',
            text: `${cannotPost(levelUp)}. Until it can, Ovx will turn levels off as soon as someone chats.`,
        };
    }
    return null;
}
