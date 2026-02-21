import { MessageFlags } from "discord.js";
import { MessageContent } from "../DiscordUtils";
import { Utils } from "../Utilis";

export const SPACE_REGXg = /[ 　]+/g;

export const coreMessages = {
    C00_DBError: "DBエラーです（冷たい業務連絡）",
    C00_NoData: "データがありませんでした。\n最初から操作しなおしてください。",
    C00_DataVersionNotSame: "保存中のデータ構成が古いためデータがクリアされました。\n最初から操作しなおしてください。",
    C00_ReplyDMFailed: "DMでの返信に失敗しました。DMは許可されていますか？",
    C00_OtherDMFailed: "以下のユーザーへのDMに失敗しました。DMが許可されていないかもしれません。\n{0}",
    C00_NotAllowFromDM: "サーバーのチャンネルからコマンドを実行してください。",
    C00_VoteOneOnOne: "(1人1票)",
    C00_VoteAny: "(1人複数票OK)",
} as const;

export const formatError = (msg: string | MessageContent, ...args: unknown[]): MessageContent => {
    if (typeof msg === "string") {
        return {
            content: Utils.format(msg, ...args),
            flags: MessageFlags.SuppressNotifications,
        };
    }

    const content = msg.content ? Utils.format(msg.content, ...args) : msg.content;
    return {
        ...msg,
        content,
        flags: MessageFlags.SuppressNotifications,
    };
};

export type CoreMessage = (typeof coreMessages)[keyof typeof coreMessages];
