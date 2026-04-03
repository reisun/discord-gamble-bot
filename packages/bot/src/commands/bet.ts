import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import {
  extractApiMessage,
  getEventGames,
  getEvents,
  getGame,
  getUserByDiscordId,
  placeBet,
} from '../lib/api';
import { betTypeLabel, buildOptMap, fmtPt, formatSelection, optionHint } from '../lib/format';

export const data = new SlashCommandBuilder()
  .setName('bet')
  .setDescription('ゲームに賭けを行います')
  .addIntegerOption((opt) =>
    opt
      .setName('game')
      .setDescription('ゲームID（受付中のゲームが候補に表示されます）')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('option')
      .setDescription('賭ける記号の文字列（ゲーム選択後にヒントが表示されます）')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName('amount')
      .setDescription('賭けるポイント数（1以上）')
      .setRequired(true)
      .setMinValue(1),
  )
  .addBooleanOption((opt) =>
    opt.setName('borrow').setDescription('借金として賭けるか（デフォルト: false）'),
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'game') {
    // 開催中イベントの受付中ゲーム一覧を候補として返す
    try {
      const events = await getEvents();
      const activeEvent = events.find((e) => e.isActive);
      if (!activeEvent) {
        await interaction.respond([]);
        return;
      }
      const games = await getEventGames(activeEvent.id);
      const openGames = games.filter((g) => g.isPublished && g.status === 'open');

      const query = focused.value.toString().toLowerCase();
      const choices = openGames
        .filter((g) => {
          if (!query) return true;
          return (
            String(g.id).includes(query) || g.title.toLowerCase().includes(query)
          );
        })
        .slice(0, 25)
        .map((g) => ({ name: `#${g.id} ${g.title}`, value: g.id }));

      await interaction.respond(choices);
    } catch {
      await interaction.respond([]);
    }
    return;
  }

  if (focused.name === 'option') {
    // 選択されたゲームに応じた入力ヒントを返す
    const gameId = interaction.options.getInteger('game');
    if (!gameId) {
      await interaction.respond([{ name: '先にゲームを選択してください', value: '' }]);
      return;
    }
    try {
      const game = await getGame(gameId);
      const hint = optionHint(game.betType, game.requiredSelections);
      const optList = game.betOptions
        .map((o) => `${o.symbol}: ${o.label}`)
        .join('、');
      await interaction.respond([
        { name: `${hint}  ／  項目: ${optList}`, value: focused.value || '' },
      ]);
    } catch {
      await interaction.respond([]);
    }
    return;
  }
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const gameId = interaction.options.getInteger('game', true);
  const optionInput = interaction.options.getString('option', true).toUpperCase();
  const amount = interaction.options.getInteger('amount', true);
  const borrow = interaction.options.getBoolean('borrow') ?? false;
  const discordId = interaction.user.id;

  // ゲーム取得
  let game;
  try {
    game = await getGame(gameId);
  } catch {
    await interaction.editReply('❌ 指定されたゲームが見つかりません。');
    return;
  }

  // 公開中 & 受付中チェック
  if (!game.isPublished || game.status !== 'open') {
    await interaction.editReply('❌ このゲームは現在受け付けていません。');
    return;
  }

  const optMap = buildOptMap(game);
  const chars = optionInput.split('');

  // 文字数チェック
  const expected =
    game.betType === 'single' ? 1 : (game.requiredSelections ?? 1);
  if (chars.length !== expected) {
    await interaction.editReply(
      `❌ ${expected}文字で入力してください。（このゲームの選択数: ${expected}）`,
    );
    return;
  }

  // 記号存在チェック
  const invalid = chars.filter((c) => !optMap.has(c));
  if (invalid.length > 0) {
    await interaction.editReply(
      `❌ 指定した記号が見つかりません。（無効: ${invalid.join(', ')}）`,
    );
    return;
  }

  // 重複チェック（重複不可方式）
  if (game.betType !== 'multi_ordered_dup' && game.betType !== 'single') {
    const unique = new Set(chars);
    if (unique.size !== chars.length) {
      await interaction.editReply('❌ 同じ記号を複数回指定できません。');
      return;
    }
  }

  // multi_unordered は昇順ソートで正規化
  let normalizedSymbols = optionInput;
  if (game.betType === 'multi_unordered') {
    normalizedSymbols = chars.sort().join('');
  }

  // ポイント確認（borrow=false の場合のみ）
  if (!borrow) {
    try {
      const userInfo = await getUserByDiscordId(discordId, game.eventId);
      if (userInfo.points < amount) {
        await interaction.editReply(
          `❌ 所持ポイントが足りません。（所持: ${fmtPt(userInfo.points)}）`,
        );
        return;
      }
    } catch {
      // ユーザーが未登録の場合はそのまま続行（API 側で作成される）
    }
  }

  // 賭け実行
  let result;
  try {
    result = await placeBet(gameId, discordId, normalizedSymbols, amount, borrow);
  } catch (err) {
    await interaction.editReply(`❌ 賭けに失敗しました。\n理由: ${extractApiMessage(err)}`);
    return;
  }

  // 最新ポイント取得
  let currentPoints: number | null = null;
  try {
    const userInfo = await getUserByDiscordId(discordId, game.eventId);
    currentPoints = userInfo.points;
  } catch {
    // 取得失敗しても応答は返す
  }

  // 応答メッセージ組み立て
  const selectionStr = formatSelection(result.selectedSymbols, optMap, game.betType);
  const isUpdated = result.isUpdated;
  const isDebt = result.isDebt;

  const header = isUpdated
    ? isDebt
      ? '🔄 賭けを変更しました！（借金）'
      : '🔄 賭けを変更しました！'
    : isDebt
      ? '✅ 賭けを受け付けました！（借金）'
      : '✅ 賭けを受け付けました！';

  const lines = [
    header,
    `ゲーム: ${game.title}`,
    `賭けた項目: ${selectionStr}`,
    `賭けたポイント: ${fmtPt(amount)}`,
  ];

  if (isDebt) {
    lines.push(`この賭けの借金額: ${fmtPt(result.debtAmount)}`);
    lines.push(
      currentPoints !== null
        ? `現在の所持ポイント: ${fmtPt(currentPoints)}（変動なし）`
        : '現在の所持ポイント: （取得失敗）',
    );
  } else {
    lines.push(
      currentPoints !== null
        ? `現在の所持ポイント: ${fmtPt(currentPoints)}`
        : '現在の所持ポイント: （取得失敗）',
    );
  }

  // betTypeLabel を応答に含める
  lines.push(`\n賭け方式: ${betTypeLabel(game.betType, game.requiredSelections)}`);

  await interaction.editReply(lines.join('\n'));
}
