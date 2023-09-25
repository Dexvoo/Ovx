# Ovx Discord Bot

[![GitHub license](https://img.shields.io/github/license/Dexvoo/Ovx)](https://github.com/Dexvoo/Ovx/blob/main/license)
[![Discord](https://img.shields.io/discord/1115336808834805780)](https://discord.gg/t7tF2Qs3Qc)

## About

Ovx is a versatile Discord bot designed to make your server management and interaction with your community more enjoyable. It comes with a variety of features and commands to enhance your Discord server.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

To get started with Ovx, follow these steps:

### Prerequisites

Make sure you have the following software and resources installed:

- Node.js 14+
- Discord API Token (get it from the [Discord Developer Portal](https://discord.com/developers/applications))
- Other dependencies...

### Installation

1. Clone the repository:

   ```cmd
   git clone https://github.com/Dexvoo/Ovx.git

2. Install the dependencies:

   ```cmd
   npm install

3. Please rename the `example.env` file provided to `.env` and fill out the information

4. Start the bot in developer mode:

   ```cmd
   npm run dev

# Usage
Use Ovx to manage your server and engage with your community. Here's an example command:

   ```cmd
    /botcommand arg1 arg2
   ```
For a full list of available commands and usage instructions, consult the bot's documentation.

# Contributing
If you'd like to contribute to the project, please follow these steps:

  1. Fork the repository.
  2. Create a new branch for your feature or bug fix.
  3. Make your changes and commit them with a descriptive commit message.
  4. Push your changes to your forked repository.
  5. Submit a pull request to the main repository.

Be sure to follow our [Code of Conduct](https://www.google.com/) and [Contributing Guidelines](https://www.google.com/).

# Dependencies
Package | Required | Reason
--- | --- | ---
**@discordjs/rest** | `true` | `Rest Function To Delete/Add Commands`
**@iamtraction/google-translate** | `true` | `Translates Text In Translate Command`
**cpu-stat** | `true` | `Gives Information On Machine That Is Hosting The Bot`
**discord.js** | `true` | `Discord Imports`
**dotenv** | `true` | `Access Hidden Variables `
**mongoose** | `true` | `Database Connect`
**os** | `true` | `Gives Information On Operating System On The /Information Bot Command`
**eslint** | `false` | `Code Syntax Highlighting`
**prettier** | `false` | `Code Formatting`

# Moderation Commands
Command | User Permission | Bot Permission
--- | --- | ---
**/automod** | `Administrator` | `ManageGuild`
**/ban [user] [string]** | `BanMembers` | `BanMembers`
**/kick [user] [string]** | `KickMembers` | `KickMembers`
**/nickname [user] [string]** | `ManageNicknames` | `ManageNicknames`
**/purge [integer]** | `ManageMessages` | `ManageMessages`
**/setup** | `Administrator` | `ManageRoles`
**/sim [option]** | `Administrator` | `None`
**/takeemoji [emoji]** | `ManageGuildExpressions` | `ManageGuildExpressions`
**/timeout [user]** | `ManageMessages` | `ModerateMembers`
**/unban [userid]** | `BanMembers` | `BanMembers`

# Miscellaneous Commands
Command | Usage
--- | --- 
**/afk** | `Set your status as AFK; the bot will respond to @Tags indicating you're AFK`
**/avatar [user]** | `Gets an avatar of your choice`
**/information [choice]** | `Displays information on the bot, server, role, user`
**/invite** | `Generate a invite to the support server or the bot to your server`
**/translate [string] [Language]** | `Translate text to another language`
