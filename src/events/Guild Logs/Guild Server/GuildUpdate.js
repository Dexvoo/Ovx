const {
	EmbedBuilder,
	PermissionsBitField,
	Events,
	GuildMember,
	VoiceState,
	Guild,
} = require('discord.js');
const {
	FooterText,
	FooterImage,
	EmbedColour,
	DeveloperGuildID,
	PremiumUserRoleID,
	DeveloperMode,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;
const ServerLogs = require('../../../models/GuildServerLogs.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');

// Define constants for field names
const FIELD_NAMES = {
	NAME: 'Name Changed',
	ICON: 'Icon Changed',
	SPLASH: 'Splash Image Changed',
	BANNER: 'Banner Changed',
	DESCRIPTION: 'Description Changed',
	OWNER: 'Owner Changed',
	AFK_CHANNEL: 'AFK Channel Changed',
	AFK_TIMEOUT: 'AFK Timeout Changed',
	EXPLICIT_CONTENT_FILTER: 'Explicit Content Filter Changed',
	VERIFICATION_LEVEL: 'Verification Level Changed',
	DEFAULT_NOTIFICATIONS: 'Default Notifications Changed',
	MFA_LEVEL: 'MFA Level Changed',
	PREMIUM_SUBSCRIPTION_COUNT: 'Premium Subscription Count Changed',
	PREMIUM_TIER: 'Premium Tier Changed',
	VANITY_URL: 'Vanity URL Changed',
};

// Create a function to add fields to the embed
function addFieldIfChanged(embed, fieldName, oldValue, newValue) {
	if (oldValue !== newValue) {
		embed.addField(fieldName, `\`${oldValue}\` -> \`${newValue}\``);
	}
}

module.exports = {
	name: Events.GuildUpdate,
	nickname: 'Server Logs',

	/**
	 * @param {Guild} oldGuild
	 * @param {Guild} newGuild
	 */

	async execute(oldGuild, newGuild) {
		const { client, id } = newGuild;
		const ServerLogsData = await ServerLogs.findOne({ guild: id });

		if (!ServerLogsData) return;

		const channelToSend = client.channels.cache.get(ServerLogsData.channel);

		if (!channelToSend) {
			await ServerLogs.findOneAndDelete({ guildId: id });
			return;
		}

		const ServerLogEmbed = new EmbedBuilder()
			.setTitle('Server Log')
			.setColor(EmbedColour)
			.setFooter({ text: FooterText, iconURL: FooterImage })
			.setTimestamp();

		// Add fields for various changes using the addFieldIfChanged function
		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.NAME,
			oldGuild.name,
			newGuild.name
		);
		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.ICON,
			oldGuild.iconURL(),
			newGuild.iconURL()
		);
		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.SPLASH,
			oldGuild.splashURL(),
			newGuild.splashURL()
		);
		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.BANNER,
			oldGuild.bannerURL(),
			newGuild.bannerURL()
		);
		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.DESCRIPTION,
			oldGuild.description,
			newGuild.description
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.OWNER,
			oldGuild.ownerId,
			newGuild.ownerId
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.AFK_CHANNEL,
			oldGuild.afkChannel,
			newGuild.afkChannel
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.AFK_TIMEOUT,
			oldGuild.afkTimeout,
			newGuild.afkTimeout
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.EXPLICIT_CONTENT_FILTER,
			oldGuild.explicitContentFilter,
			newGuild.explicitContentFilter
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.VERIFICATION_LEVEL,
			oldGuild.verificationLevel,
			newGuild.verificationLevel
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.DEFAULT_NOTIFICATIONS,
			oldGuild.defaultMessageNotifications,
			newGuild.defaultMessageNotifications
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.MFA_LEVEL,
			oldGuild.mfaLevel,
			newGuild.mfaLevel
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.PREMIUM_SUBSCRIPTION_COUNT,
			oldGuild.premiumSubscriptionCount,
			newGuild.premiumSubscriptionCount
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.PREMIUM_TIER,
			oldGuild.premiumTier,
			newGuild.premiumTier
		);

		addFieldIfChanged(
			ServerLogEmbed,
			FIELD_NAMES.VANITY_URL,
			oldGuild.vanityURLCode,
			newGuild.vanityURLCode
		);

		// Add the ID's field
		ServerLogEmbed.addFields({
			name: 'ID`s',
			value: `\`\`\`ansi\n[2;34mGuild | ${id}[0m\`\`\``,
		});

		// Check if the embed has fields to send
		if (ServerLogEmbed.data.fields.length > 1) {
			await channelToSend.send({ embeds: [ServerLogEmbed] });
		}
	},
};
