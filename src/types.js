const OvxClient = require('./structures/OvxClient');
const { CommandInteraction, ChatInputCommandInteraction, ButtonInteraction, Message, GuildMember, GuildChannel, GuildBan, Role, VoiceState } = require('discord.js')
/**
 * @typedef {OvxClient} OvxClient
 * 
 * @typedef {CommandInteraction & { client: OvxClient }} CommandUtils
 * @typedef {ChatInputCommandInteraction & { client: OvxClient}} CommandInputUtils
 * 
 * @typedef {ButtonInteraction & { client: OvxClient }} ButtonUtils
 * 
 * @typedef {Guild & { client: OvxClient}} GuildUtils
 * @typedef {Message & { client: OvxClient}} MessageUtils
 * @typedef {GuildMember & { client: OvxClient}} MemberUtils
 * @typedef {GuildChannel & { client: OvxClient}} ChannelUtils
 * @typedef {GuildBan & {client: OvxClient}} BanUtils
 * @typedef {Role & {client: OvxClient}} RoleUtils
 * @typedef {VoiceState & {client: OvxClient}} VoiceUtils
 * 
 */