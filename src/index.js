const { ShardingManager } = require('discord.js');
const { consoleLog, consoleLogData } = require('./utils/LoggingData.js');
require('dotenv').config();
const { DeveloperMode, PublicToken, DevToken } = process.env;

consoleLog('Ovx Discord Bot | Created by: @Dexvo');

const ShardManager = new ShardingManager('./src/bot.js', {
    token: DeveloperMode === 'true' ? DevToken : PublicToken,
    totalShards: 'auto'
});

ShardManager.on('shardCreate', shard => {
    consoleLogData(`Shard: #${shard.id}`, `Shard Started`, 'info');
});

ShardManager.spawn();