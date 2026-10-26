import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { userFields, serverFields, roleFields, channelFields, botFields } from '../utils/info.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { inviteUrl, SUPPORT_URL } from '../../../shared/utils/invite.js';
import { voteUrl } from '../../votes/utils/votes.js';
import { ENV } from '../../../bootstrap/environment.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('information');
commandData.setDescription('Details about a user, this server, a role, a channel or Ovx.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);
commandData.addSubcommand((sub) =>
    sub
        .setName('user')
        .setDescription('Details about someone.')
        .addUserOption((option) => option.setName('user').setDescription('Who (default: you).'))
);
commandData.addSubcommand((sub) => sub.setName('server').setDescription('Details about this server.'));
commandData.addSubcommand((sub) =>
    sub
        .setName('role')
        .setDescription('Details about a role.')
        .addRoleOption((option) => option.setName('role').setDescription('Which role.').setRequired(true))
);
commandData.addSubcommand((sub) =>
    sub
        .setName('channel')
        .setDescription('Details about a channel.')
        .addChannelOption((option) => option.setName('channel').setDescription('Which channel (default: this one).'))
);
commandData.addSubcommand((sub) => sub.setName('bot').setDescription('Details and links for Ovx.'));

export const meta = {
    cooldown: 5,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/** Server → when its members were last fetched, so counting a role's members doesn't fetch every time */
const lastMemberFetch = new Map();
const MEMBER_FETCH_COOLDOWN_MS = 10 * 60 * 1000;
/** Bigger servers aren't fetched in full just for a count */
const MEMBER_FETCH_MAX = 25_000;

/**
 * How many members have a role, or null if Ovx can't know without fetching a very large server.
 * @param {import('discord.js').Role} role
 */
async function roleMemberCount(role) {
    const { guild } = role;
    if (role.id === guild.id) return guild.memberCount; // @everyone
    if (guild.members.cache.size < guild.memberCount && guild.memberCount <= MEMBER_FETCH_MAX) {
        const last = lastMemberFetch.get(guild.id) ?? 0;
        if (Date.now() - last > MEMBER_FETCH_COOLDOWN_MS) {
            lastMemberFetch.set(guild.id, Date.now());
            await guild.members.fetch({ time: 15_000 }).catch(() => {});
        }
    }
    return guild.members.cache.size >= guild.memberCount ? role.members.size : null;
}

/**
 * Totals across every shard.
 * @param {import('discord.js').Client} client
 */
async function botTotals(client) {
    const local = (c) => ({
        servers: c.guilds.cache.size,
        members: c.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0),
        memory: process.memoryUsage().rss,
    });
    const shards = client.shard
        ? await client.shard
              .broadcastEval((c) => ({
                  servers: c.guilds.cache.size,
                  members: c.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0),
                  memory: process.memoryUsage().rss,
              }))
              .catch(() => [local(client)])
        : [local(client)];
    return {
        servers: shards.reduce((total, shard) => total + shard.servers, 0),
        members: shards.reduce((total, shard) => total + shard.members, 0),
        memoryMb: Math.round(shards.reduce((total, shard) => total + shard.memory, 0) / 1024 / 1024),
        shards: client.shard?.count ?? 1,
    };
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { client, locale, options } = interaction;
    const t = (key, vars) => client.utils.Translate(`commands.information.${key}`, locale, vars);
    const subcommand = options.getSubcommand();
    // Server details need Ovx in the server (not just installed to someone's account)
    const guild = interaction.inCachedGuild() ? interaction.guild : null;
    const colour = await brandColour(guild?.id ?? null);

    const embed = new EmbedBuilder().setColor(colour);
    /** @type {import('../utils/info.js').Field[]} */
    let fields = [];
    const components = [];

    if (subcommand === 'user') {
        const chosen = options.getUser('user') ?? interaction.user;
        const user = await chosen.fetch(true).catch(() => chosen);
        const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
        fields = userFields(user, member);
        embed
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ size: 64 }) })
            .setTitle(member?.displayName ?? user.displayName)
            .setThumbnail((member ?? user).displayAvatarURL({ size: 256 }));
        const banner = user.bannerURL({ size: 1024 });
        if (banner) embed.setImage(banner);
        if (member && member.displayColor) embed.setColor(member.displayColor);
    } else if (subcommand === 'bot') {
        fields = botFields(await botTotals(client), client, client.commands.size);
        embed
            .setTitle(client.user.username)
            .setDescription(t('bot_description'))
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }));
        const links = [
            [t('link_invite'), inviteUrl(ENV.APPLICATION_ID)],
            ENV.DASHBOARD && [t('link_dashboard'), ENV.DASHBOARD.URL],
            [t('link_support'), SUPPORT_URL],
            [t('link_vote'), voteUrl()],
        ].filter(Boolean);
        components.push(
            /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
                links.map(([label, url]) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url))
            )
        );
    } else {
        if (!guild) {
            return interaction.reply({ content: t('needs_server'), flags: MessageFlags.Ephemeral });
        }
        if (subcommand === 'server') {
            fields = serverFields(guild);
            embed.setTitle(guild.name).setThumbnail(guild.iconURL({ size: 256 }));
            if (guild.description) embed.setDescription(guild.description);
            const banner = guild.bannerURL({ size: 1024 }) ?? guild.splashURL({ size: 1024 });
            if (banner) embed.setImage(banner);
        } else if (subcommand === 'role') {
            const role = guild.roles.cache.get(options.getRole('role', true).id);
            if (!role) return interaction.reply({ content: t('not_found'), flags: MessageFlags.Ephemeral });
            await interaction.deferReply();
            fields = roleFields(role, await roleMemberCount(role));
            embed.setTitle(`@${role.name}`).setColor(role.color || colour);
            const icon = role.iconURL({ size: 128 });
            if (icon) embed.setThumbnail(icon);
        } else if (subcommand === 'channel') {
            const channel = guild.channels.cache.get(options.getChannel('channel')?.id ?? interaction.channelId);
            if (!channel) return interaction.reply({ content: t('not_found'), flags: MessageFlags.Ephemeral });
            fields = channelFields(channel);
            embed.setTitle(channel.isThread() ? channel.name : `#${channel.name}`);
        }
    }

    embed.addFields(
        /** @type {[string, string, boolean?][]} */ (fields.filter(Boolean)).map(([key, value, inline = false]) => ({
            name: t(`fields.${key}`),
            value,
            inline,
        }))
    );
    const reply = { embeds: [embed], components, allowedMentions: { parse: [] } };
    return interaction.deferred ? interaction.editReply(reply) : interaction.reply(reply);
}
