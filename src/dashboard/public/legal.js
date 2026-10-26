// Terms of Service and Privacy Policy.
// Each section is a heading with paragraphs; a paragraph given as an array is a bulleted list.

export const CONTACT_EMAIL = 'ovxbot@gmail.com';

const UPDATED = '13 October 2026';

export const LEGAL_PAGES = {
    tos: {
        title: 'Terms of Service',
        updated: UPDATED,
        intro: 'These terms cover your use of the Ovx Discord bot and its dashboard at ovxbot.com (together, "Ovx"). By adding Ovx to a server, using its commands or logging in to the dashboard, you agree to them. If you do not agree, please do not use Ovx.',
        sections: [
            {
                heading: "Discord's rules come first",
                body: [
                    "Ovx runs on Discord, so you must also follow Discord's Terms of Service and Community Guidelines, including its minimum age. Anything those do not allow, you may not do with Ovx either.",
                ],
            },
            {
                heading: 'Using Ovx',
                body: [
                    'Ovx is provided free of charge, "as is" and "as available". We may add, change, limit or remove features, or stop running Ovx, at any time and without notice.',
                    'You agree not to:',
                    [
                        'Use Ovx to harass, threaten, spam, scam or harm anyone, or to share illegal or malicious content',
                        'Abuse, overload or deliberately disrupt Ovx, for example by flooding it with commands',
                        "Try to get into servers, settings or data you are not allowed to manage, or get around Ovx's permission checks",
                        'Exploit bugs or security problems. If you find one, please tell us privately instead',
                        'Copy, resell or impersonate Ovx or its team',
                    ],
                ],
            },
            {
                heading: 'Server owners and staff',
                body: [
                    'If you add Ovx to a server or change its settings, you are responsible for how it is used there. That includes:',
                    [
                        'The settings you choose on the dashboard, and the messages, roles and channels you set up',
                        'Moderation actions taken with Ovx, and any automatic actions you configure, such as muting members after a number of warnings',
                        'Letting your members know what Ovx does in your server, for example that messages are logged or that ticket conversations are saved as transcripts',
                    ],
                    "Only the server owner and people with the Manage Server or Administrator permission can change Ovx's settings on the dashboard. Changes made on the dashboard are recorded in the server's Web Logs, which other staff can see.",
                ],
            },
            {
                heading: 'Your content',
                body: [
                    'You keep ownership of the messages, settings and other content you put into Ovx. You give us permission to store and process it only as needed to run Ovx, as described in our Privacy Policy.',
                ],
            },
            {
                heading: 'Other services',
                body: [
                    'Some features rely on other services, such as Discord itself and Twitch, YouTube and Kick for stream alerts. We do not control them, and Ovx may stop working as expected if they change or are unavailable.',
                ],
            },
            {
                heading: 'Premium and purchases',
                body: [
                    "Premium can be bought inside Discord, using Discord's own store and payment system. Discord sells it on our behalf, so:",
                    [
                        "Payments are handled by Discord and are covered by Discord's Paid Services Terms as well as these terms. We never see your card or payment details",
                        'Subscriptions renew automatically until you cancel them in your Discord settings. When you cancel, premium stays active until the end of the period you have paid for',
                        "Refunds are handled by Discord under its refund policy. To ask for one, contact Discord's support. We cannot issue refunds ourselves",
                        'Prices are shown in Discord before you buy, and may change. A price change does not affect the period you have already paid for',
                    ],
                    'Premium can also be given to a server free of charge, for example as a reward or for testing.',
                    'We may change what premium includes over time, but we will not take away its main features during a period you have already paid for. If premium is removed because these terms were broken, you may not get a refund for the time left, except where the law says otherwise.',
                    'If Ovx stops running for good, we will stop taking new payments and cancel renewals as soon as we can.',
                ],
            },
            {
                heading: 'Disclaimer and liability',
                body: [
                    'You use Ovx at your own risk. We do our best to keep it running and accurate, but we do not guarantee that it will always work, that alerts or logs will always be delivered, or that data will never be lost. As far as the law allows, the Ovx team is not liable for any loss or damage resulting from your use of Ovx, including actions taken by Ovx on settings you or your staff chose.',
                ],
            },
            {
                heading: 'Ending your use',
                body: [
                    'You can stop using Ovx at any time by removing it from your server or logging out of the dashboard. We may block a user or server from using Ovx, with or without notice, especially if these terms are broken.',
                ],
            },
            {
                heading: 'Changes to these terms',
                body: [
                    'We may update these terms from time to time. The date at the top of this page shows when they last changed. If you keep using Ovx after a change, you accept the updated terms.',
                ],
            },
            {
                heading: 'Contact',
                body: ['For questions about these terms, ask in our support server or email us at:'],
                email: true,
            },
        ],
        closing: 'By using Ovx, you confirm that you have read, understood and agree to these Terms of Service.',
    },
    privacypolicy: {
        title: 'Privacy Policy',
        updated: UPDATED,
        intro: 'This policy explains what information the Ovx Discord bot and its dashboard at ovxbot.com collect, why, how long it is kept, and what you can do about it. We only collect what Ovx needs to work, and we never sell your information.',
        sections: [
            {
                heading: 'Information we store',
                body: [
                    'Depending on which features a server uses, Ovx stores:',
                    [
                        'Server settings: the options chosen on the dashboard, such as log channels, welcome messages, auto roles, level rewards, ticket settings and stream alerts, along with server, channel and role IDs',
                        "Levels: for servers with levels switched on, each member's user ID, XP, level, and counts of their messages, voice time and commands. Ovx counts messages but does not store what they say",
                        "Moderation cases: when a member is warned, muted, kicked, banned or unbanned (with Ovx or through Discord), or a moderator adds a private note about them, the member's user ID and username, the moderator, the reason or note, the length of a mute or temporary ban and the date. Members are not told about notes; only the server's moderators can see them",
                        'Temporary bans and channel locks: who is banned and when the ban ends, and for a locked channel, its permissions from before the lock and when it ends. Removed once the ban or lock ends',
                        'Tickets: who opened, claimed and closed each ticket, who was added to it, the close reason and a link to its transcript',
                        'Stream alerts: the public Twitch, YouTube or Kick channels a server follows, with their names, pictures and latest stream or video',
                        "Web Logs: when someone changes a server's settings on the dashboard, their user ID, username, display name, avatar and what they changed",
                        'Premium: whether a server or user has premium, and until when',
                        'Verification: the server’s verification settings. Codes shown when you verify are kept in memory for a few minutes only, never stored',
                        'Suggestions: what you suggest (and any image), your user ID as its author, who voted for and against it, and staff decisions. Kept until server staff delete them',
                        'Join-to-create voice: while a voice channel made for you exists, its ID, your user ID as its owner, and when it was last renamed. Deleted with the channel when everyone leaves',
                        'AutoMod: the server’s filter settings, such as its blocked words and allowed sites. The filters run in Discord’s own AutoMod. For anti-raid, Ovx only keeps the times of recent joins in memory for a few minutes, never stored',
                        "Starboard: for each message that reaches the starboard, its ID, channel and author's user ID, how many stars it has, and the ID of its starboard post. The message's text is not stored: the starboard post shows it from the original",
                        'Giveaways: the prize, channel, host, requirements and winners, and for each person who enters, their user ID, how many entries they have and when they entered',
                        'Usage counts: how many times each command is used per day, which servers used a command that day, and how many servers added or removed Ovx. No user IDs or message content. Only Ovx’s developers see these, to decide what to improve',
                        'Top.gg votes: if you vote for Ovx on Top.gg, your user ID, how many times you have voted and when you last voted. This gives 10% extra XP and bonus giveaway entries for 12 hours after voting. If you turn on vote reminders, Ovx also stores that, and when it last reminded you',
                    ],
                ],
            },
            {
                heading: 'Buying premium',
                body: [
                    "Premium is sold through Discord, which handles the payment. Discord tells us which account or server bought what, and when it starts and ends, so Ovx can switch premium on. We never receive your card, billing address or other payment details. Discord's Privacy Policy covers what it does with them.",
                ],
            },
            {
                heading: 'Logging and ticket transcripts',
                body: [
                    'Server staff can turn on logs, which make Ovx post things that happen in the server, such as edited and deleted messages (including their text), members joining and leaving, and moderation actions, to a channel in that same server. These logs are Discord messages in that server. Ovx does not keep its own copy of them.',
                    'When a ticket is closed, Ovx creates a transcript of the conversation (names, avatars, messages, embeds and links to attachments, up to 5,000 messages) and posts it as a file in the server, and to the ticket opener if the server allows it. The file is stored by Discord. Ovx keeps only the link to it.',
                ],
            },
            {
                heading: 'Translating',
                body: [
                    'When you use /translate or the Translate message menu, the text is sent to Google Cloud Translation to be translated, and the result is shown to you (or, with /translate, to the channel unless you choose private). Ovx does not store the text or the translation, and leaves the text out of its command records. Google processes it under the Google Cloud terms and does not use it to train its models.',
                    'You can use these anywhere, including DMs and servers Ovx is not in, if you add Ovx to your Discord account. Ovx only sees the text you choose to translate, never the rest of the conversation.',
                ],
            },
            {
                heading: 'Logging in to the dashboard',
                body: [
                    'The dashboard uses "Log in with Discord" and only asks for the identify and guilds permissions. It never sees your password or email address.',
                    [
                        'We read your user ID, username, display name and avatar, and the servers you can manage. These are kept in your login session',
                        "Discord's access token is used once, straight after you log in, and then revoked. It is never stored",
                        'One cookie (ovx.sid) keeps you logged in. It cannot be read by scripts on the page. Your session ends when you log out, or after 7 days without using the dashboard',
                        'Your browser also remembers that you have logged in before, so the dashboard can skip the welcome page. This is only stored in your browser',
                    ],
                    'We do not use advertising or tracking cookies, and we do not use analytics.',
                ],
            },
            {
                heading: 'How we use it',
                body: [
                    'We use this information only to:',
                    [
                        "Run Ovx's features in the servers that use them",
                        'Show server staff their settings, Web Logs and moderation cases on the dashboard',
                        'Keep Ovx secure and stop abuse',
                        'Find and fix problems: each command used is recorded, with who used it, where, and the options chosen (except private ones, like the text given to /translate). These records, and details of anything that goes wrong, are posted to a private channel only the Ovx team can see',
                        'Answer your questions and support requests',
                    ],
                ],
            },
            {
                heading: 'Who can see it',
                body: [
                    "Staff in a server who can manage it on the dashboard can see that server's settings, Web Logs and moderation cases. Members can see their own rank and the leaderboard, and moderators can see a member's warnings and case history.",
                    'We do not sell or share your information with anyone else, except:',
                    [
                        'Discord, which Ovx runs on and which handles premium payments',
                        'Twitch, YouTube and Kick, which Ovx asks for public information about the channels a server follows. No information about you is sent to them',
                        'Top.gg, which tells Ovx when you vote for it there. Ovx sends nothing about you to Top.gg',
                        'Google, which translates the text you ask Ovx to translate',
                        'Our hosting and database providers, which store the data for us',
                        'Where the law requires it',
                    ],
                ],
            },
            {
                heading: 'How long we keep it',
                body: [
                    [
                        'Web Logs are deleted automatically after 90 days',
                        'Backups: a private copy of the database is made every day and kept for 14 days, so anything deleted is gone from the backups 14 days later. Login sessions are never included',
                        'Giveaways and their entries are deleted 30 days after they end or are cancelled, or sooner if server staff delete them',
                        'Top.gg vote records are kept so your vote count carries on. Contact us to have yours deleted',
                        'Login sessions end when you log out, or after 7 days without use',
                        'Moderation cases are kept until server staff delete them on the dashboard, or the server leaves Ovx (below)',
                        "Settings, levels, tickets and stream alerts are kept while Ovx is in the server. Resetting a section on the dashboard removes its settings, but not members' levels or moderation cases",
                    ],
                    "When Ovx is removed from a server, everything it stores about that server, including members' levels and moderation cases, is deleted automatically after 30 days. If Ovx is added back within those 30 days, the server keeps its setup. Only an active premium is kept until it ends, so it is not lost. To have a server's data deleted sooner, contact us.",
                ],
            },
            {
                heading: 'Your choices and rights',
                body: [
                    "You can ask us for a copy of the information Ovx holds about you, or ask us to correct or delete it. Server owners can ask us to delete all of their server's data. Contact us using the details below, from the Discord account or server the request is about, so we can confirm it is yours.",
                    "Please note that logs and transcripts posted in a server are Discord messages controlled by that server's staff, so you may need to ask them to remove those.",
                ],
            },
            {
                heading: 'Security',
                body: [
                    'We take reasonable steps to protect your information, such as encrypted connections, secure cookies, checking permissions on every dashboard request, and not storing Discord access tokens. No service on the internet can be 100% secure, though.',
                ],
            },
            {
                heading: 'Children',
                body: [
                    "Ovx is meant for people who meet Discord's minimum age in their country. We do not knowingly collect information from anyone younger.",
                ],
            },
            {
                heading: 'Changes to this policy',
                body: [
                    'We may update this policy as Ovx changes. The date at the top of this page shows when it last changed. If you keep using Ovx after a change, the updated policy applies.',
                ],
            },
            {
                heading: 'Contact',
                body: [
                    'For questions about your information, or to make a request, ask in our support server or email us at:',
                ],
                email: true,
            },
        ],
        closing: 'By using Ovx, you confirm that you have read and understood this Privacy Policy.',
    },
};
