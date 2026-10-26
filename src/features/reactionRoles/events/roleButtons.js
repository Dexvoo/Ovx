import { Events, MessageFlags, DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { ROLE_BUTTON_PREFIX } from '../utils/panel.js';
import { toggleRole } from '../utils/assign.js';
import { legacySelect, LEGACY_SELECT_PREFIX } from '../utils/legacy.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Reaction Role Buttons';

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.inCachedGuild() || !(interaction.isButton() || interaction.isStringSelectMenu())) return;

    let run = null;
    if (interaction.isButton() && interaction.customId.startsWith(`${ROLE_BUTTON_PREFIX}:`)) {
        const [, panelId, roleId] = interaction.customId.split(':');
        run = () => toggleRole(interaction.member, panelId, roleId);
    } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith(LEGACY_SELECT_PREFIX)) {
        run = () => legacySelect(interaction);
    }
    if (!run) return;

    const t = (key, vars) => interaction.client.utils.Translate(`reactionRoles.click.${key}`, interaction.locale, vars);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let outcome;
    try {
        outcome = await run();
    } catch (error) {
        // Discord refused the role change: usually Ovx's role was moved below the role, or its permission removed
        const refused = error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions;
        if (!refused)
            LogData('Reaction Roles', `${interaction.customId} failed: ${error.stack ?? error.message}`, 'error');
        outcome = { key: refused ? 'cannot_give_generic' : 'error' };
    }
    await interaction.editReply({ content: t(outcome.key, outcome.vars), allowedMentions: { parse: [] } });
}
