const { ShardingManager, Colors, EmbedBuilder } = require('discord.js');
const { Log, LogData } = require('./utils/Functions/ConsoleLogs.js');
require('dotenv').config();
const VotesCache = require('./cache/Votes')
// Make sure to get DevGuildID from your .env
const { DeveloperMode, PublicToken, DevToken, TopggAPIKey, TopggAuthorizationKey, VoteCID, Blurple, DevGuildID } = process.env;

const { AutoPoster } = require('topgg-autoposter');
const Topgg = require('@top-gg/sdk');
const webhook = new Topgg.Webhook(TopggAuthorizationKey);
const express = require('express');
const app = express();

Log('Ovx Discord Bot | Created by: @Dexvo');

const ShardManager = new ShardingManager('./src/bot.js', {
    token: DeveloperMode === 'true' ? DevToken : PublicToken,
    totalShards: 'auto'
});

ShardManager.on('shardCreate', shard => {
    LogData(`Shard: #${shard.id}`, `Shard Started`, 'info');
});

ShardManager.spawn()
    .then(() => {
        Log('All shards have been spawned.', 'success');
    })
    .catch(error => {
        LogData('Sharding Manager', `An error occurred during spawn: ${error}`, 'error');
    });


if (DeveloperMode === 'false') {
    const ap = AutoPoster(TopggAPIKey, ShardManager);

    ap.on('posted', () => {
        LogData('Top GG | Stats', 'Posted', 'success')
    });
    ap.on('error', (e) => {
        LogData('Top GG | Stats', `Error posting stats to Top.gg: ${e}`, 'error')
    });

    app.post('/webhook-endpoint', webhook.listener(async (vote) => {
        console.log(vote);
        const { user, type, bot } = vote;

        // You only need this logic if you plan to send the message from the bot
        // This is much more efficient than broadcasting.

        try {
            // Wait until the ShardingManager has spawned all shards and knows the total count
            if (ShardManager.totalShards === 'auto' || ShardManager.shards.size === 0) {
                LogData('Top GG Votes', 'Shards not ready yet, skipping vote message.', 'warn');
                return;
            }


            // Calculate the specific shard ID for your developer guild
            const shardId = Number((BigInt(DevGuildID) >> 22n) % BigInt(ShardManager.totalShards));
            LogData('Top GG Votes', `Vote received. Targeting shard: #${shardId}`, 'info');

            console.log('shardId:', shardId)
            const shard = ShardManager.shards.get(shardId);

            if (!shard) {
                LogData('Top GG Votes', `Could not find the target shard #${shardId}.`, 'error');
                return;
            }

            const Embed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setDescription(`<@${vote.user}> | Voted for <@${vote.bot}>!)`);

            // await VotesCache.get(vote.user)
            // await VotesCache.incrementVotes(vote.user)

            const success = await shard.eval(async (c, { vote, Embed }) => {

                const messageSent = await c.utils.EmbedDev('vote', c, Embed);
                if (messageSent) {
                    // client.utils.Embed(channel, Colors.Blurple, '', `This is a test (<@${userId}> | Voted for <@${botId}>!)`)
                    return true; // Return true on success
                }
                return false; // Return false if channel not found
            }, { vote, Embed });

            if (success) {
                LogData(`Top GG Votes | Shard #${shardId}`, 'Successfully sent vote message.', 'success');
            } else {
                LogData(`Top GG Votes | Shard #${shardId}`, `Channel ${VoteCID} not found on this shard.`, 'warn');
            }

        } catch (error) {
            LogData('Top GG Votes', `An error occurred processing a vote: ${error}`, 'error');
        }
    }));

    app.listen(25500, () => {
        LogData(`Top GG Votes`, 'Listening on port 25500', 'success');
    });
}