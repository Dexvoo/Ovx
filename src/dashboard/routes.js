import { Router } from 'express';
import { requireLogin, requireDeveloper, validGuildId } from './middleware.js';
import { LogData } from '../shared/utils/logger.js';
import { inviteUrl } from '../shared/utils/invite.js';
import { usageReport as defaultUsageReport, USAGE_WINDOWS } from '../features/usage/utils/report.js';

const LEADERBOARD_TYPES = new Set(['level', 'totalMessages', 'totalVoice', 'totalCommands']);
const PUBLIC_CACHE_MS = 60_000;
const PUBLIC_CACHE_MAX = 500;
const PUBLIC_STATS_MS = 5 * 60_000;
const PUBLIC_HEALTH_MS = 15_000;
const USAGE_CACHE_MS = 5 * 60_000;
const CASE_NUMBER = /^[1-9]\d{0,8}$/;
const CASE_LABELS = {
    warn: 'Warning',
    ban: 'Ban',
    unban: 'Unban',
    kick: 'Kick',
    mute: 'Mute',
    unmute: 'Unmute',
    note: 'Note',
};

/**
 * JSON API for the dashboard UI.
 *
 * @param {{
 *   bridge: ReturnType<typeof import('./shardBridge.js').createShardBridge>,
 *   applicationId: string,
 *   developerIds: string[],
 *   auditStore: import('./auditStore.js').AuditStore,
 *   caseStore: ReturnType<typeof import('../features/moderation/utils/cases.js').createMongoCaseStore>,
 *   usageReport?: typeof defaultUsageReport,
 * }} options
 */
export function createApiRouter({
    bridge,
    applicationId,
    developerIds,
    auditStore,
    caseStore,
    usageReport = defaultUsageReport,
}) {
    const router = Router();
    const publicCache = new Map();

    /**
     * Writes a Web Logs entry after a successful save. A failure here is logged but doesn't undo
     * or fail the save, which has already been applied by the bot.
     */
    const recordAudit = async (req, action, changes) => {
        if (!changes?.length) return; // Nothing actually changed
        try {
            await auditStore.record({ guildId: req.params.guildId, user: req.session.user, action, changes });
        } catch (error) {
            LogData('Dashboard', `Could not write Web Logs entry for ${req.params.guildId}: ${error.message}`, 'error');
        }
    };

    /** Sends a shard result, or a 503 if the shard couldn't be reached (e.g. restarting). */
    const respond = async (res, run) => {
        let result;
        try {
            result = await run();
        } catch (error) {
            // Errors inside the shard come back as results (see shardHandlers.js), so this means it was unreachable
            LogData('Dashboard', `Could not reach the shard: ${error.message}`, 'warning');
            return res.status(503).json({ error: 'The bot is restarting, try again in a moment' });
        }
        if (!result.ok) return res.status(result.status).json({ error: result.error, details: result.details });
        res.json(result.data);
    };

    router.get('/me', requireLogin, async (req, res) => {
        const { user, guilds } = req.session;

        let botGuildIds = new Set();
        try {
            botGuildIds = await bridge.botGuildIds(guilds.map((guild) => guild.id));
        } catch (error) {
            LogData('Dashboard', `Could not check bot servers: ${error.message}`, 'warning');
        }

        res.json({
            user: { ...user, isDeveloper: developerIds.includes(user.id) },
            guilds: guilds.map((guild) => ({
                ...guild,
                botPresent: botGuildIds.has(guild.id),
                inviteUrl: botGuildIds.has(guild.id) ? null : inviteUrl(applicationId, guild.id),
            })),
        });
    });

    router.get('/guilds/:guildId', requireLogin, validGuildId, (req, res) =>
        respond(res, () => bridge.guild('guildOverview', req.params.guildId, { userId: req.session.user.id }))
    );

    router.put('/guilds/:guildId/levels', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveLevelSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok) {
                LogData(
                    'Dashboard',
                    `Level settings saved for ${req.params.guildId} by ${req.session.user.id}`,
                    'info'
                );
                await recordAudit(req, 'Updated level settings', result.changes);
                // Visibility may have changed, so drop any cached public copy
                for (const key of publicCache.keys()) if (key.startsWith(req.params.guildId)) publicCache.delete(key);
            }
            return result;
        })
    );

    router.put('/guilds/:guildId/bot', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveBotSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length) {
                LogData('Dashboard', `Bot settings saved for ${req.params.guildId} by ${req.session.user.id}`, 'info');
                await recordAudit(req, 'Updated bot settings', result.changes);
            }
            return result;
        })
    );

    router.put('/guilds/:guildId/auto-roles', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveAutoRoleSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length) {
                LogData('Dashboard', `Auto roles saved for ${req.params.guildId} by ${req.session.user.id}`, 'info');
                await recordAudit(req, 'Updated auto roles', result.changes);
            }
            return result;
        })
    );

    router.put('/guilds/:guildId/moderation', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveModerationSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length) {
                LogData(
                    'Dashboard',
                    `Moderation settings saved for ${req.params.guildId} by ${req.session.user.id}`,
                    'info'
                );
                await recordAudit(req, 'Updated automatic moderation', result.changes);
            }
            return result;
        })
    );

    /** Runs a temp voice action on the shard, recording a Web Logs entry when it changed something. */
    const tempVoiceAction = (req, res, payload) =>
        respond(res, async () => {
            const result = await bridge.guild('tempVoice', req.params.guildId, {
                userId: req.session.user.id,
                ...payload,
            });
            if (result.ok && result.changes?.length) await recordAudit(req, result.action, result.changes);
            return result;
        });

    router.put('/guilds/:guildId/temp-voice', requireLogin, validGuildId, (req, res) =>
        tempVoiceAction(req, res, { op: 'save', settings: req.body })
    );

    router.post('/guilds/:guildId/temp-voice/setup', requireLogin, validGuildId, (req, res) =>
        tempVoiceAction(req, res, { op: 'setup' })
    );

    const SUGGESTION_ID = /^[a-f\d]{24}$/i;
    const suggestionsAction = (req, res, payload) =>
        respond(res, async () => {
            const result = await bridge.guild('suggestions', req.params.guildId, {
                userId: req.session.user.id,
                ...payload,
            });
            if (result.ok && result.action && result.changes?.length)
                await recordAudit(req, result.action, result.changes);
            return result;
        });

    router.get('/guilds/:guildId/suggestions', requireLogin, validGuildId, (req, res) =>
        suggestionsAction(req, res, {
            op: 'list',
            status: typeof req.query.status === 'string' ? req.query.status : null,
        })
    );

    router.put('/guilds/:guildId/suggestion-settings', requireLogin, validGuildId, (req, res) =>
        suggestionsAction(req, res, { op: 'settings', settings: req.body })
    );

    router.post('/guilds/:guildId/suggestions/:suggestionId/decide', requireLogin, validGuildId, (req, res) => {
        if (!SUGGESTION_ID.test(req.params.suggestionId)) return res.status(404).json({ error: 'Not found' });
        return suggestionsAction(req, res, {
            op: 'decide',
            suggestionId: req.params.suggestionId,
            status: req.body?.status,
            reason: req.body?.reason,
        });
    });

    router.delete('/guilds/:guildId/suggestions/:suggestionId', requireLogin, validGuildId, (req, res) => {
        if (!SUGGESTION_ID.test(req.params.suggestionId)) return res.status(404).json({ error: 'Not found' });
        return suggestionsAction(req, res, { op: 'delete', suggestionId: req.params.suggestionId });
    });

    router.put('/guilds/:guildId/verification', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveVerification', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length) await recordAudit(req, result.action, result.changes);
            return result;
        })
    );

    router.get('/guilds/:guildId/automod', requireLogin, validGuildId, (req, res) =>
        respond(res, () => bridge.guild('automod', req.params.guildId, { userId: req.session.user.id, op: 'get' }))
    );

    router.put('/guilds/:guildId/automod', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('automod', req.params.guildId, {
                userId: req.session.user.id,
                op: 'save',
                settings: req.body,
            });
            if (result.ok && result.changes?.length) await recordAudit(req, result.action, result.changes);
            return result;
        })
    );

    const STATS_CHANNEL = /^\d{17,20}$/;
    const serverStatsAction = (req, res, payload) =>
        respond(res, async () => {
            const result = await bridge.guild('serverStats', req.params.guildId, {
                userId: req.session.user.id,
                ...payload,
            });
            if (result.ok && result.action && result.changes?.length)
                await recordAudit(req, result.action, result.changes);
            return result;
        });

    router.get('/guilds/:guildId/server-stats', requireLogin, validGuildId, (req, res) =>
        serverStatsAction(req, res, { op: 'get' })
    );

    router.post('/guilds/:guildId/server-stats', requireLogin, validGuildId, (req, res) =>
        serverStatsAction(req, res, { op: 'add', type: req.body?.type, roleId: req.body?.roleId })
    );

    router.put('/guilds/:guildId/server-stats/:channelId', requireLogin, validGuildId, (req, res) => {
        if (!STATS_CHANNEL.test(req.params.channelId)) return res.status(404).json({ error: 'Not found' });
        return serverStatsAction(req, res, {
            op: 'rename',
            channelId: req.params.channelId,
            template: req.body?.template,
        });
    });

    router.delete('/guilds/:guildId/server-stats/:channelId', requireLogin, validGuildId, (req, res) => {
        if (!STATS_CHANNEL.test(req.params.channelId)) return res.status(404).json({ error: 'Not found' });
        return serverStatsAction(req, res, { op: 'remove', channelId: req.params.channelId });
    });

    const AUTO_ID = /^[a-f\d]{24}$/i;
    const autoMessagesAction = (req, res, payload) =>
        respond(res, async () => {
            const result = await bridge.guild('autoMessages', req.params.guildId, {
                userId: req.session.user.id,
                ...payload,
            });
            if (result.ok && result.action && result.changes?.length)
                await recordAudit(req, result.action, result.changes);
            return result;
        });

    router.get('/guilds/:guildId/auto-messages', requireLogin, validGuildId, (req, res) =>
        autoMessagesAction(req, res, { op: 'list' })
    );

    for (const [kind, op] of [
        ['auto', 'saveAuto'],
        ['sticky', 'saveSticky'],
    ]) {
        router.post(`/guilds/:guildId/auto-messages/${kind}`, requireLogin, validGuildId, (req, res) =>
            autoMessagesAction(req, res, { op, message: req.body })
        );
        router.put(`/guilds/:guildId/auto-messages/${kind}/:id`, requireLogin, validGuildId, (req, res) => {
            if (!AUTO_ID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
            return autoMessagesAction(req, res, { op, id: req.params.id, message: req.body });
        });
        router.delete(`/guilds/:guildId/auto-messages/${kind}/:id`, requireLogin, validGuildId, (req, res) => {
            if (!AUTO_ID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
            return autoMessagesAction(req, res, { op: op.replace('save', 'delete'), id: req.params.id });
        });
    }

    router.put('/guilds/:guildId/commands', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveCommandSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length) await recordAudit(req, 'Updated command settings', result.changes);
            return result;
        })
    );

    router.put('/guilds/:guildId/starboard', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveStarboardSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length) await recordAudit(req, 'Updated the starboard', result.changes);
            return result;
        })
    );

    router.put('/guilds/:guildId/invite-blocker', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveInviteSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length)
                await recordAudit(req, 'Updated the invite blocker', result.changes);
            return result;
        })
    );

    router.put('/guilds/:guildId/honeypot', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveHoneypotSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length)
                await recordAudit(req, 'Updated the honeypot channel', result.changes);
            return result;
        })
    );

    router.post('/guilds/:guildId/honeypot/warning', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('postHoneypotWarning', req.params.guildId, {
                userId: req.session.user.id,
            });
            if (result.ok) await recordAudit(req, 'Posted the honeypot warning', result.changes);
            return result;
        })
    );

    router.put('/guilds/:guildId/welcome', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveWelcomeSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length) {
                LogData(
                    'Dashboard',
                    `Welcome messages saved for ${req.params.guildId} by ${req.session.user.id}`,
                    'info'
                );
                await recordAudit(req, 'Updated welcome messages', result.changes);
            }
            return result;
        })
    );

    router.put('/guilds/:guildId/tickets', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveTicketSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok && result.changes?.length) {
                LogData(
                    'Dashboard',
                    `Ticket settings saved for ${req.params.guildId} by ${req.session.user.id}`,
                    'info'
                );
                await recordAudit(req, 'Updated ticket settings', result.changes);
            }
            return result;
        })
    );

    router.post('/guilds/:guildId/tickets/panel', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('postTicketPanel', req.params.guildId, {
                userId: req.session.user.id,
                channelId: req.body?.channelId,
            });
            if (result.ok) await recordAudit(req, 'Updated ticket settings', result.changes);
            return result;
        })
    );

    const STREAM_PLATFORMS = new Set(['twitch', 'youtube', 'kick']);
    const SUBSCRIPTION_ID = /^[a-f\d]{24}$/i;

    router.post('/guilds/:guildId/streams', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('addStream', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok) await recordAudit(req, 'Updated stream notifications', result.changes);
            return result;
        })
    );

    router.put('/guilds/:guildId/streams/:platform', requireLogin, validGuildId, (req, res) => {
        if (!STREAM_PLATFORMS.has(req.params.platform)) return res.status(404).json({ error: 'Not found' });
        return respond(res, async () => {
            const result = await bridge.guild('saveStreams', req.params.guildId, {
                userId: req.session.user.id,
                platform: req.params.platform,
                settings: req.body,
            });
            if (result.ok && result.changes?.length)
                await recordAudit(req, 'Updated stream notifications', result.changes);
            return result;
        });
    });

    router.delete('/guilds/:guildId/streams/:subscriptionId', requireLogin, validGuildId, (req, res) => {
        if (!SUBSCRIPTION_ID.test(req.params.subscriptionId)) return res.status(404).json({ error: 'Not found' });
        return respond(res, async () => {
            const result = await bridge.guild('removeStream', req.params.guildId, {
                userId: req.session.user.id,
                subscriptionId: req.params.subscriptionId,
            });
            if (result.ok) await recordAudit(req, 'Updated stream notifications', result.changes);
            return result;
        });
    });

    router.post('/guilds/:guildId/streams/:subscriptionId/test', requireLogin, validGuildId, (req, res) => {
        if (!SUBSCRIPTION_ID.test(req.params.subscriptionId)) return res.status(404).json({ error: 'Not found' });
        return respond(res, () =>
            bridge.guild('testStream', req.params.guildId, {
                userId: req.session.user.id,
                subscriptionId: req.params.subscriptionId,
            })
        );
    });

    const GIVEAWAY_ID = /^[a-f\d]{24}$/i;
    const GIVEAWAY_OPS = new Set(['end', 'reroll', 'cancel']);

    /** Runs a giveaway action on the shard, recording a Web Logs entry when it changed something. */
    const giveawayAction = (req, res, payload) =>
        respond(res, async () => {
            const result = await bridge.guild('giveaways', req.params.guildId, {
                userId: req.session.user.id,
                ...payload,
            });
            if (result.ok && result.action) {
                LogData('Dashboard', `${result.action} in ${req.params.guildId} by ${req.session.user.id}`, 'info');
                await recordAudit(req, result.action, result.changes);
            }
            return result;
        });

    router.get('/guilds/:guildId/giveaways', requireLogin, validGuildId, (req, res) =>
        giveawayAction(req, res, { op: 'list' })
    );

    router.post('/guilds/:guildId/giveaways', requireLogin, validGuildId, (req, res) =>
        giveawayAction(req, res, { op: 'create', giveaway: req.body })
    );

    router.put('/guilds/:guildId/giveaway-settings', requireLogin, validGuildId, (req, res) =>
        giveawayAction(req, res, { op: 'settings', settings: req.body })
    );

    router.post('/guilds/:guildId/giveaways/:giveawayId/:op', requireLogin, validGuildId, (req, res) => {
        const { giveawayId, op } = req.params;
        if (!GIVEAWAY_ID.test(giveawayId) || !GIVEAWAY_OPS.has(op)) return res.status(404).json({ error: 'Not found' });
        return giveawayAction(req, res, { op, giveawayId, count: req.body?.count });
    });

    router.delete('/guilds/:guildId/giveaways/:giveawayId', requireLogin, validGuildId, (req, res) => {
        if (!GIVEAWAY_ID.test(req.params.giveawayId)) return res.status(404).json({ error: 'Not found' });
        return giveawayAction(req, res, { op: 'delete', giveawayId: req.params.giveawayId });
    });

    const PANEL_ID = /^[a-f\d]{24}$/i;

    /** Runs a reaction roles action on the shard, recording a Web Logs entry when it changed something. */
    const reactionRolesAction = (req, res, payload) =>
        respond(res, async () => {
            const result = await bridge.guild('reactionRoles', req.params.guildId, {
                userId: req.session.user.id,
                ...payload,
            });
            if (result.ok && result.action) await recordAudit(req, result.action, result.changes);
            return result;
        });

    router.get('/guilds/:guildId/reaction-roles', requireLogin, validGuildId, (req, res) =>
        reactionRolesAction(req, res, { op: 'list' })
    );

    router.post('/guilds/:guildId/reaction-roles', requireLogin, validGuildId, (req, res) =>
        reactionRolesAction(req, res, { op: 'save', panel: req.body })
    );

    router.put('/guilds/:guildId/reaction-roles/:panelId', requireLogin, validGuildId, (req, res) => {
        if (!PANEL_ID.test(req.params.panelId)) return res.status(404).json({ error: 'Not found' });
        return reactionRolesAction(req, res, { op: 'save', panelId: req.params.panelId, panel: req.body });
    });

    router.delete('/guilds/:guildId/reaction-roles/:panelId', requireLogin, validGuildId, (req, res) => {
        if (!PANEL_ID.test(req.params.panelId)) return res.status(404).json({ error: 'Not found' });
        return reactionRolesAction(req, res, { op: 'delete', panelId: req.params.panelId });
    });

    const MESSAGE_ID = /^[a-f\d]{24}$/i;

    /** Runs a custom embeds action on the shard, recording a Web Logs entry when it changed something. */
    const customEmbedsAction = (req, res, payload) =>
        respond(res, async () => {
            const result = await bridge.guild('customEmbeds', req.params.guildId, {
                userId: req.session.user.id,
                ...payload,
            });
            if (result.ok && result.action) await recordAudit(req, result.action, result.changes);
            return result;
        });

    router.get('/guilds/:guildId/custom-embeds', requireLogin, validGuildId, (req, res) =>
        customEmbedsAction(req, res, { op: 'list' })
    );

    router.post('/guilds/:guildId/custom-embeds', requireLogin, validGuildId, (req, res) =>
        customEmbedsAction(req, res, { op: 'save', message: req.body })
    );

    router.put('/guilds/:guildId/custom-embeds/:messageId', requireLogin, validGuildId, (req, res) => {
        if (!MESSAGE_ID.test(req.params.messageId)) return res.status(404).json({ error: 'Not found' });
        return customEmbedsAction(req, res, { op: 'save', messageId: req.params.messageId, message: req.body });
    });

    router.delete('/guilds/:guildId/custom-embeds/:messageId', requireLogin, validGuildId, (req, res) => {
        if (!MESSAGE_ID.test(req.params.messageId)) return res.status(404).json({ error: 'Not found' });
        return customEmbedsAction(req, res, { op: 'delete', messageId: req.params.messageId });
    });

    const RESET_ACTIONS = {
        levels: 'Reset level settings',
        logging: 'Reset logging settings',
        bot: 'Reset bot settings',
        'auto-roles': 'Reset auto roles',
        welcome: 'Reset welcome messages',
        tickets: 'Reset ticket settings',
        twitch: 'Reset Twitch notifications',
        youtube: 'Reset YouTube notifications',
        kick: 'Reset Kick notifications',
        moderation: 'Reset automatic moderation',
        invites: 'Reset the invite blocker',
        honeypot: 'Reset the honeypot channel',
        starboard: 'Reset the starboard',
        commands: 'Reset command settings',
    };

    router.post('/guilds/:guildId/reset/:section', requireLogin, validGuildId, (req, res) => {
        const { guildId, section } = req.params;
        if (!Object.hasOwn(RESET_ACTIONS, section)) return res.status(404).json({ error: 'Not found' });

        return respond(res, async () => {
            const result = await bridge.guild('resetSettings', guildId, { userId: req.session.user.id, section });
            if (result.ok) {
                LogData('Dashboard', `${RESET_ACTIONS[section]} for ${guildId} by ${req.session.user.id}`, 'info');
                await recordAudit(req, RESET_ACTIONS[section], result.changes);
                // The public leaderboard is switched off by a levels reset
                if (section === 'levels') {
                    for (const key of publicCache.keys()) if (key.startsWith(guildId)) publicCache.delete(key);
                }
            }
            return result;
        });
    });

    router.post('/guilds/:guildId/logging/test', requireLogin, validGuildId, (req, res) =>
        respond(res, () => bridge.guild('testLogs', req.params.guildId, { userId: req.session.user.id }))
    );

    router.put('/guilds/:guildId/logging', requireLogin, validGuildId, (req, res) =>
        respond(res, async () => {
            const result = await bridge.guild('saveLoggingSettings', req.params.guildId, {
                userId: req.session.user.id,
                settings: req.body,
            });
            if (result.ok) {
                LogData(
                    'Dashboard',
                    `Logging settings saved for ${req.params.guildId} by ${req.session.user.id}`,
                    'info'
                );
                await recordAudit(req, 'Updated logging settings', result.changes);
            }
            return result;
        })
    );

    /**
     * Checks on the shard that the session user can manage this server, for data read from the database here
     * (Web Logs, moderation cases) rather than through a shard action. Sends the error response and returns false if not.
     */
    const canManage = async (req, res) => {
        let access;
        try {
            access = await bridge.guild('access', req.params.guildId, { userId: req.session.user.id });
        } catch {
            res.status(503).json({ error: 'The bot is restarting, try again in a moment' });
            return false;
        }
        if (!access.ok) res.status(access.status).json({ error: access.error });
        return access.ok;
    };

    // Web Logs: changes made through the dashboard. Manage Server is checked live on the shard first.
    router.get('/guilds/:guildId/audit-log', requireLogin, validGuildId, async (req, res) => {
        if (!(await canManage(req, res))) return;

        const { username, action, before } = req.query;
        res.json(
            await auditStore.list(req.params.guildId, {
                username: typeof username === 'string' ? username : undefined,
                action: typeof action === 'string' ? action : undefined,
                before: typeof before === 'string' ? before : undefined,
            })
        );
    });

    router.get('/guilds/:guildId/cases', requireLogin, validGuildId, async (req, res) => {
        if (!(await canManage(req, res))) return;
        const { member, action, before } = req.query;
        res.json(
            await caseStore.list(req.params.guildId, {
                member: typeof member === 'string' ? member : undefined,
                action: typeof action === 'string' ? action : undefined,
                before: typeof before === 'string' ? before : undefined,
            })
        );
    });

    router.delete('/guilds/:guildId/cases/:number', requireLogin, validGuildId, async (req, res) => {
        if (!CASE_NUMBER.test(req.params.number)) return res.status(404).json({ error: 'Not found' });
        if (!(await canManage(req, res))) return;

        const removed = await caseStore.remove(req.params.guildId, Number(req.params.number));
        if (!removed) return res.status(404).json({ error: 'That case no longer exists' });

        const reason = removed.reason ? `: ${removed.reason.slice(0, 200)}` : '';
        await recordAudit(req, 'Deleted a moderation case', [
            `Case #${removed.number}: ${CASE_LABELS[removed.action] ?? removed.action} for @${removed.username}${reason}`,
        ]);
        res.json({ removed: removed.number });
    });

    router.get('/guilds/:guildId/leaderboard', requireLogin, validGuildId, (req, res) => {
        const type = leaderboardType(req.query.type);
        respond(res, () =>
            bridge.guild('leaderboard', req.params.guildId, { type, limit: 100, viewerId: req.session.user.id })
        );
    });

    // Public: no login, only for servers that turned on publicLeaderboard. Cached to limit load.
    router.get('/public/leaderboard/:guildId', validGuildId, async (req, res) => {
        const type = leaderboardType(req.query.type);
        const key = `${req.params.guildId}:${type}`;
        const cached = publicCache.get(key);
        if (cached && Date.now() - cached.at < PUBLIC_CACHE_MS) return res.status(cached.status).json(cached.body);

        let result;
        try {
            result = await bridge.guild('leaderboard', req.params.guildId, { type, limit: 100 });
        } catch {
            return res.status(503).json({ error: 'The bot is restarting, try again in a moment' });
        }

        const status = result.ok ? 200 : result.status;
        const body = result.ok ? result.data : { error: result.error };
        if (publicCache.size >= PUBLIC_CACHE_MAX) publicCache.delete(publicCache.keys().next().value);
        publicCache.set(key, { at: Date.now(), status, body });
        res.status(status).json(body);
    });

    // Public: what the landing page shows. Totals are cached so visitors can't make every shard count
    // its servers on each page load; the invite link is always sent, even while the shards are down.
    let publicStats = { at: 0, guilds: null, members: null };
    router.get('/public/stats', async (req, res) => {
        if (Date.now() - publicStats.at >= PUBLIC_STATS_MS) {
            try {
                const shards = await bridge.stats();
                publicStats = {
                    at: Date.now(),
                    guilds: shards.reduce((total, shard) => total + shard.guilds, 0),
                    members: shards.reduce((total, shard) => total + shard.members, 0),
                };
            } catch {
                // Keep showing the last totals (or none); try again on the next request
            }
        }
        res.json({ guilds: publicStats.guilds, members: publicStats.members, inviteUrl: inviteUrl(applicationId) });
    });

    // Public: whether Ovx is working, for the Status page and uptime monitors (UptimeRobot, Better Stack...).
    // 503 when any shard is down, which is what monitors watch for. Cached briefly so it can't be used to
    // make the shards do work on every request.
    let health = { at: 0, body: null };
    router.get('/public/health', async (req, res) => {
        if (!health.body || Date.now() - health.at >= PUBLIC_HEALTH_MS) {
            const shards = await bridge.health().catch(() => []);
            const online = shards.filter((shard) => shard.status === 'online').length;
            const status =
                shards.length > 0 && online === shards.length ? 'operational' : online > 0 ? 'degraded' : 'down';
            health = { at: Date.now(), body: { status, shards, checkedAt: new Date().toISOString() } };
        }
        res.status(health.body.status === 'operational' ? 200 : 503).json(health.body);
    });

    router.get('/dev/stats', requireLogin, requireDeveloper(developerIds), async (req, res) => {
        try {
            const shards = await bridge.stats();
            res.json({
                shards,
                totals: {
                    shards: shards.length,
                    guilds: shards.reduce((total, shard) => total + shard.guilds, 0),
                    members: shards.reduce((total, shard) => total + shard.members, 0),
                },
                manager: {
                    uptimeMs: Math.round(process.uptime() * 1000),
                    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
                    nodeVersion: process.version,
                },
            });
        } catch {
            res.status(503).json({ error: 'The bot is restarting, try again in a moment' });
        }
    });

    // Which commands and features servers use. Cached briefly: it reads every feature's settings
    const usageCache = new Map();
    router.get('/dev/usage', requireLogin, requireDeveloper(developerIds), async (req, res) => {
        const days = USAGE_WINDOWS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
        const cached = usageCache.get(days);
        if (cached && Date.now() - cached.at < USAGE_CACHE_MS) return res.json(cached.data);
        try {
            const [report, shards] = await Promise.all([usageReport({ days }), bridge.stats().catch(() => null)]);
            const data = { ...report, serverCount: shards?.reduce((total, shard) => total + shard.guilds, 0) ?? null };
            usageCache.set(days, { at: Date.now(), data });
            res.json(data);
        } catch (error) {
            LogData('Dashboard', `Usage report failed: ${error.message}`, 'error');
            res.status(500).json({ error: 'Could not build the usage report' });
        }
    });

    router.use((req, res) => res.status(404).json({ error: 'Not found' }));

    return router;
}

/** @param {unknown} value */
function leaderboardType(value) {
    return typeof value === 'string' && LEADERBOARD_TYPES.has(value) ? value : 'level';
}
