const { Client, Intents } = require('discord.js');
const express = require('express');
const multer = require('multer');
const https = require('https');
const fs = require('fs');

const client = new Client({ 
    intents: [
        "Guilds", // Subscribe to guild events
        "GuildMessages", // Subscribe to message events
        "GuildEmojisAndStickers" // Subscribe to emoji events
    ]
});
const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'tmp';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('message', async (message) => {
    if (message.content === '!serverName') {
        const serverName = message.guild.name;
        message.channel.send(`Server Name: ${serverName}`);
    }
});

// HTTP Server endpoints
app.get('/api/server/name', (req, res) => {
    const guild = client.guilds.cache.first(); // Get the first guild the bot is in
    const serverName = guild ? guild.name : 'Bot is not in any server';
    res.json({ serverName });
});

// Endpoint to send a message to a Discord channel
app.get('/api/send/message', (req, res) => {
    const { channelId, content } = req.query; // Retrieve data from query parameters

    // Check if channelId and content are provided
    if (!channelId || !content) {
        return res.status(400).json({ error: "Channel ID and message content are required." });
    }

    // Find the channel by ID
    const channel = client.channels.cache.get(channelId);

    // Send the message to the channel
    if (channel) {
        channel.send(content);
        res.status(200).json({ success: true });
    } else {
        res.status(404).json({ error: "Channel not found." });
    }
});

// Endpoint to create a new emoji from a Roblox image ID
app.get('/api/emoji/create', (req, res) => {
    const { robloxImageId } = req.query; // Retrieve Roblox image ID from query parameters

    // Check if Roblox image ID is provided
    if (!robloxImageId) {
        return res.status(400).json({ error: "Roblox image ID is required." });
    }

    // Construct URL to download the Roblox image
    const imageUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${robloxImageId}`;

    // Download the image
    https.get(imageUrl, (response) => {
        const file = fs.createWriteStream(`tmp/${robloxImageId}.png`);
        response.pipe(file);
        file.on('finish', () => {
            // Check if the bot is in a guild
            const guild = client.guilds.cache.first();
            if (!guild) {
                return res.status(404).json({ error: "Bot is not in any guild." });
            }

            // Upload the downloaded image as a new emoji
            const emojiName = robloxImageId;
            const emojiFile = fs.readFileSync(`tmp/${robloxImageId}.png`);
            guild.emojis.create(emojiFile, emojiName)
                .then(emoji => {
                    console.log(`Emoji created: ${emoji}`);
                    res.status(200).json({ success: true });
                })
                .catch(error => {
                    console.error('Error creating emoji:', error);
                    res.status(500).json({ error: "Failed to create emoji." });
                });
        });
    }).on('error', (error) => {
        console.error('Error downloading image:', error);
        res.status(500).json({ error: "Failed to download image." });
    });
});

app.get('/api/server/members', (req, res) => {
    const guild = client.guilds.cache.first(); // Get the first guild the bot is in
    const membersCount = guild ? guild.memberCount : 0;
    res.json({ membersCount });
});

app.listen(PORT, () => {
    console.log(`HTTP Server is running on port ${PORT}`);
});

// Discord Bot login
client.login(process.env['DiscordToken']);