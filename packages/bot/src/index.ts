import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import { config } from './config';
import { commands } from './commands/index';
import { registerGuild, initBotToken, startTokenRefresh } from './lib/api';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  const version = process.env.APP_VERSION ?? '1.1.0';
  const commitHash = process.env.GIT_COMMIT ?? 'unknown';
  console.log(`[Bot] Logged in as ${c.user.tag}`);
  console.log(`[Bot] Version: ${version} (${commitHash})`);

  // Bot用トークンを取得
  try {
    await initBotToken();
    startTokenRefresh();
  } catch (err) {
    console.error('[Bot] Failed to acquire API token:', err);
    process.exit(1);
  }

  // 参加中のギルドにコマンド登録 & API にギルド情報を登録
  const rest = new REST().setToken(config.discordToken);
  const body = [...commands.values()].map((cmd) => cmd.data.toJSON());

  for (const [, guild] of c.guilds.cache) {
    try {
      await rest.put(Routes.applicationGuildCommands(c.application.id, guild.id), { body });
      console.log(`[Bot] Deployed ${body.length} commands to: ${guild.name} (${guild.id})`);
    } catch (err) {
      console.error(`[Bot] Failed to deploy commands to ${guild.id}:`, err);
    }
    try {
      await registerGuild(guild.id, guild.name, guild.icon);
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

async function loginWithBackoff() {
  const maxRetries = 10;
  const baseDelay = 5_000;
  const maxDelay = 300_000; // 5 minutes

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.login(config.discordToken);
      return;
    } catch (err) {
      console.error(`[Bot] Login attempt ${attempt}/${maxRetries} failed:`, err);

      if (attempt === maxRetries) {
        console.error('[Bot] All login attempts exhausted. Exiting.');
        process.exit(1);
      }

      // セッション上限エラーの場合、リセット時刻まで待機
      const msg = err instanceof Error ? err.message : '';
      const resetMatch = msg.match(/resets at (.+)/);
      if (resetMatch) {
        const resetTime = new Date(resetMatch[1]).getTime();
        const waitMs = resetTime - Date.now() + 5_000; // リセット後5秒の余裕
        if (waitMs > 0 && waitMs < 86_400_000) {
          const waitMin = Math.ceil(waitMs / 60_000);
          console.log(`[Bot] Session limit reached. Waiting ${waitMin} min until reset...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }

      // 指数バックオフ + ジッター
      const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
      const jitter = delay * 0.2 * Math.random();
      const waitMs = Math.round(delay + jitter);
      console.log(`[Bot] Retrying in ${Math.round(waitMs / 1000)}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

loginWithBackoff();
