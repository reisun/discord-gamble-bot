/**
 * スラッシュコマンドを Discord に登録するスクリプト。
 * ボットが参加中の全ギルドにギルドコマンドとして登録するため即時反映される。
 *
 * 実行方法:
 *   npx ts-node src/scripts/deploy-commands.ts
 *
 * 必須環境変数:
 *   DISCORD_TOKEN       - Bot トークン
 */

import { Client, GatewayIntentBits, REST, Routes, Events } from 'discord.js';
import { commands } from '../commands/index';

const token = process.env.DISCORD_TOKEN ?? '';

if (!token) {
  console.error('[deploy-commands] 環境変数 DISCORD_TOKEN を設定してください');
  process.exit(1);
}

const body = [...commands.values()].map((cmd) => cmd.data.toJSON());
const rest = new REST().setToken(token);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  const guilds = c.guilds.cache;

  if (guilds.size === 0) {
    console.error('[deploy-commands] ボットが参加しているギルドがありません');
    process.exit(1);
  }

  for (const [, guild] of guilds) {
    try {
      console.log(`[deploy-commands] ギルド ${guild.name} (${guild.id}) に ${body.length}件のコマンドを登録中...`);
      const data = await rest.put(Routes.applicationGuildCommands(c.application.id, guild.id), { body });
      console.log(
        `[deploy-commands] ギルド ${guild.name} (${guild.id}) に ${(data as unknown[]).length}件のコマンドを正常に登録しました`
      );
    } catch (err) {
      console.error(`[deploy-commands] ギルド ${guild.id} への登録に失敗しました:`, err);
      process.exit(1);
    }
  }

  client.destroy();
});

client.login(token);
