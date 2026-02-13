import {
    MessageCreateOptions,
    Channel,
    ChannelType,
    Client,
    Guild,
    Message,
    PartialUser,
    TextBasedChannel,
    User
} from "discord.js"

export type MessageContent =
    string |
    MessageCreateOptions & { addAction?: (rp: Message<boolean>) => Promise<void>, };

/**
 * Discord周りのユーティリティ
 */
export class DiscordUtils {
    static isUnresponsiveMessage = (client: Client, user: User | PartialUser, guild: Guild | null, allowed_serv: string[], isOutputLog: boolean): boolean => {
        if (user.id == client.user?.id) {
            if (isOutputLog) console.log("これは私")
            return false;
        }
        if (user.bot) {
            if (isOutputLog) console.log("知らないbotとはお話しちゃいけないって言われました");
            return false;
        }
        // 指定のサーバー以外では反応しないようにする
        if (guild != null && !allowed_serv.includes(guild.id)) {
            if (isOutputLog) console.log("知らないチャネルだ…");
            return false;
        }
        return true;
    }

    static isDM = (ch: Channel | null) => {
        return ch?.type === ChannelType.DM;
    }

    static createDiscordAlphabetEmoji(alp: string): string {
        // 数字⇒byte配列
        const uint32ToArrayBuffer = (n: number) => {
            const view = new DataView(new ArrayBuffer(4));
            view.setUint32(0, n);
            return view.buffer;
        }
        // byte配列⇒数字
        const arrayBufferToUint32 = (u8Array: Uint8Array) => {
            let u8Array4 = new Uint8Array(4);
            for (let i = 1; i <= u8Array.length; i++) {
                u8Array4[4 - i] = u8Array.slice(-i)[0];
            }
            return new DataView(u8Array4.buffer).getUint32(0);
        }

        const text_encoder = new TextEncoder();
        const text_decoder = new TextDecoder("utf-8");

        // discord絵文字とほぼ同じ仕様のtwemojiより、"[A]"の絵文字の文字コードを定義。⇒ twemoji"[A]"を数値化
        const twemojiA = [0xf0, 0x9f, 0x87, 0xa6];
        const twemojiANum = arrayBufferToUint32(Uint8Array.from(twemojiA));

        const stringANum = arrayBufferToUint32(text_encoder.encode("a"));
        const inputNum = arrayBufferToUint32(text_encoder.encode(alp.slice(0, 1).toLowerCase()));
        const alpIndex = inputNum - stringANum;

        const twemojiOutNum = twemojiANum + alpIndex;
        const twemojiOut = text_decoder.decode(uint32ToArrayBuffer(twemojiOutNum));

        return twemojiOut;
    }

    private static addMemtion(user: User, sendMessage: MessageContent): MessageContent {
        if (typeof sendMessage === "string") {
            return `${user} ${sendMessage}`;
        }
        else {
            sendMessage.content = `${user} ${sendMessage.content}`;
            return sendMessage;
        }
    }

    /**
     * メッセージに返信をします。（インタラクションと同じ動作にするため、本来のリプライではなく、メンションを付けて返す機能になりました。）
     * @param ch 
     * @param user 
     * @param sendMessage 
     * @returns 
     */
    static async asyncReply(ch: TextBasedChannel, user: User, sendMessage: MessageContent) {
        if ("send" in ch) {
            const rp = await ch.send(DiscordUtils.addMemtion(user, sendMessage));
            if (typeof sendMessage === "string")
                return;
            if (sendMessage.addAction)
                await sendMessage.addAction(rp);
        }
    }
    static async asyncDM(user: User, sendMessage: MessageContent) {
        const rp = await user.send(sendMessage);
        if (typeof sendMessage === "string")
            return;
        if (sendMessage.addAction)
            await sendMessage.addAction(rp);
    }
    static async asyncDM_fromUserId(client: Client, userId: string, sendMessage: MessageContent) {
        const dmChannel = await client.users.createDM(userId);
        const rp = await dmChannel.send(sendMessage);
        if (typeof sendMessage === "string")
            return;
        if (sendMessage.addAction)
            await sendMessage.addAction(rp);
    }
    static async asyncSendToChannel(ch: TextBasedChannel, sendMessage: MessageContent) {
        if ("send" in ch) {
            const rp = await ch.send(sendMessage);
            if (typeof sendMessage === "string")
                return;
            if (sendMessage.addAction)
                await sendMessage.addAction(rp);
        }
    }
}
