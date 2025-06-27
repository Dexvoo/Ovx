<h1 align="center">🤖 Ovx – The All-in-One Discord Bot</h1>
<p align="center">Advanced moderation, tickets, logging, economy, XP, and more – optimized for performance and scalability</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-In%20Rewrite-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/License-CC%20BY--NC%204.0-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Built%20With-discord.js%20v14-5865F2?logo=discord&logoColor=white&style=flat-square" />
</p>

---

## ✨ Features

- 🎫 **Tickets System** – Custom categories, claim buttons, logging, and auto-close options
- 🔨 **Moderation Tools** – Ban, kick, mute, timeouts, custom punishment reasons
- 📜 **Logging System** – Message edits/deletes, joins/leaves, channel/role updates, and more
- 💰 **Economy** – Custom currencies, shop, daily/weekly rewards, sellable items
- 🧠 **XP & Levels** – Voice + message XP, roles as rewards, cached performance
- ⚙️ **Guild Configs** – Per-server settings with MongoDB + in-memory caching
- 🧩 **Component v2 Support** – Modern Discord UI interaction with buttons & menus
- 📊 **Sharded Deployment** – Ready for large-scale hosting with PM2 and ShardingManager

---

## 🛠️ Tech Stack

- **Language:** Node.js (v24)
- **Library:** [discord.js v14](https://discord.js.org)
- **Database:** MongoDB + Mongoose
- **Caching:** node-cache (TTL strategy)
- **Deployment:** PM2 + ShardingManager
- **Other:** dotenv, custom logging, permission guard, internal utils

---

## 🚧 Current Status

Ovx is undergoing a full rewrite focused on:

- 🧱 Code structure & modularization
- ⚡ Performance (less DB reads, more caching)
- 🔐 Security & permission checks
- 📦 Command and event loading improvements

---

## 📸 Preview *(Coming Soon)*

> Screenshots, UI examples, and embed previews will be added in future updates.

---

## 📄 License

This bot is open-source under  
**Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**  
[View License →](https://creativecommons.org/licenses/by-nc/4.0/)

> 🚫 Commercial use is strictly prohibited.  
> ✅ You can fork, modify, and self-host for personal or educational purposes.

---

## 📦 Setup Instructions (Advanced Users)

```bash
# Clone the repo
git clone https://github.com/dexvoo/Ovx.git
cd Ovx

# Install dependencies
npm install

# Create a .env file with your bot settings
cp .env.example .env

# Start the bot
node index.js
```

---

## 🙌 Credits

- Developed by [@dexvoo](https://github.com/dexvoo)
- Built with ❤️ for the Discord community

---

## 📬 Want to Contribute?

Right now, the bot isn't accepting external contributions while the rewrite is underway. Stay tuned for updates and a contribution guide!
