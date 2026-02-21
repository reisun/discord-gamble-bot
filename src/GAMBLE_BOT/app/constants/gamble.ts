export const gambleMessages = {
    Gb_NotAllowFromDM: "/gb_sync はサーバーチャンネルから実行してください。",
    Gb_ResolveUnknownError: "ゲーム確定処理で不明なエラーが発生しました。",
} as const;

export type GambleMessage = (typeof gambleMessages)[keyof typeof gambleMessages];
