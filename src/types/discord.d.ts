// Type-only: tells the type checker that every discord.js Client is our ModifiedClient,
// so interaction.client, member.client etc. have utils, commands, cooldowns and so on.
import type ModifiedClient from '../core/extendedClient.js';

declare module 'discord.js' {
    interface Client {
        utils: ModifiedClient['utils'];
        customEmojis: ModifiedClient['customEmojis'];
        commands: ModifiedClient['commands'];
        cooldowns: ModifiedClient['cooldowns'];
        reloadCommand(commandName: string): Promise<string>;
        dashboard(action: string, payload: unknown): Promise<unknown>;
        invalidateGuildSettings(guildId: string): Promise<void>;
    }
}
