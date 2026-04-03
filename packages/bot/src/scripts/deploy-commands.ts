/**
 * スラッシュコマンドを Discord に登録するスクリプト。
 * ギルドコマンドとして登録するため即時反映される。
 *
 * 実行方法:
 *   npx ts-node src/scripts/deploy-commands.ts
 *
 * 必須環境変数:
 *   DISCORD_TOKEN       - Bot トークン
 *   DISCORD_CLIENT_ID   - アプリケーション ID
 *   DISCORD_GUILD_ID    - 対象サーバー ID
 */

import { REST, Routes } from 'discord.js';
import { commands } from '../commands/index';

const token = process.env.DISCORD_TOKEN ?? '';
const clientId = process.env.DISCORD_CLIENT_ID ?? '';
const guildId = process.env.DISCORD_GUILD_ID ?? '';

if (!token || !clientId || !guildId) {
  console.error(
    '[deploy-commands] 環境変数 DISCORD_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID を設定してください',
  );
  process.exit(1);
}

const body = [...commands.values()].map((cmd) => cmd.data.toJSON());

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`[deploy-commands] ${body.length}件のコマンドを登録中...`);
    const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body,
    });
    console.log(
      `[deploy-commands] ${(data as unknown[]).length}件のコマンドを正常に登録しました`,
    );
  } catch (err) {
    console.error('[deploy-commands] 登録に失敗しました:', err);
    process.exit(1);
  }
})();
