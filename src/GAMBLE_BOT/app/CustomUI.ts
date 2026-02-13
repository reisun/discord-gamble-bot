// import {
//   ModalBuilder,
//   TextInputBuilder,
//   ActionRowBuilder,
//   StringSelectMenuBuilder,
//   TextInputStyle,
//   Interaction,
//   ChannelType
// } from 'discord.js';
// import { v4 as uuidv4 } from "uuid";

// /**
//  * モーダルウインドウ：日時範囲指定
//  */
// export class DateRangeModal {
//   /**
//    * 
//    * @param interaction インタラクション必須（メッセージからのコマンド実行には対応できない）
//    * @returns 
//    */
//   static show = async (interaction: Interaction): Promise<string[] | null> => {
//     const customId = uuidv4();
//     // モーダルの作成
//     const modal = new ModalBuilder()
//       .setCustomId(customId)
//       .setTitle('日時範囲の設定');

//     // 日付入力フィールド
//     const fromDateInput = new TextInputBuilder()
//       .setCustomId('fromYMD')
//       .setLabel('開始日を YYYY-MM-DD 形式で入力してください')
//       .setStyle(TextInputStyle.Short);

//     // 時刻入力フィールド
//     const fromTimeInput = new TextInputBuilder()
//       .setCustomId('fromHM')
//       .setLabel('開始時刻を HH:MM 形式で入力してください')
//       .setStyle(TextInputStyle.Short);

//     // 日付入力フィールド
//     const toDateInput = new TextInputBuilder()
//       .setCustomId('toYMD')
//       .setLabel('終了日を YYYY-MM-DD 形式で入力してください')
//       .setStyle(TextInputStyle.Short);

//     // 時刻入力フィールド
//     const toTimeInput = new TextInputBuilder()
//       .setCustomId('toYM')
//       .setLabel('終了時刻を HH:MM 形式で入力してください')
//       .setStyle(TextInputStyle.Short);

//     // アクションロウに各入力フィールドを追加
//     const actionRow_1 = new ActionRowBuilder<TextInputBuilder>().addComponents(fromDateInput);
//     const actionRow_2 = new ActionRowBuilder<TextInputBuilder>().addComponents(fromTimeInput);
//     const actionRow_3 = new ActionRowBuilder<TextInputBuilder>().addComponents(toTimeInput);
//     const actionRow_4 = new ActionRowBuilder<TextInputBuilder>().addComponents(toTimeInput);

//     // モーダルにアクションロウを追加
//     modal.addComponents(actionRow_1, actionRow_2, actionRow_3, actionRow_4);

//     // モーダルを表示
//     if (!("showModal" in interaction)) {
//       return null;
//     }
//     await interaction.showModal(modal);

//     const filter = (i: any) => i.customId === customId && i.user.id === interaction.user.id;

//     const result = await interaction
//       .awaitModalSubmit({
//         filter,
//         time: 15000, // 15秒間待機
//       })
//       .then((modalInteraction) => {
//         const from_ymd = modalInteraction.fields.getTextInputValue('fromYMD');
//         const from_hm = modalInteraction.fields.getTextInputValue('fromHM');
//         const to_ymd = modalInteraction.fields.getTextInputValue('toYMD');
//         const to_hm = modalInteraction.fields.getTextInputValue('toHM');
//         return [from_ymd, from_hm, to_ymd, to_hm];
//       })
//       .catch(async (err) => {
//         await interaction.followUp({ content: '時間超過のため削除操作はキャンセルされました。', ephemeral: true });
//         return null;
//       });

//     return result;
//   }
// }

// /**
//  * モーダルウインドウ：警告メッセージ
//  */
// export class WarnningModal {
//   /**
//    * 
//    * @param interaction インタラクション必須（メッセージからのコマンド実行には対応できない）
//    * @returns 
//    */
//   static show = async (interaction: Interaction, message: string): Promise<void> => {
//     const customId = uuidv4();
//     const modal = new ModalBuilder()
//       .setCustomId(customId)
//       .setTitle("警告");

//     const infoText = new TextInputBuilder()
//       .setCustomId('info_text')
//       .setLabel('♢')
//       .setStyle(TextInputStyle.Paragraph)
//       .setValue(message)
//       .setRequired(false); // 入力を許可しないために非必須とします

//     const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(infoText);

//     modal.addComponents(actionRow);

//     // モーダルを表示
//     if ("showModal" in interaction) {
//       await interaction.showModal(modal);
//     }
//   }
// }

// /**
//  * モーダルウインドウ：削除確認メッセージ
//  */
// export class DeleteConfirmModal {
//   /**
//    * 
//    * @param interaction インタラクション必須（メッセージからのコマンド実行には対応できない）
//    * @returns 
//    */
//   static show = async (interaction: Interaction): Promise<boolean> => {
//     // モーダルウィンドウの構築
//     const customId = uuidv4();
//     const modal = new ModalBuilder()
//       .setCustomId(customId)
//       .setTitle('削除確認');

//     const confirmationInput = new TextInputBuilder()
//       .setCustomId('delete_confirmation')
//       .setLabel(`削除するには "削除" と入力してください`)
//       .setStyle(TextInputStyle.Short)
//       .setRequired(true);

//     const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(confirmationInput);

//     modal.addComponents(actionRow);

//     if (!("showModal" in interaction))
//       return false;
//     if (interaction.channel?.type !== ChannelType.GuildText) {
//       return false;
//     }

//     // モーダルを表示
//     await interaction.showModal(modal);

//     const filter = (i: any) => i.customId === customId && i.user.id === interaction.user.id;

//     const result = await interaction
//       .awaitModalSubmit({
//         filter,
//         time: 15000, // 15秒間待機
//       })
//       .then((modalInteraction) => {
//         const userInput = modalInteraction.fields.getTextInputValue('delete_confirmation');
//         return userInput === '削除';
//       })
//       .catch(async (err) => {
//         await interaction.followUp({ content: '時間超過のため削除操作はキャンセルされました。', ephemeral: true });
//         return false;
//       });

//     return result;
//   }
// }
