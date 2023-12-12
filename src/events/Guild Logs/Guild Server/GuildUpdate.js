const { EmbedBuilder, Events, Guild, AuditLogEvent } = require('discord.js');
const { FooterText, FooterImage, EmbedColour } = process.env;
const ServerLogs = require('../../../models/GuildServerLogs.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');

// Define constants for field names
const FIELD_NAMES = {
	NAME: 'Name',
	ICON: 'Icon',
	SPLASH: 'Splash Image',
	BANNER: 'Banner',
	DESCRIPTION: 'Description',
	OWNER: 'Owner',
	AFK_CHANNEL: 'AFK Channel',
	AFK_TIMEOUT: 'AFK Timeout',
	EXPLICIT_CONTENT_FILTER: 'Explicit Content Filter',
	VERIFICATION_LEVEL: 'Verification Level',
	DEFAULT_NOTIFICATIONS: 'Default Notifications',
	MFA_LEVEL: 'MFA Level',
	PREMIUM_SUBSCRIPTION_COUNT: 'Premium Subscription Count',
	PREMIUM_TIER: 'Premium Tier',
	VANITY_URL: 'Vanity URL',
};

function addFieldIfChanged(embed, fieldName, oldValue, newValue) {
	if (oldValue !== newValue) {
		embed.addFields({
			name: fieldName,
			value: `${oldValue} => ${newValue}`,
			inline: false,
		});
	}
}

module.exports = {
	name: Events.GuildUpdate,
	nickname: 'Server Logs',
	once: false,

	/**
	 * @param {Guild} oldGuild
	 * @param {Guild} newGuild
	 * @param {Embed} embed
	 */

	async execute(oldGuild, newGuild) {
		const { client, id } = newGuild;
		const ServerLogsData = await ServerLogs.findOne({ guild: id });

		if (!ServerLogsData) return;

		const channelToSend = client.channels.cache.get(ServerLogsData.channel);

		if (!channelToSend) {
			await ServerLogs.findOneAndDelete({ guildId: id });
			const guildOwner = await newGuild.fetchOwner();
			await sendEmbed(
				guildOwner,
				`Missing Channel: \`${ServerLogsData.channel}\` | Guild Logs is now \`disabled\``
			);
			return;
		}

		// Bot permissions
		const botPermissionsArry = ['ViewAuditLog', 'SendMessages', 'ViewChannel'];
		const botPermissions = await permissionCheck(
			channelToSend,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			return await sendEmbed(
				await newGuild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Guild Logs is now \`disabled\``
			);
		}

		const ServerLogEmbed = new EmbedBuilder()
			.setTitle('Server Log')
			.setColor(EmbedColour)
			.setFooter({ text: FooterText, iconURL: FooterImage })
			.setTimestamp();

		for (const field in FIELD_NAMES) {
		}

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

		const logs = await newGuild
			.fetchAuditLogs({
				limit: 1,
				type: AuditLogEvent.GuildUpdate,
			})
			.catch((err) => {
				console.log(err);
			});

		const logEntry = logs.entries.first();

		if (logEntry && logEntry.executor) {
			const responsibleUser = logEntry.executor;
			ServerLogEmbed.addFields({
				name: 'Responsible User',
				value: `${responsibleUser} | ${responsibleUser.id}`,
			});
		}

		// Add the ID's field
		ServerLogEmbed.addFields({
			name: 'ID`s',
			value: `\`\`\`ansi\n[2;34mGuild | ${id}[0m\`\`\``,
		});

		if (ServerLogEmbed.data.fields.length > 1) {
			await channelToSend.send({ embeds: [ServerLogEmbed] });
		}
	},
};
