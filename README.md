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

# Current Moderation Commands
Command | User Permission | Bot Permission
--- | --- | ---
**/automod** | `Administrator` | `ManageGuild`
**/ban [user] [string]** | `BanMembers` | `BanMembers`
**/kick [user] [string]** | `KickMembers` | `KickMembers`
**/nickname [user] [string]** | `ManageNicknames` | `ManageNicknames`
**/purge [integer]** | `ManageMessages` | `ManageMessages`
