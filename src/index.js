const { ShardingManager, Colors, EmbedBuilder } = require('discord.js');
const { Log, LogData } = require('./utils/Functions/ConsoleLogs.js');
require('dotenv').config();
const VotesCache = require('./cache/Votes');
// Make sure to get DevGuildID from your .env
const {
  DeveloperMode,
  PublicToken,
  DevToken,
  TopggAPIKey,
  TopggAuthorizationKey,
  VoteCID,
  Blurple,
  DevGuildID,
} = process.env;

const { AutoPoster } = require('topgg-autoposter');
const Topgg = require('@top-gg/sdk');
const webhook = new Topgg.Webhook(TopggAuthorizationKey);
const express = require('express');
const app = express();

Log('Ovx Discord Bot | Created by: @Dexvo');

const ShardManager = new ShardingManager('./src/bot.js', {
  token: DeveloperMode === 'true' ? DevToken : PublicToken,
  totalShards: 'auto',
});

ShardManager.on('shardCreate', (shard) => {
  LogData(`Shard: #${shard.id}`, `Shard Started`, 'info');
});

ShardManager.spawn()
  .then(() => {
    Log('All shards have been spawned.', 'success');
  })
  .catch((error) => {
    LogData('Sharding Manager', `An error occurred during spawn: ${error}`, 'error');
  });

if (DeveloperMode === 'false') {
  const ap = AutoPoster(TopggAPIKey, ShardManager);

  ap.on('posted', () => {
    LogData('Top GG | Stats', 'Posted', 'success');
  });
  ap.on('error', (e) => {
    LogData('Top GG | Stats', `Error posting stats to Top.gg: ${e}`, 'error');
  });

  app.post(
    '/webhook-endpoint',
    webhook.listener(async (vote) => {
      LogData('Top GG Votes', `Received vote from user ID: ${vote.user}`, 'info');

      try {
        // Increment the user's vote count in the database
        await VotesCache.incrementVotes(vote.user);
        LogData('Top GG Votes', `User ${vote.user} vote count incremented.`, 'success');

        // Wait until the ShardingManager is ready
        if (ShardManager.totalShards === 'auto' || ShardManager.shards.size === 0) {
          LogData('Top GG Votes', 'Shards not ready yet, skipping Discord log message.', 'warning');
          return;
        }

        // Calculate the shard ID for the developer guild
        const shardId = Number((BigInt(DevGuildID) >> 22n) % BigInt(ShardManager.totalShards));
        const shard = ShardManager.shards.get(shardId);

        if (!shard) {
          LogData(
            'Top GG Votes',
            `Could not find the target shard #${shardId} to send log.`,
            'error'
          );
          return;
        }

        const embedData = {
          color: Colors.Blurple,
          description: `<@${vote.user}> just voted for the bot! ❤️`,
          footer: { text: `User ID: ${vote.user}` },
          timestamp: new Date().toISOString(),
        };

        // Send log message to the specific shard
        const success = await shard.eval(
          async (c, { embedData, voteCID }) => {
            const logChannel = c.channels.cache.get(voteCID);
            if (logChannel) {
              await logChannel.send({ embeds: [embedData] });
              return true;
            }
            return false;
          },
          { context: { embedData, voteCID: VoteCID } }
        );

        if (success) {
          LogData(
            `Top GG Votes | Shard #${shardId}`,
            'Successfully sent vote log to Discord.',
            'success'
          );
        } else {
          LogData(
            `Top GG Votes | Shard #${shardId}`,
            `Channel ${VoteCID} not found on this shard.`,
            'warn'
          );
        }
      } catch (error) {
        LogData(
          'Top GG Votes',
          `An error occurred processing a vote for ${vote.user}: ${error}`,
          'error'
        );
      }
    })
  );

  app.listen(25500, () => {
    LogData(`Top GG Votes`, 'Listening on port 25500', 'success');
  });
}
