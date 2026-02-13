import {
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    Client,
} from "discord.js"

// 拡張メソッドI/F定義

// 共通のメソッドを定義するユーティリティ型
type ForEachExtension<T> = {
    // 「数珠つなぎ に .set～()できるよっていうのなら、同項目１、同項目２…も 便利に数珠つなぎで
    // 定義できるようにさせろよ」と怒り狂って用意した拡張メソッド。
    /** 指定した配列の要素だけ処理を繰り返します。 */
    forEach<U>(
        array: U[],
        func: (builder: T, item: U) => void
    ): T;
};

declare module 'discord.js' {
    // 既存の型にユーティリティ型を適用して拡張
    interface SlashCommandBuilder extends ForEachExtension<SlashCommandBuilder> { }
    interface SlashCommandSubcommandBuilder extends ForEachExtension<SlashCommandSubcommandBuilder> { }
    interface SlashCommandOptionsOnlyBuilder extends ForEachExtension<SlashCommandOptionsOnlyBuilder> { }
    interface Client {
        processingTaskCount: number,
    }
};

// 共通のforEachメソッドの実装
function forEachMethod<T, U>(
    this: T,
    array: U[],
    func: (builder: T, item: U) => void
): T {
    array.forEach(item => func(this, item));
    return this;
}

// 各プロトタイプに共通のメソッドを適用
SlashCommandBuilder.prototype.forEach = forEachMethod;
SlashCommandSubcommandBuilder.prototype.forEach = forEachMethod;
//SlashCommandOptionsOnlyBuilder.prototype.forEach = forEachMethod;
