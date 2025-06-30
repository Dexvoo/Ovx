const { ShardingManager } = require('discord.js');
const { Log, LogData } = require('./utils/Functions/ConsoleLogs.js');
require('dotenv').config();
const { DeveloperMode, PublicToken, DevToken, TopggAPIKey, TopggAuthorizationKey } = process.env;


const { AutoPoster } = require('topgg-autoposter');
const Topgg = require('@top-gg/sdk');
const webhook =  new Topgg.Webhook(TopggAuthorizationKey);
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

ShardManager.spawn();



if(DeveloperMode === 'false') {
    const ap = AutoPoster(TopggAPIKey, ShardManager);

    ap.on('posted', () => {
        LogData('Top GG | Stats', 'Posted', 'success')
    });
    ap.on('error', (e) => {
        LogData('Top GG | Stats', `Error posting stats to Top.gg: ${e}`, 'error')
    });


    app.post('/webhook-endpoint', webhook.listener(async (vote) => {
			console.log(vote);

			const { user, type, query, isWeekend, bot } =  vote;
			// const channel = client.channels.cache.get('1172988214756249661');

			// client.utils.Embed(channel, Colors.Blurple, '', `This is a test (<@${user}> | Voted for <@${bot}>!)`)
		}));

		app.listen(25500, () => {
			LogData(`Top GG Votes`, 'Listening on port 25500', 'success');
		});

}


 