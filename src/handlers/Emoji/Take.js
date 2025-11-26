const { Colors, parseEmoji, GuildPremiumTier } = require('discord.js');

const EMOJI_SLOTS = {
  [GuildPremiumTier.None]: 50,
  [GuildPremiumTier.Tier1]: 100,
  [GuildPremiumTier.Tier2]: 150,
  [GuildPremiumTier.Tier3]: 250,
};

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function EmojiTake(interaction) {
  const { client, guild, options } = interaction;

  const emojiStrings = [
    options.getString('emoji1'),
    options.getString('emoji2'),
    options.getString('emoji3'),
    options.getString('emoji4'),
    options.getString('emoji5'),
  ].filter(Boolean); // Filter out null/undefined options

  const success = [];
  const failed = [];

  const currentAnimated = guild.emojis.cache.filter((e) => e.animated).size;
  const currentStatic = guild.emojis.cache.filter((e) => !e.animated).size;
  const maxEmojis = EMOJI_SLOTS[guild.premiumTier];

  for (const emojiStr of emojiStrings) {
    const parsed = parseEmoji(emojiStr);
    if (!parsed || !parsed.id) {
      failed.push(`\`${emojiStr}\` (Invalid format)`);
      continue;
    }

    if (
      (parsed.animated &&
        currentAnimated + success.filter((e) => e.animated).length >= maxEmojis) ||
      (!parsed.animated && currentStatic + success.filter((e) => !e.animated).length >= maxEmojis)
    ) {
      failed.push(`${emojiStr} (Emoji slot limit reached)`);
      continue;
    }

    const url = `https://cdn.discordapp.com/emojis/${parsed.id}.${parsed.animated ? 'gif' : 'png'}`;
    const name = parsed.name;

    if (name.length < 2 || name.length > 32) {
      failed.push(`${emojiStr} (Name invalid)`);
      continue;
    }

    try {
      const newEmoji = await guild.emojis.create({ attachment: url, name: name });
      success.push(newEmoji);
    } catch (error) {
      console.error(`Failed to add emoji ${name}:`, error.message);
      failed.push(`${emojiStr} (Upload failed)`);
    }
  }

  const fields = [];
  if (success.length > 0) {
    fields.push({
      name: '✅ Added',
      value: success.map((e) => e.toString()).join(' '),
      inline: false,
    });
  }
  if (failed.length > 0) {
    fields.push({ name: '❌ Failed', value: failed.join('\n'), inline: false });
  }

  await client.utils.Embed(interaction, Colors.Blurple, 'Emoji Take Results', '', {
    fields,
    ephemeral: false,
  });
};
