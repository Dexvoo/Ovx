const { ShardingManager } = require('discord.js');
const { Log, LogData } = require('./utils/Functions/ConsoleLogs.js');
require('dotenv').config();
const { DeveloperMode, PublicToken, DevToken } = process.env;

Log('Ovx Discord Bot | Created by: @Dexvo');

const ShardManager = new ShardingManager('./src/bot.js', {
    token: DeveloperMode === 'true' ? DevToken : PublicToken,
    totalShards: 'auto'
});

ShardManager.on('shardCreate', shard => {
    LogData(`Shard: #${shard.id}`, `Shard Started`, 'info');
});

ShardManager.spawn();