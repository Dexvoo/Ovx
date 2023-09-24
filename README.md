# 🤖 Welcome to Ovx Open Source Project 🚀

Ovx is an open-source Discord bot designed to simplify and enhance your server's moderation experience. With a wide range of features, including commands like `/kick`, `/ban`, `/timeout`, and many more, Ovx is here to help you maintain a safe and enjoyable community on your Discord server.

# 🌟 Main Features:
- **/kick:** Easily remove unwanted members from your server.
- **/ban:** Permanently ban rule-breakers to maintain order.
- **/timeout:** Temporarily mute or restrict access for disruptive users.
- **/purge:** Quickly delete multiple messages to keep your channels tidy.
- **Logging:** Keep track of important server actions and events.
- **And More:** Explore a variety of other moderation and utility commands!

# 🌐 Why Contribute?
Contributing to Ovx is not only a great way to improve your coding skills but also a chance to help make Discord communities safer and more enjoyable. By joining us, you can enhance Ovx with new features, improve existing ones, fix bugs, and ensure that it remains a valuable tool for server administrators.

# 🎯 How to Contribute
We welcome contributions of all sizes! Whether you're submitting a bug report, writing documentation, or creating new features, please make a pull request and it will be looked at.

# 📢 Community
Join our Discord server [here](https://discord.gg/t7tF2Qs3Qc) to chat with other contributors, ask questions, or just hang out with fellow Discord enthusiasts.

# 🙏 Thank You
Thank you for considering contributing to Ovx. Your support and contributions are essential to the success of this project. Together, we can create an amazing Discord bot that benefits the entire community.

# 📝 License
Ovx is released under the [ISC License](https://opensource.org/license/isc-license-txt/), a permissive open-source license that encourages collaboration and innovation.

Happy coding, and welcome to the Ovx community! 🎉

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
**/afk** | `Set your status as AFK, when people @Tag, the bot will respond stating they are AFK`
**/avatar [user]** | `Gets an avatar of your choice`
**/information [choice]** | `Displays information on the bot, server, role, user`
**/invite** | `Generate a invite to the support server or the bot to your server`
**/translate [string] [Language]** | `Translate text to another language`
