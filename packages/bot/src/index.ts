import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
