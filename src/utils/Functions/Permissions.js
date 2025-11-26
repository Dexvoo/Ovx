/**
 * Permission utilities for checking guild member permissions, dev status, and vote eligibility
 * @module utils/Functions/Permissions
 */

const {
  ChatInputCommandInteraction,
  GuildMember,
  Client,
  GuildChannel,
  ThreadChannel,
  PermissionsBitField,
} = require('discord.js');
const { DeveloperIDs } = process.env;
const VoteCache = require('../../cache/Votes');

const VOTE_COOLDOWN_TIME = 12 * 60 * 60 * 1000;

/**
 * Checks if a user/bot has the required permissions in a channel
 *
 * @param {ChatInputCommandInteraction | GuildChannel | ThreadChannel} interactionChannel - Interaction or Channel to check permissions in
 * @param {Array<string>} permissions - Array of permission names to check
 * @param {GuildMember | Client} member - GuildMember or Client to check permissions for
 * @returns {[boolean, string[]?]} Array with boolean success flag and optional array of missing permissions
 * @throws {Error} If invalid parameters are provided
 */
function PermCheck(interactionChannel, permissions, member) {
  if (!interactionChannel) throw new Error('No channel or interaction provided.');
  if (!Array.isArray(permissions)) throw new Error('No permissions provided or invalid format.');
  if (!member) throw new Error('No member provided.');

  let channel, guild;
  if (interactionChannel instanceof ChatInputCommandInteraction) {
    channel = interactionChannel.channel;
    guild = interactionChannel.guild;
  } else if (
    interactionChannel instanceof GuildChannel ||
    interactionChannel instanceof ThreadChannel
  ) {
    channel = interactionChannel;
    guild = interactionChannel.guild;
  } else {
    throw new Error('Invalid interaction or channel type provided.');
  }

  let userPermissions;
  if (member instanceof GuildMember) {
    userPermissions = member.permissionsIn(channel);
  } else if (member instanceof Client) {
    if (!guild) throw new Error('Guild not found for client member.');
    userPermissions = guild.members.me.permissionsIn(channel);
  } else {
    throw new Error('Invalid member or client type provided.');
  }

  const missingPermissions = permissions
    .filter((permission) => !userPermissions.has(permission))
    .map((permission) => new PermissionsBitField(permission).toArray());
  return missingPermissions.length > 0 ? [false, missingPermissions] : [true];
}

/**
 * Checks if a user has voted for the bot on Top.gg within the cooldown window
 *
 * @async
 * @param {string} userId - The Discord user ID to check
 * @returns {Promise<boolean>} True if user has voted within the cooldown (12 hours), false otherwise
 */
async function HasVotedTGG(userId) {
  try {
    const data = await VoteCache.get(userId);
    if (!data || !data.votes || data.votes <= 0) return false;

    const lastVote = data.updatedAt ? new Date(data.updatedAt) : null;
    const currentTime = new Date();
    if (lastVote && currentTime - lastVote < VOTE_COOLDOWN_TIME) return true;

    return false;
  } catch (error) {
    console.error(`[ERROR] HasVotedTGG failed for user ${userId}:`, error);
    return false;
  }
}

/**
 * Checks if a user ID belongs to a bot developer
 *
 * @param {string} userId - The Discord user ID to check
 * @returns {boolean} True if the user is a developer, false otherwise
 */
function DevCheck(userId) {
  if (!DeveloperIDs) {
    console.warn('[WARN] DeveloperIDs environment variable not set');
    return false;
  }

  return DeveloperIDs.includes(userId);
}

module.exports = { PermCheck, HasVotedTGG, DevCheck };
