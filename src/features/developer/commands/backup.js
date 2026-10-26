import { SlashCommandBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { runBackup, lastLocalBackup, backupDir } from '../../backups/utils/backup.js';
import { ENV } from '../../../bootstrap/environment.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('backup');
commandData.setDescription('(Developer) Back up the database.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
commandData.addSubcommand((s) => s.setName('now').setDescription('Make a backup now, e.g. before a big update.'));
commandData.addSubcommand((s) =>
    s.setName('status').setDescription('When the last backup was made, and where they go.')
);

export const meta = {
    cooldown: 30,
    developerOnly: true,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { client } = interaction;
    const reply = (colour, title, description) =>
        client.utils.Embed(interaction, colour, title, description, { flags: MessageFlags.Ephemeral });

    if (interaction.options.getSubcommand() === 'status') {
        const last = await lastLocalBackup(backupDir());
        return reply(
            'Blurple',
            'Backups',
            [
                `**Daily backups:** ${ENV.BACKUPS.ENABLED ? `on, at ${String(ENV.BACKUPS.HOUR).padStart(2, '0')}:00 UTC` : 'off'}`,
                `**Last backup here:** ${last ? `<t:${Math.floor(last.getTime() / 1000)}:R>` : 'none yet'}`,
                `**Folder:** \`${backupDir()}\` (newest ${ENV.BACKUPS.KEEP} kept)`,
                `**Uploaded to:** ${ENV.BACKUPS.CHANNEL_ID ? `<#${ENV.BACKUPS.CHANNEL_ID}>` : 'nowhere (set BACKUP_CID)'}`,
            ].join('\n')
        );
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const { backup, uploaded } = await runBackup(client);
        return reply(
            'Green',
            'Backup made',
            [
                `${backup.documents.toLocaleString('en-GB')} documents in ${backup.collections.length} collections, ${(backup.buffer.length / 1024 / 1024).toFixed(2)} MB.`,
                `Saved as \`${backup.filename}\`${uploaded ? ` and uploaded to <#${ENV.BACKUPS.CHANNEL_ID}>` : ''}.`,
            ].join('\n')
        );
    } catch (error) {
        return reply('Red', 'Backup failed', `\`${error.message}\``);
    }
}
