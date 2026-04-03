import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config';
import { commands } from './commands/index';
import { registerGuild } from './lib/api';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`[Bot] Logged in as ${c.user.tag}`);

  // 参加中のギルド情報をAPIに登録
  for (const [, guild] of c.guilds.cache) {
    try {
      await registerGuild(guild.id, guild.name);
      console.log(`[Bot] Registered guild: ${guild.name} (${guild.id})`);
    } catch (err) {
      console.error(`[Bot] Failed to register guild ${guild.id}:`, err);
    }
  }
});

// スラッシュコマンド実行
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(`[Bot] Error executing /${interaction.commandName}:`, err);
      const msg = '❌ コマンドの実行中にエラーが発生しました。';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(msg).catch(() => undefined);
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => undefined);
      }
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd?.autocomplete) return;
    try {
      await cmd.autocomplete(interaction);
    } catch (err) {
      console.error(`[Bot] Error in autocomplete for /${interaction.commandName}:`, err);
      await interaction.respond([]).catch(() => undefined);
    }
    return;
  }
});

client.login(config.discordToken).catch((err) => {
  console.error('[Bot] Failed to login:', err);
  process.exit(1);
});
