const { Schema, model } = require('mongoose');

const InviteDetectionSchema = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	enabled: {
		type: Boolean,
		default: false,
	},
});

const AFKUsersSchema = new Schema({
	userId: {
		type: String,
		required: true
	},
	reason: {
		type: String,
		required: true
	},
	timestamp: {
		type: Date,
		default: Date.now()
	}
	
});

const LogsSchema = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	channelId: {
		type: String,
		required: true,
	},
	enabled: {
		type: Boolean,
		required: true,
	},
});

const LevelNotificationsSchema = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	channelId: {
		type: String,
	},
	enabled: {
		type: Boolean,
		default: false,
	},
	levelRewards: {
		type: Array,  
		default: [],
	},
});

const TicketsSchema = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	enabled: {
		type: Boolean,
		required: true,
	},
	setupChannelId: {
		type: String,
		required: true,
	},
	ticketCategoryId: {
		type: String,
		required: true,
	},
	archiveChannelId: {
		type: String,
		required: true,
	},
	supportRoleId: {
		type: String,
		required: true,
	},
	adminRoleId: {
		type: String,
		required: true,
	}

});

const ReactionRolesSchema = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	channelId: {
		type: String,
		required: true,
	},
	messageId: {
		type: String,
		required: true,
	},
	enabled: {
		type: Boolean,
		required: true,
	},
	roles: {
		type: [
			{
				roleId: {
					type: String,
					required: true,
				},
				roleEmoji: {
					type: String,
					required: true,
				},
			},
		],
		default: [],
	},
});

const AutoRolesSchema = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	enabled: {
		type: Boolean,
		default: false,
	},
	roles: {
		type: Array,
		default: [],
	},
});

const WelcomeMessageSchema = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	enabled: {
		type: Boolean,
		default: false,
	},
	channelId: {
		type: String,
		required: true,
	},
	message: {
		type: String,
		required: true,
	},
});

const LeaveMessageSchema = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	enabled: {
		type: Boolean,
		default: false,
	},
	channelId: {
		type: String,
		required: true,
	},
	message: {
		type: String,
		required: true,
	},
});



module.exports = {
	InviteDetection: model('Guild-Invite-Detection', InviteDetectionSchema),
	AFKUsers: model('Guild-AFK-Users', AFKUsersSchema),
	ChannelLogs: model('Guild-Logs-Channel', LogsSchema),
	JoinLeaveLogs: model('Guild-Logs-JoinLeave', LogsSchema),
	MemberLogs: model('Guild-Logs-Member', LogsSchema),
	MessageLogs: model('Guild-Logs-Messages', LogsSchema),
	ServerLogs: model('Guild-Logs-Server', LogsSchema),
	VoiceLogs: model('Guild-Logs-Voice', LogsSchema),
	RoleLogs: model('Guild-Logs-Roles', LogsSchema),
	PunishmentLogs: model('Guild-Logs-Punishment', LogsSchema),
	LevelNotifications: model('Guild-Level-Notifications', LevelNotificationsSchema),
	Tickets: model('Guild-Tickets', TicketsSchema),
	ReactionRoles: model('Guild-Reaction-Roles', ReactionRolesSchema),
	AutoRoles: model('Guild-Auto-Roles', AutoRolesSchema),
	WelcomeMessage: model('Guild-Welcome-Message', WelcomeMessageSchema),
	LeaveMessage: model('Guild-Leave-Message', LeaveMessageSchema),
};