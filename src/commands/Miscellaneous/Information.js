const { SlashCommandBuilder, InteractionContextType, EmbedBuilder, PermissionFlagsBits, CommandInteraction, PermissionsBitField, ChannelType, ApplicationIntegrationType } = require('discord.js');
const { permissionCheck } = require('../../utils/Checks');
const SuccessEmoji='<a:OVX_Yes:1115593935746781185>';
const ErrorEmoji='<a:OVX_No:1115593604073791488>';
const discordBadges = {
    ActiveDeveloper: '<:OVX_ActiveDeveloper:1115592693284876308>',
    BugHunterLevel1: '<:OVX_BugHunterLevel1:1115593411030949980>',
    BugHunterLevel2: '<:OVX_BugHunterLevel2:1115593413648191509>',
    CertifiedModerator: '<:OVX_CertifiedModerator:1115593415569199155>',
    HypeSquadOnlineHouse1: '<:OVX_Bravery:1115592699500822580>',
    HypeSquadOnlineHouse2: '<:OVX_Brilliance:1115592701581213707>',
    HypeSquadOnlineHouse3: '<:OVX_Balance:1115592695071649792>',
    HypeSquad: '<:OVX_Hypesquad:1115593419276955699>',
    Partner: '<:OVX_Partner:1115593830692036668>',
    PremiumEarlySupporter: '<:OVX_EarlySupporter:1115593417485983785>',
    Staff: '<:OVX_Staff:1115593834815037461>',
    VerifiedBot: '<:OVX_VerifiedBot:1115593836455010375>',
    VerifiedDeveloper: '<:OVX_VerifiedBotDeveloper:1115593838648639539>',
};
const { DeveloperIDs } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    data: new SlashCommandBuilder()
        .setName('information')
        .setDescription('Get information about a user, guild, role or bot')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .addSubcommand(subcommand => subcommand
            .setName('user')
            .setDescription('Get information about a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to get information about')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('server')
            .setDescription('Get information about the guild')
        )
        .addSubcommand(subcommand => subcommand
            .setName('bot')
            .setDescription('Get information about the bot')
        )
        .addSubcommand(subcommand => subcommand
            .setName('role')
            .setDescription('Get information about a role')
            .addRoleOption(option => option
                .setName('role')
                .setDescription('The role to get information about')
                .setRequired(true)
            )
        ),

    /**
	 * @param {CommandInteraction} interaction
	 */

    async execute(interaction) {
        const { client, user, guild, options } = interaction;
        const subcommand = options.getSubcommand();
        try {
            
            await guild.members.fetch();

            switch (subcommand) {
                case 'user': 
                    await handleUserInformation(interaction);
                    break;
                case 'server': 
                    await handleServerInformation(interaction);
                    break;
                case 'bot':
                    await handleBotInformation(interaction);
                    break;
                case 'role':
                    await handleRoleInformation(interaction);
                    break;
                default:
                    const UnsuccessfulEmbed = new EmbedBuilder()
                        .setTitle('An error occurred')
                        .setDescription('An error occurred while trying to get the information')
                        .setColor('Red');
                    await interaction.reply({ embeds: [UnsuccessfulEmbed], ephemeral: true });
                    break;
                
            }
            
        } catch (error) {
            console.error(error);
            const UnsuccessfulEmbed = new EmbedBuilder()
                .setTitle('An error occurred')
                .setDescription('An error occurred while trying to get the information')
                .setColor('Red');
            await interaction.reply({ embeds: [UnsuccessfulEmbed], ephemeral: true });
        }
    }
}


/**
 * @param {CommandInteraction} interaction
 */

async function handleUserInformation(interaction) {
    const { guild, member, options, user, client, channel } = interaction;

    const userOption = options.getUser('user') || user;

    if(!userOption) {
        const UnsuccessfulEmbed = new EmbedBuilder()
            .setDescription('Please specify a valid user')
            .setColor('Red');
        await interaction.reply({ embeds: [UnsuccessfulEmbed], ephemeral: true });
        return;
    }
    
    const userMember = userOption ? guild.members.cache.get(userOption.id) : member;

    if(!userMember) {
        const UnsuccessfulEmbed = new EmbedBuilder()
            .setTitle('An error occurred')
            .setDescription('An error occurred while trying to get the information')
            .setColor('Red');
        await interaction.reply({ embeds: [UnsuccessfulEmbed], ephemeral: true });
        return;
    }
    const userBadges = userOption.flags.toArray().map(flag => discordBadges[flag]).join(' • ') || 'None';
    const memberRoles = userMember.roles.cache.filter(role => role.name !== '@everyone').map(role => role.toString()).join(' • ') || 'None';

    const userPermissions = [ PermissionFlagsBits.ManageMessages]
    const [hasPermissions, missingPermissions] =  permissionCheck(interaction, userPermissions, userMember);

    const isStaff = hasPermissions ? `• ${SuccessEmoji} •` : `• ${ErrorEmoji} •`;
    const isBot = userMember.user.bot ? `• ${SuccessEmoji} •` : `• ${ErrorEmoji} •`;
    const isServerBooster = userMember.premiumSince ? `• ${SuccessEmoji} ${ getDiscordTimestamp(userMember.premiumSince) } •` : `• ${ErrorEmoji} •`;
    const userJoinedAt = getDiscordTimestamp(userMember.joinedAt);
    const userCreatedAt = getDiscordTimestamp(userMember.user.createdAt);

    const UserEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setAuthor({ name: `User Information for @${userMember.user.username}`, iconURL: userMember.user.displayAvatarURL({ dynamic: true }) })
        .addFields(
            { name: 'Username', value: `@${userMember.user.username}` ?? 'None', inline: true },
            { name: 'Nickname', value: userMember.nickname ?? 'None', inline: true },
            { name: 'Tag', value: `${userMember}`, inline: true },
            { name: 'Joined Guild', value: `${userJoinedAt}`, inline: true },
            { name: 'Account Created', value: `${userCreatedAt}`, inline: true },
            { name: 'Server Boosting', value: `${isServerBooster}`, inline: true },
            { name: 'Guild Roles', value: `${memberRoles}`, inline: false },
            { name: 'Badges', value: `${userBadges}`, inline: true },
            { name: 'Is Staff', value: `${isStaff}`, inline: true },
            { name: 'Is Bot', value: `${isBot}`, inline: true },
        )
    
    await interaction.reply({ embeds: [UserEmbed] });
}



/**
 * @param {CommandInteraction} interaction
 */

async function handleServerInformation(interaction) {
    const { guild, member, options, user, client, channel } = interaction;

    // Guild Information
    const guildCreated = getDiscordTimestamp(guild.createdAt);
    const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
    const guildDescription = guild.description || 'None';
    const guildAdmins = guild.members.cache.filter(members => members.permissions.has(PermissionsBitField.Flags.Administrator) !== false && members.user.bot !== true && members.id !== guild.ownerId).map(members => members.toString()).join(', ').substring(0, 1000) || 'None';
    const guildMods = guild.members.cache.filter(members => members.permissions.has(PermissionsBitField.Flags.ManageMessages) !== false && members.user.bot !== true && members.id !== guild.ownerId).map(members => members.toString()).join(', ').substring(0, 1000) || 'None';
    
    // Member Stats
    const guildMemberCount = guild.members.cache.filter(members => members.user.bot !== true).size;
    const guildBotCount = guild.members.cache.filter(members => members.user.bot === true).size;
    const guildTotalMemberCount = guild.memberCount;
    
    // Channel Stats
    const guildTreadChannelCount = guild.channels.cache.filter(channels => channels.type === ChannelType.AnnouncementThread || channels.type === ChannelType.PrivateThread || channels.type === ChannelType.PublicThread).size;
    const guildCategoryChannelCount = guild.channels.cache.filter(channels => channels.type === ChannelType.GuildCategory).size;
    const guildGuildDirectoryChannelCount = guild.channels.cache.filter(channels => channels.type === ChannelType.GuildDirectory).size;
    const guildForumChannelCount = guild.channels.cache.filter(channels => channels.type === ChannelType.GuildForum).size;
    const guildMediaChannelCount = guild.channels.cache.filter(channels => channels.type === ChannelType.GuildMedia).size;
    const guildStageChannelCount = guild.channels.cache.filter(channels => channels.type === ChannelType.GuildStageVoice).size;
    const guildTextChannelCount = guild.channels.cache.filter(channels => channels.type === ChannelType.GuildText).size;
    const guildVoiceChannelCount = guild.channels.cache.filter(channels => channels.type === ChannelType.GuildVoice).size;
    const guildTotalChannelCount = guild.channels.cache.size;

    // Emoji + Sticker Stats
    const guildEmojiCount = guild.emojis.cache.size;
    const guildAnimatedEmojiCount = guild.emojis.cache.filter(emoji => emoji.animated === true).size;
    const guildRegularEmojiCount = guild.emojis.cache.filter(emoji => emoji.animated === false).size;
    const guildStickerCount = guild.stickers.cache.size;

    // Guild Boost Stats
    const guildBoostLevel = guild.premiumTier;
    const guildBoostCount = guild.premiumSubscriptionCount;
    const guildBoosters = guild.members.cache.filter(members => members.premiumSince !== null).map(members => members.toString()).join(', ').substring(0, 1000) || 'None';

    // Role Stats
    const guildRoles = guild.roles.cache.filter(roles => roles.name !== '@everyone').map(roles => roles.toString()).join(', ').substring(0, 1000) || 'None';
    const guildRoleCount = guild.roles.cache.size - 1;

    // Badges
    let guildUserBadges = [];
    let counts = {};

    for (const member of guild.members.cache.values()) {
		const fetchedUser = await client.users.fetch(member.id);
		guildUserBadges = guildUserBadges.concat(fetchedUser.flags.toArray());
	}

	let totalBadges = 0;
	for (const badge of guildUserBadges) {
		if (counts[badge]) {
			counts[badge] += 1;
			totalBadges += 1;
		} else {
			counts[badge] = 1;
			totalBadges += 1;
		}
	}

    const ServerInformationEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setAuthor({ name: `Server Information for ${guild.name}`, iconURL: guild.iconURL({ dynamic: true }) })
        .addFields(
            { name: 'General Information', value: [ `Name: ${guild.name}`, `Created: ${guildCreated}`, `Owner: ${guildOwner}`, `Admins: ${guildAdmins}`, `Mods: ${guildMods}`, `Description: ${guildDescription}` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Users', value: [ `- Members: ${guildMemberCount}`, `- Bots: ${guildBotCount}`, `Total: ${guildTotalMemberCount}` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Channels', value: [ `- Text: ${guildTextChannelCount}`, `- Voice: ${guildVoiceChannelCount}`, `- Threads: ${guildTreadChannelCount}`, `- Categories: ${guildCategoryChannelCount}`, `- Stages: ${guildStageChannelCount}`, `- Directory: ${guildGuildDirectoryChannelCount}`, `- Forum: ${guildForumChannelCount}`, `- Media: ${guildMediaChannelCount}`, `Total: ${guildTotalChannelCount}` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Roles', value: [ `${guildRoles}`, `Total: ${guildRoleCount}` ].join('\n') .substring(0, 1000), inline: false },
            { name: 'Badges', value: [  Object.entries(counts).map(([badge, count]) => `${discordBadges[badge]}: ${count}`).join(' • '), `Total: ${totalBadges}` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Emojis', value: [ `- Animated: ${guildAnimatedEmojiCount}`, `- Static: ${guildRegularEmojiCount}`, `- Stickers: ${guildStickerCount}`, `Total: ${guildEmojiCount + guildStickerCount}` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Boosts', value: [ `- Tier: ${guildBoostLevel}`, `- Boosts: ${guildBoostCount}`, `- Boosters: ${guildBoosters}` ].join('\n').substring(0, 1000), inline: false },
        )
    
    await interaction.reply({ embeds: [ServerInformationEmbed] });
    
}

/**
 * @param {CommandInteraction} interaction
 */

async function handleBotInformation(interaction) {
    const { client, guild, member, options, user, channel } = interaction;


    const DeveloperInformationString = client.users.cache.filter(user => DeveloperIDs.includes(user.id)).map(user => `${user.toString()} | @${user.username} | ${user.id}`).join(' • ') || 'None';
    const botRoles = guild ? guild.members.me.roles.cache.filter(role => role.name !== '@everyone').map(role => role.toString()).join(' • ') : 'None'
    const botBadges = client.user.flags.toArray().map(flag => discordBadges[flag]).join(' • ') || 'None';

    const BotInformationEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setTitle('Bot Information')
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'General Information', value: [ `User: ${client.user.toString()}`, `Username: @${client.user.username}`, `ID: ${client.user.id}`, `Created: ${getDiscordTimestamp(client.user.createdAt)}` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Roles', value: [ `${botRoles}`, `Total: ${guild.members.me.roles.cache.size}` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Stats', value: [ `- Servers: ${client.guilds.cache.size}`, `- Users: ${client.users.cache.size}`, `- Channels: ${client.channels.cache.size}`, `- Commands: ${client.commands.size}`, `- Uptime: ${getDiscordTimestamp(client.readyAt)}`, `- Ping: ${client.ws.ping}ms` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Badges', value: [ `${botBadges}` ].join('\n').substring(0, 1000), inline: false },
            { name: 'Developer', value: [ DeveloperInformationString ].join('\n').substring(0, 1000), inline: true },
        );

    await interaction.reply({ embeds: [BotInformationEmbed] });
}

/**
 * @param {CommandInteraction} interaction
 */

async function handleRoleInformation(interaction) {
    const {options } = interaction;

    const role = options.getRole('role');
    const roleCreated = getDiscordTimestamp(role.createdAt);
    const rolePermissions = role.permissions.toArray().map(permission => `\`${permission}\``).join(' • ') || 'None';

    const RoleInformationEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setTitle('Role Information')
        .addFields(
            { name: 'Name', value: [ `${role}`].join('\n').substring(0, 1000), inline: true },
            { name: 'ID', value: role.id, inline: true },
            { name: 'Colour', value: role.hexColor.substring(0, 1000), inline: true },
            { name: 'Created', value: roleCreated.substring(0, 1000), inline: true },
            { name: 'Members w/role', value: [ `${role.members.size}`].join('\n').substring(0, 1000), inline: true },

            { name: 'Permissions', value: [ `${rolePermissions}` ].join('\n').substring(0, 1000), inline: false },
        );

    await interaction.reply({ embeds: [RoleInformationEmbed] });


}


function getDiscordTimestamp (date) {
    return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}