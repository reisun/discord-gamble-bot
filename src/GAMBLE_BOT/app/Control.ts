import {
    Client,
    Channel,
    User,
    Message,
    Interaction,
    TextBasedChannel,
    EmbedBuilder,
    Colors,
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    APIEmbed,
    MessageFlags,
    InteractionWebhook,
    Collection
} from 'discord.js';
import { SPACE_REGXg, coreMessages, formatError } from "./constants/core";
import { MAX_MEMBER_COUNT, ALPHABET_TABLE, TEAMBUILD_DEFAULT_NUM, splaJinroMessages } from "./constants/splajinro";
import { gambleMessages } from "./constants/gamble";
import { AppMessage } from "./constants/messages";
import { GambleSyncMode, User as MyUser, SendMemberRoleOption, SplaJinroData, WorkData } from "./Model";
import { eCommandOptions, eCommands, isMyCommand, CommandParser } from "./Commands"
import { Utils } from "./Utilis";
import { DiscordUtils, MessageContent } from "./DiscordUtils";
import { DBAccesser, DBUtils } from "./db";
import { ResultOK } from './Result';
import { eContextMenuCommands, isMyContextMenuCommand } from './ContextMenuCommands';
import config from './config';
import { SyncSheetService } from './gamble/SyncSheet';
// import {
//     DateRangeModal,
//     DeleteConfirmModal, 
//     WarnningModal,
// } from './CustomUI';
import { v4 as uuidv4 } from "uuid";

// 操作者の確認、作業を飛ばすコマンドが欲しい？
//       ⇒ むしろこちらをデフォルトにしたい…が、つまりそれはGMをBOTがやるということになり
//       ゲーム進行を全て管理する必要がでてくるので、状態を知らせるコマンドが多数必要
//       また、ゲームのアレンジにも弱い

// 操作者のメンバー情報を各メンバーに共有できないか
//      ⇒ 操作ごとにメンバーに同じ内容をコピーするというとても荒々しい処理になりそう笑
//      ⇒ ボイチャにデータを持たせればイイじゃない…
//      ⇒ 反映済み

// メンバー登録する際に、同じボイチャにいるメンバーは自動的に登録できるようにしたい
//      ⇒ 初めからこれで良かった説
//      ⇒ てか、操作者別のデータも、チャンネルごとのデータ保存で済むのでは？
//      ⇒ これだったっぽい
//      ⇒ 反映済み

// TODO 投票で 中のメッセージを修正したりすると面白いか？
// TODO メッセージは組み込みにしたい。本文説明（or 導入メッセージ）<改行> 組み込みメッセージ みたいなフォーマットで。
// TODO 組み込みメッセージで複数をなるべく一つにしたいし、エラーメッセージには色を付けたりしたい。
// TODO 普通の人狼でも使えるようにしたい
// TODO 名前付きはあくまでも オプションにしたい。
//      ⇒ hide_name オプション common_name role1 role2…
//      ⇒ basic オプション role1 role2
// TODO ゲーム名とチャット名を同時に出す仕様は面倒なので、どちらかが出る仕様としたい。
//      ⇒ 共通名前付き にするなら、ちゃんと共通名前でやり取りして、
//          必要なら議論タイムで名乗るってのがゲームだと思うし。
// TODO controler　は inner と外用で分けたい。例外処理も controlerがわで

const eSendType = {
    sendReply: 1,
    sendReplyByDM: 2,
    sendDMByUserId: 3,
    sendSameChannel: 4,
    sendOtherChannel: 5,
} as const;
type eSendType = (typeof eSendType)[keyof typeof eSendType];

type SendListItem = {
    type: eSendType,
    user: MyUser,
    sendMessage: MessageContent,
    targetChannel?: TextBasedChannel,
}

const MySuccess = "success";
const MyError = "error";
type MyResult = {
    status: typeof MySuccess | typeof MyError,
    sendList: SendListItem[]
}

export class Controller {
    private _dbAccesser: DBAccesser | null = null;

    constructor() {
    }

    get initialized(): boolean {
        return this._dbAccesser != null ? true : false;
    }
    get connectedDB(): DBAccesser {
        return this._dbAccesser!;
    }
    asyncSetup = async () => {
        this._dbAccesser = await DBAccesser.connect();
        console.log('bot MyDB connected!');
        this._dbAccesser.asyncClearWorkData();
        console.log('workdata cleared!');
    }

    /**
     * インタラクションから来たコマンドの仕分け
     * @param client 
     * @param interaction 
     * @returns 
     */
    processFromInteraction = async (client: Client, interaction: Interaction) => {
        // 自分の反応やBOTの反応は無視する
        if (!DiscordUtils.isUnresponsiveMessage(client, interaction.user, interaction.guild, config.allowedServers, false))
            return;
        if (interaction.isCommand() && isMyCommand(interaction.commandName)) {
            // Discord API の仕様上 3秒以内に何らかのレスポンスを返す必要あり
            // 考え中的なレスポンスを返す
            await interaction.reply({ content: "*応答中…*", ephemeral: true })
                .catch(console.error);

            // --- コマンド解析 --- 
            // 先に平文のコマンドでの動作を整備していたためそちらに合わせる。
            // 平文のコマンドにコンバート
            const { parsedCommand: cmd, mentionUsers } = await CommandParser.asyncFromInteraction(client, interaction);

            let result: MyResult;
            try {
                result = await this.processPlaneTextCommand(cmd, interaction.user, interaction.channel!, mentionUsers, interaction);
            }
            finally {
                await interaction.deleteReply()
                    .catch((err) => console.error("応答中メッセージ非表示エラー(すでに非表示の場合でも発生)"));
                // await DiscordUtils.asyncReply(interaction.channel!, interaction.user, plainTextCommand)
                //     .catch(console.error);
            }

            // 結果に基づき処理
            this.processResultObj(result, client, interaction.user, interaction.channel!);
        }
        else if (interaction.isContextMenuCommand() && isMyContextMenuCommand(interaction.commandName)) {
            // Discord API の仕様上 3秒以内に何らかのレスポンスを返す必要あり
            // 考え中的なレスポンスを返す
            await interaction.reply({ content: "*応答中…*", ephemeral: true })
                .catch(console.error);

            let result: MyResult;
            try {
                result = await this.processContextMenuCommand(interaction.commandName, interaction);
            }
            finally {
                await interaction.deleteReply()
                    .catch(console.error);
                // await DiscordUtils.asyncReply(interaction.channel!, interaction.user, plainTextCommand)
                //     .catch(console.error);
            }

            // 結果に基づき処理
            this.processResultObj(result, client, interaction.user, interaction.channel!);
        }
    }

    /**
     * メッセージから来たコマンドの仕分け
     * @param client 
     * @param message 
     * @returns 
     */
    processFromMessage = async (client: Client, message: Message) => {
        // 自分の反応やBOTの反応は無視する
        if (!DiscordUtils.isUnresponsiveMessage(client, message.author, message.guild, config.allowedServers, false))
            return;

        const cmd = CommandParser.fromPlaneText(message.content);
        const mentionUsers: MyUser[] = message.mentions.users.map(itr => {
            return {
                id: itr.id,
                name: itr.displayName,
            }
        });

        // コマンド処理
        const result = await this.processPlaneTextCommand(cmd, message.author, message.channel, mentionUsers);

        // 結果に基づき処理
        this.processResultObj(result, client, message.author, message.channel);
    }

    /**
     * リアクションに対する処理
     * @param client 
     * @param lastReaction 
     * @param user 
     * @returns 
     */
    processFromReaction = async (
        client: Client,
        lastReaction: MessageReaction | PartialMessageReaction,
        user: User | PartialUser
    ): Promise<void> => {

        // 自分の反応やBOTの反応は無視する
        if (!DiscordUtils.isUnresponsiveMessage(client, user, lastReaction.message.guild, config.allowedServers, false))
            return;

        // BOT自身のメッセージに対する反応で無ければ無視する
        if (lastReaction.message.author == null
            || client.user == null
            || lastReaction.message.author.id != client.user.id) {
            return;
        }

        // BOT自身のメッセージに埋め込みメッセージが無ければ少なくとも投票ではないので無視する
        if (!lastReaction.message.embeds || lastReaction.message.embeds.length != 1)
            return;

        // 埋め込みメッセージのフッタに投票を示す文字列が入っていれば処理する
        const embed = lastReaction.message.embeds[0];
        const voteMsg = [coreMessages.C00_VoteOneOnOne, coreMessages.C00_VoteAny]
        if (embed.footer == null
            || !voteMsg.some(v => embed.footer!.text.includes(v))
        ) {
            return;
        }

        const getMyCheckReactionsOnCache = async () => {
            const allReactions = lastReaction.message.reactions.cache.map(r => r);
            const myCheckReactions: MessageReaction[] = [];
            for (const r of allReactions) {
                const us = r.users.cache;
                if (us.find(u => u.id == user.id))
                    myCheckReactions.push(r);
            };
            return myCheckReactions;
        }

        if (embed.footer.text == coreMessages.C00_VoteOneOnOne) {
            // 一人一票
            // ⇒ 直近のリアクション以外は削除
            const myCheckReactionsOnCache = await getMyCheckReactionsOnCache();
            if (myCheckReactionsOnCache.length <= 1) {
                return;
            }
            for (const r of myCheckReactionsOnCache) {
                if (lastReaction.emoji.identifier != r.emoji.identifier) {
                    await r.users.remove(await user.fetch());
                }
            }
        }
        else {
            // 一人複数票あり
            // ⇒ 何もしない
        }
    }

    /**
     * コマンドに対する処理結果として生成したコマンドリストを処理する
     * @param result 
     * @param client 
     * @param user 
     * @param channel 
     */
    processResultObj = async (result: MyResult, client: Client, user: User, channel: TextBasedChannel) => {
        // 順番に送信する前提で格納されている場合もあるので
        // 送信ごとに待機する
        let dmFailedUser: MyUser[] = []
        for (const sendObj of result.sendList) {
            switch (sendObj.type) {
                case eSendType.sendReply:
                    await DiscordUtils.asyncReply(channel, user, sendObj.sendMessage)
                        .catch(console.error);
                    break;
                case eSendType.sendReplyByDM:
                    await DiscordUtils.asyncDM(user, sendObj.sendMessage)
                        .catch(e => DiscordUtils.asyncReply(channel, user, Utils.format(coreMessages.C00_ReplyDMFailed,)))
                        .catch(console.error);
                    break;
                case eSendType.sendDMByUserId:
                    await DiscordUtils.asyncDM_fromUserId(client, sendObj.user.id, sendObj.sendMessage)
                        .catch(e => dmFailedUser.push(sendObj.user));
                    break;
                case eSendType.sendSameChannel:
                    await DiscordUtils.asyncSendToChannel(channel, sendObj.sendMessage)
                        .catch(console.error);
                    break;
                case eSendType.sendOtherChannel:
                    if (sendObj.targetChannel) {
                        await DiscordUtils.asyncSendToChannel(sendObj.targetChannel, sendObj.sendMessage)
                            .catch(console.error);
                    }
                    break;
            }
        }
        if (dmFailedUser.length > 0) {
            const unique = Utils.unique(dmFailedUser, v => v.id);
            const memList = unique.map(u => "* " + u.name).join("\n").replace(/\n$/, "");
            await DiscordUtils.asyncReply(channel, user, Utils.format(coreMessages.C00_OtherDMFailed, memList))
                .catch(console.error);
        }
    }

    /* コマンドの実装 */
    processPlaneTextCommand = async (cmd: CommandParser, user: User, channel: TextBasedChannel, users: MyUser[], interaction?: Interaction): Promise<MyResult> => {
        let isDM = DiscordUtils.isDM(channel);
        let sender: MyUser = {
            id: user.id,
            name: user.displayName,
        }

        switch (cmd.command) {
            case eCommands.Member:
                return await this.updateMember(isDM, channel.id, channel, sender, cmd, users);
            case eCommands.SuggestRole:
                return await this.suggestRole(isDM, channel.id, channel, sender, cmd);
            case eCommands.SendRole:
                return await this.sendRole(isDM, channel.client, sender, cmd, true/* コマンドが送られている=>GMが送っていると判断 */);
            case eCommands.CreateVote:
                return await this.createVote(isDM, channel.id, channel, sender, user);
            case eCommands.EjectFromVote:
                return await this.ejectMemberForVote(isDM, channel.id, channel, sender, cmd, users);
            case eCommands.SendRoleOption:
                return await this.updateSendRoleOption(isDM, channel.id, cmd);
            case eCommands.ClearMemberData:
                return await this.clearData(isDM, channel.id);
            case eCommands.TeamBuilder:
                return await this.buildTeam(isDM, channel.id, channel, sender, cmd);
            case eCommands.MessageCopy:
                return await this.messageCopy(isDM, channel.client, channel, sender, cmd, interaction);
            case eCommands.GambleSync:
                return await this.gambleSync(isDM, channel.id, cmd);
            default:
                return {
                    status: MySuccess,
                    sendList: [],
                };
        }
    }

    gambleSync = async (isDM: boolean, channelId: string, cmd: CommandParser): Promise<MyResult> => {
        if (isDM) {
            return MyFuncs.createErrorReply(gambleMessages.Gb_NotAllowFromDM);
        }

        const { status, value: session } = await this.connectedDB.asyncSelectGambleSessionForce(channelId);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        const spreadsheetId = cmd.getValue(0, 1) ?? session.spreadsheetId;
        const sheetName = cmd.getValue(0, 2) ?? session.sheetName;
        const credentialRef = cmd.getValue(0, 3) ?? session.credentialRef;
        const mode = (cmd.getValue(0, 4) as GambleSyncMode | null) ?? "full";

        const updSuccess = await this.connectedDB.asyncUpdateGambleSession(channelId, {
            spreadsheetId,
            sheetName,
            credentialRef,
        });
        if (!updSuccess) {
            return MyFuncs.createErrorReply(coreMessages.C00_DBError);
        }

        try {
            const syncSession = {
                ...session,
                spreadsheetId,
                sheetName,
                credentialRef,
            };
            const result = await SyncSheetService.sync(syncSession, mode);
            return MyFuncs.createSuccessReply(
                `同期に成功しました。mode=${result.mode}\nusers_balance=${result.rows.users_balance}, bets=${result.rows.bets}, ledger=${result.rows.ledger}\nspreadsheetId=${spreadsheetId}`,
            );
        }
        catch (e) {
            return MyFuncs.createErrorReply(SyncSheetService.toDiscordErrorMessage(e));
        }
    }
    
    resolveGame = async (sessionId: string, gameId: string, winningTicket: string): Promise<MyResult> => {
        try {
            const { summary } = await this.connectedDB.asyncResolveGame(sessionId, gameId, winningTicket);
            const msg = [
                `ゲーム確定が完了しました。`,
                `- 総額: ${summary.totalStake}`,
                `- 当選口数: ${summary.winningBetCount}`,
                `- 最大払戻: ${summary.maxPayout}`,
            ].join("\n");
            return MyFuncs.createSuccessReply(msg);
        }
        catch (error) {
            const errMessage = error instanceof Error ? error.message : gambleMessages.Gb_ResolveUnknownError;
            return MyFuncs.createErrorReply(errMessage);
        }
    }

    updateMember = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser, cmd: CommandParser, inputMenbers: MyUser[]): Promise<MyResult> => {
        if (isDM && inputMenbers.length > 0) {
            // ではだめにする。メンバーのメンションが必要なので
            return MyFuncs.createErrorReply(splaJinroMessages.C02_NotAllowFromDM);
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        // 現人狼参加者
        let memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, false);

        // 処理前に入力メンバーの メンバー名の空白を _ アンスコ に置換しておく
        for (let i = 0; i < inputMenbers.length; i++) {
            inputMenbers[i].name = inputMenbers[i].name.replace(SPACE_REGXg, "_");
        }

        // ---参照モード
        if (cmd.existsOption(eCommandOptions.show) || inputMenbers.length == 0) {
            // 人狼参加者と、ボイスチャンネルに居るが参加者でない人、を表示
            let embeds: APIEmbed[] = [];

            const memberMsg = memberList
                .map(mem =>
                    Utils.format(splaJinroMessages.C06_inner_MemberFormat, `${mem.name}`)
                ).join("\n");

            // 人狼さん参加者を埋め込みメッセージでチームを表示
            const embedJoin = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle('人狼参加者！')
                .setDescription(memberMsg == "" ? "--参加者０人--" : memberMsg)
                .toJSON();

            embeds.push(embedJoin);

            if (ch.isVoiceBased()) {
                const chMemberLsit = ch.members.map(chmem => { return { id: chmem.id, name: chmem.displayName }; });
                {
                    const ignoreMemberMsg = chMemberLsit
                        .filter(chmem => !memberList.some(mem => mem.id == chmem.id))
                        .map(chmem =>
                            Utils.format(splaJinroMessages.C02_inner_MemberFormat, chmem.name)
                        ).join("\n");

                    const embedIgnore = new EmbedBuilder()
                        .setColor(Colors.Grey)
                        .setTitle('チャンネル内の不参加者')
                        .setDescription(ignoreMemberMsg == "" ? "--いません♪--" : ignoreMemberMsg)
                        .toJSON();
                    embeds.push(embedIgnore);
                }

                {
                    const addMemberMsg = memberList
                        .filter(chmem => !chMemberLsit.some(mem => mem.id == chmem.id))
                        .map(chmem =>
                            Utils.format(splaJinroMessages.C02_inner_MemberFormat, chmem.name)
                        ).join("\n");

                    if (addMemberMsg) {
                        const embedAdd = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('チャンネル外の参加者')
                            .setDescription(addMemberMsg)
                            .toJSON();
                        embeds.push(embedAdd);
                    }
                }
            }

            return MyFuncs.createSuccessReply({
                content: splaJinroMessages.C02_MemberView,
                embeds: embeds,
            });
        }

        // ---追加・削除モード

        // 既存メンバーに対して追加削除を行ったリストを作成
        let newMemberList: MyUser[] = [];
        if (cmd.existsOption(eCommandOptions.add)) {
            newMemberList = memberList.concat(inputMenbers);
        }
        else {
            newMemberList = memberList.filter(m => !inputMenbers.some(im => im.id == m.id));
        }
        newMemberList = Utils.unique(newMemberList, v => v.id);

        // チャンネル内のメンバーと現在のメンバーを重複無しで合わせたリスト（＝今回の処理に関係するユーザーのリスト）を作る
        const channelMembers = ch.isVoiceBased() ? ch.members.map(m => { return { id: m.id, name: m.displayName }; }) : [];
        const concatMemberList = Utils.unique(channelMembers.concat(newMemberList), v => v.id);
        // 今回の処理に関係するユーザーが、チャンネル内のメンバーを基準にして "追加"・"削除"・"変わらず"、のどれに当たるのかフラグを付ける
        let concatMemberListWithFlag: { member: MyUser, status: "add" | "delete" | "none" }[] = [];
        concatMemberList.forEach(cctMen => {
            const isChannelMem = channelMembers.some(chMem => chMem.id == cctMen.id);
            const isInNew = newMemberList.some(inpMem => inpMem.id == cctMen.id);
            // チャンネルメンバーにいる かつ 現在のメンバーにもいる ⇒ そのまま
            if (isChannelMem && isInNew) {
                concatMemberListWithFlag.push({ member: cctMen, status: "none" });
            }
            // チャンネルメンバーにいる かつ 現在のメンバーにいない ⇒ 削除
            else if (isChannelMem && !isInNew) {
                concatMemberListWithFlag.push({ member: cctMen, status: "delete" });
            }
            // チャンネルメンバーにいない かつ 現在のメンバーにいる ⇒ 追加
            else if (!isChannelMem && isInNew) {
                concatMemberListWithFlag.push({ member: cctMen, status: "add" });
            }
            // チャンネルメンバーにいない かつ 現在のメンバーにいない ⇒ そのまま
            else {
                concatMemberListWithFlag.push({ member: cctMen, status: "none" });
            }
        });

        const updSuccess = await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
            'add_member_list': concatMemberListWithFlag.filter(m => m.status == "add").map(m => m.member),
            'ignore_member_list': concatMemberListWithFlag.filter(m => m.status == "delete").map(m => m.member),
        });
        if (!updSuccess) {
            return MyFuncs.createErrorReply(splaJinroMessages.C02_DBError,);
        }

        // 参照モードを利用して最終的なメンバーのメッセージを取得し、返信
        const showCmd = CommandParser.fromPlaneText(`${eCommands.Member} ${eCommandOptions.show}`);
        return await this.updateMember(isDM, channelId, ch, sender, showCmd, []);
    }

    suggestRole = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser, orgCmd: CommandParser): Promise<MyResult> => {
        if (isDM) {
            // DMからでもOK
            console.log("dmで受信");
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId,)
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        // 複数のメッセージが入る場合があるので先に作っておく
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }

        // 前回コマンドを利用する場合もあるため、このタイミングで--no-checkオプションがあるかどうか控えておく
        let noCheckOptExists = orgCmd.existsOption(eCommandOptions.nocheck);

        // コマンドチェック
        let cmd = orgCmd;
        let uesPredata = false;
        if (cmd.getValue(0, 1) == null) {
            // 引数が１個も無い場合は前回のデータを採用
            uesPredata = true;
            cmd = CommandParser.fromPlaneText(data.prev_suggest_role_command_string ?? "");
            if (cmd.isEmpty()) {
                return MyFuncs.createErrorReply(splaJinroMessages.C03_NonAgainData,);
            }
        }
        // コマンドチェックつづき
        // 前回データの利用だからといってエラーにならないわけでは無い
        if (cmd.getValue(0, 2) == null) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(splaJinroMessages.C03_RorlArgNothing, eCommands.SuggestRole))
            return result;
        }
        else if ((cmd.getLength(0) - 2) > MAX_MEMBER_COUNT) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(splaJinroMessages.C03_ToMany, MAX_MEMBER_COUNT))
            return result;
        }

        // コマンドの内容を保持
        let theName = cmd.getValue(0, 1)!;
        let roleNameList: string[] = [];
        for (let i = 2; i < cmd.getLength(0); i++) {
            roleNameList.push(cmd.getValue(0, i)!);
        }

        if (uesPredata) {
            result.sendList.push(MyFuncs.createReply(
                splaJinroMessages.C03_UsePredata,
                theName,
                roleNameList.join("、")))
        }

        // メンバーチェック
        const memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, !noCheckOptExists);
        if (memberList.length == 0) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(splaJinroMessages.C03_MemberNothing,))
            return result;
        }
        // メンバー多すぎ問題
        if (memberList.length > MAX_MEMBER_COUNT) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(splaJinroMessages.C03_ToMany, MAX_MEMBER_COUNT));
            return result;
        }
        if (memberList.length < roleNameList.length) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(
                splaJinroMessages.C03_MemberFew,
                roleNameList.length,
                memberList.length));
            return result;
        }

        // ---ロール割り振り作成

        // 村人を初期値にして、役職ごとにランダムでメンバーに割り振り
        let workMemberList: { member: MyUser, dispName: string, role: string }[]
            = memberList.map(mem => { return { member: mem, dispName: "", role: "村人" }; });
        roleNameList.forEach(role => {
            let hitIdx = 999;
            do {
                hitIdx = Utils.getRandomInt(workMemberList.length - 1);
            } while ((workMemberList.at(hitIdx)?.role ?? "") != "村人"); // 村人でなければ再抽選
            workMemberList[hitIdx].role = role;
        });

        // アルファベットテーブルをランダムに回してメンバーに割り振り
        let alpList = ALPHABET_TABLE.concat();
        for (let i = 0; Utils.getRandomInt(alpList.length); i++) {
            alpList.push(alpList.shift()!);
        }
        alpList = alpList.slice(0, workMemberList.length);

        // メンバーにランダムに割り当て
        alpList.forEach(alp => {
            let hitIdx = 999;
            do {
                hitIdx = Utils.getRandomInt(workMemberList.length - 1);
            } while ((workMemberList.at(hitIdx)?.dispName ?? "-1") != ""); // 空で無ければ再抽選
            workMemberList[hitIdx].dispName = theName + alp;
        });

        // --- 文字列化
        let memberRoleStr = "";

        // 見易くなるよう文字幅調整用の数を求める
        let roleMaxlen = Math.max(...roleNameList.map(v => v.length));

        memberRoleStr = workMemberList.map(obj =>
            Utils.format(splaJinroMessages.C03_inner_MemberFormat,
                obj.dispName,
                obj.role.padEnd(roleMaxlen, "　"), // 役職は全角だろうという前提で文字幅調整
                obj.member.name),
        ).join("\n");

        // sendRole用の平文のコマンドを作成
        const planeTextForSnedRole = Utils.format(
            splaJinroMessages.C03_SuggestMember,
            eCommands.SendRole,
            ch.id,
            memberRoleStr);

        // --no-checkオプションがあるなら、確認なしで各メンバーにDMする
        if (noCheckOptExists) {
            // sendRoleに渡す
            const sendRoleRet = await this.sendRole(
                true,/*trueにしてDMから送っていることにする*/
                ch.client,
                sender,
                CommandParser.fromPlaneText(planeTextForSnedRole),
                false, /* isSenderRoleChecked */
            );
            if (sendRoleRet.status == 'error') {
                return sendRoleRet;
            }
            // 成功時のレスポンスを追加
            sendRoleRet.sendList.forEach(snedParam => {
                result.sendList.push(snedParam);
            });
        }
        else {
            // --no-checkオプションがない場合
            // メッセージに sendRole用コマンドを含める
            result.sendList.push(
                MyFuncs.createReplyDM(splaJinroMessages.C03_SuggestMemberExplain),
                MyFuncs.createReplyDM(planeTextForSnedRole),
            );
        }

        if (!uesPredata) {
            // 今回のパラメータを記憶
            const updSuccess = await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
                'prev_suggest_role_command_string': cmd.orgString,
            });
            // これがDBエラーでもメイン処理に弊害は無いのでログだけにする
            if (!updSuccess) {
                console.log("prevSuggestRoleCommandString update failed. channelid:" + channelId);
            }
        }
        return result;
    }

    sendRole = async (isDM: boolean, client: Client, sender: MyUser, cmd: CommandParser, isSenderRoleChecked: boolean): Promise<MyResult> => {
        if (!isDM) {
            // DMで送らないと視えちゃうのでだめ
            return MyFuncs.createErrorReply(splaJinroMessages.C04_NeedDM);
        }

        // コマンドチェック
        const channelId = cmd.getValue(1, 0);
        if (channelId == null) {
            return MyFuncs.createErrorReply(splaJinroMessages.C04_ChannelIdArgNothing,);
        }

        if (cmd.getValue(2, 0) == null) {
            return MyFuncs.createErrorReply(splaJinroMessages.C04_MemberArgNothing,);
        }

        // メンバー情報を取得するため、人狼部屋のチャンネルを取得
        const ch = await client.channels.fetch(channelId).catch(() => console.log("invalid channel id. [" + channelId + "]"));
        if (!ch || ch.isDMBased() || !config.allowedServers.includes(ch.guildId)) {
            return MyFuncs.createErrorReply(splaJinroMessages.C04_InvalidChannelId,);
        }

        // メンバー取得
        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId,);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        const memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, isSenderRoleChecked);
        if (memberList.length == 0) {
            return MyFuncs.createErrorReply(splaJinroMessages.C04_MemberNothing,);
        }

        // コマンド情報から、メンバー情報をパース
        const memberRoleList = cmd.parseMemberRoleSetting(memberList);

        // メンバーより少ない分には良しとする。参加者以外がメンバーに入っている場合はエラー
        if (memberRoleList.some(mr => !memberList.some(m => m.id == mr.id))) {
            return MyFuncs.createErrorReply(splaJinroMessages.C04_UnknownMemberContain, eCommands.SuggestRole);
        }

        // 送信コマンドを記憶する。投票除外メンバーをリセットする
        const updSuccess = await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
            'prev_send_role_command_string': cmd.orgString,
            'eject_member_list': [],
        });
        if (!updSuccess) {
            return MyFuncs.createErrorReply(splaJinroMessages.C04_DBError,);
        }

        // 各メンバーにDM
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        };

        for (const mem of memberRoleList) {
            result.sendList.push(
                MyFuncs.createDMToOtherUser(
                    mem,
                    splaJinroMessages.C04_SendRoleTmpl,
                    mem.theName, mem.role
                )
            );
        }

        // オプションの処理
        const optionList = MyFuncs.parseSendRoleOption(data.send_role_option);
        for (const opt of optionList) {
            if (opt.action == "canknow") {
                // △△に◆◆の役職を伝えるオプション
                for (const mem of memberRoleList.filter(mem => mem.role == opt.targetRole)) {
                    result.sendList.push(
                        MyFuncs.createDMToOtherUser(
                            mem,
                            splaJinroMessages.C04_SendKnowTmpl,
                            mem.role,
                            opt.complement,
                            memberRoleList
                                .filter(m => m.role == opt.complement)
                                .map(m => `${m.theName}(${m.name})`).join("、 "),
                        )
                    );
                }
            }
        }

        // 送信成功を伝えるDM
        result.sendList.push(MyFuncs.createReply(splaJinroMessages.C04_DMSuccess,));
        return result;
    }

    /**
     * 投票作成
     * @param isDM 
     * @param user 
     * @returns 
     */
    createVote = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser, user: User): Promise<MyResult> => {
        if (isDM) {
            return MyFuncs.createErrorReply(splaJinroMessages.C05_NotAllowFromDM);
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        if (!data.prev_send_role_command_string) {
            return MyFuncs.createErrorReply(splaJinroMessages.C05_NotStartJinro);
        }

        // GMをメンバーとみなすか、みなさないか問題は、send_role コマンドにGMがいたかどうかで判断する
        const memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, false/* ignoreGm */);

        // 前回のメンバー通知コマンドをパース
        let memberRoleList = CommandParser.fromPlaneText(data.prev_send_role_command_string)
            .parseMemberRoleSetting(memberList);

        if (memberRoleList.length == 0) {
            return MyFuncs.createErrorReply(splaJinroMessages.C05_RoleDataNothingInData);
        }

        // 追放者を除く
        memberRoleList = memberRoleList.filter(m => !data.eject_member_list.some(em => em.id == m.id));
        if (memberRoleList.length == 0) {
            return MyFuncs.createErrorReply(splaJinroMessages.C05_AllMemberEjected);
        }

        let msg = "";
        memberRoleList.forEach(memRole => {
            const emoji = DiscordUtils.createDiscordAlphabetEmoji(memRole.alphabet);
            msg += `${emoji} ${memRole.theName} (${memRole.name})\n`;
        });

        // 埋め込みメッセージで投票を作成
        const embed = new EmbedBuilder()
            .setColor(Colors.Aqua)
            .setAuthor({
                name: user.displayName,
                iconURL: user.avatarURL() ?? undefined,
            })
            .setTitle('今日は誰を追放しますか？')
            .setDescription(msg)
            .setFooter({ text: Utils.format(coreMessages.C00_VoteOneOnOne) })
            .setTimestamp()
            .toJSON();

        return MyFuncs.createSuccessSendSameChannel({
            embeds: [embed],
            addAction: async (rp: Message<boolean>) => {
                for (const memRole of memberRoleList) {
                    await rp.react(DiscordUtils.createDiscordAlphabetEmoji(memRole.alphabet))
                        .catch(console.error);
                }
            }
        },);
    }

    /**
     * 投票から除外する
     * @param isDM 
     * @param user 
     * @returns 
     */
    ejectMemberForVote = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser, cmd: CommandParser, inputMenbers: MyUser[]): Promise<MyResult> => {
        if (isDM) {
            // メンバーを指定するのでサーバーのチャンネルからどうぞ
            return MyFuncs.createErrorReply(splaJinroMessages.C06_NotAllowFromDM);
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        if (!data.prev_send_role_command_string) {
            return MyFuncs.createErrorReply(splaJinroMessages.C05_NotStartJinro);
        }

        // 現追放者リスト
        let ejectList = data.eject_member_list;

        // 処理前に入力メンバーの メンバー名の空白を _ アンスコ に置換しておく
        for (let i = 0; i < inputMenbers.length; i++) {
            inputMenbers[i].name = inputMenbers[i].name.replace(SPACE_REGXg, "_");
        }

        // ---参照モード
        if (cmd.existsOption(eCommandOptions.show) || inputMenbers.length == 0) {
            // 直近の役職リストから現在のゲームのメンバーを取得
            const memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, false/* 役職リストでGMを含んでいるかそうでないか分かるのでここでは除かない */);
            const memberRoleList = CommandParser.fromPlaneText(data.prev_send_role_command_string).parseMemberRoleSetting(memberList);

            let alived = memberRoleList
                .filter(m => !ejectList.some(em => em.id == m.id))
                .map(mem =>
                    Utils.format(splaJinroMessages.C06_inner_MemberFormat, `${mem.theName} (${mem.name})`)
                ).join("\n");

            // 埋め込みメッセージでチームを表示
            const embedAlive = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle('生存者')
                .setDescription(alived == "" ? "--生存者なし--" : alived)
                .toJSON();

            let ejected = ejectList.map(mem =>
                Utils.format(splaJinroMessages.C06_inner_MemberFormat, mem.name)
            ).join("\n");

            const embedEjected = new EmbedBuilder()
                .setColor(Colors.Grey)
                .setTitle('追放された方々')
                .setDescription(ejected == "" ? "まだいませんよ。まだね。" : ejected)
                .toJSON();

            return MyFuncs.createSuccessSendSameChannel({
                content: "現在の生存者と追放者は以下の通りです。",
                embeds: [embedAlive, embedEjected],
            },);
        }

        // ---追加モード
        if (cmd.existsOption(eCommandOptions.add)) {
            ejectList = Utils.unique(ejectList.concat(inputMenbers), u => u.id);
            const updSuccess = await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
                'eject_member_list': ejectList,
            });
            if (!updSuccess) {
                return MyFuncs.createErrorReply(coreMessages.C00_DBError,);
            }

            // 参照モードを利用して最終的なメンバーのメッセージを取得し、返信
            const showCmd = CommandParser.fromPlaneText(`${eCommands.EjectFromVote} ${eCommandOptions.show}`);
            return await this.ejectMemberForVote(isDM, channelId, ch, sender, showCmd, []);
        }

        // ---削除モード
        if (cmd.existsOption(eCommandOptions.delete)) {
            ejectList = ejectList.filter(m => !inputMenbers.some(im => im.id == m.id));
            const updSuccess = await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
                'eject_member_list': ejectList,
            });
            if (!updSuccess) {
                return MyFuncs.createErrorReply(coreMessages.C00_DBError,);
            }

            // 参照モードを利用して最終的なメンバーのメッセージを取得し、返信
            const showCmd = CommandParser.fromPlaneText(`${eCommands.EjectFromVote} ${eCommandOptions.show}`);
            return await this.ejectMemberForVote(isDM, channelId, ch, sender, showCmd, []);
        }

        // ここには来ないはず（コマンドミス以外では）
        return MyFuncs.createSuccessReply(`${cmd.command} のコマンド指定が間違っているようどす。`);
    }

    updateSendRoleOption = async (isDM: boolean, channelId: string, cmd: CommandParser): Promise<MyResult> => {
        if (isDM) {
            return MyFuncs.createErrorReply(coreMessages.C00_NotAllowFromDM,);
        }

        // asyncSelectSplaJinroDataForce を呼ぶことで、データが未登録の場合でも自動的にInsertされる
        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        // オプション更新
        await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
            'send_role_option': cmd.orgString,
        })

        // どのオプションが有効か表示
        let msg = "";
        const optionList = MyFuncs.parseSendRoleOption(cmd.orgString);
        for (const opt of optionList) {
            if (opt.action == "canknow") {
                msg += Utils.format(splaJinroMessages.C03_inner_0_know_to_1, opt.targetRole, opt.complement) + "\n";
            }
        }

        return MyFuncs.createSuccessReply(splaJinroMessages.C07_EnabledOptions, msg);
    }

    /**
     * データ削除
     * @param isDM 
     * @param user 
     * @returns 
     */
    clearData = async (isDM: boolean, channelId: string): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId,);
        if (!data) {
            return MyFuncs.createErrorReply(splaJinroMessages.C08_DataNothing,);
        }

        const delSuccess = await this.connectedDB.asyncDeleteSplaJinroData(channelId);
        if (!delSuccess) {
            return MyFuncs.createErrorReply(splaJinroMessages.C08_DBError,);
        }

        return MyFuncs.createSuccessReply(splaJinroMessages.C08_ClearMemberData,);
    }

    buildTeam = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser, cmd: CommandParser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        // メンバーの取得
        let memberList = [];
        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId);
        if (status != ResultOK) {
            memberList = MyFuncs.getSplaJinroMemberList(DBUtils.createNewSplaJinroDataObj(channelId), ch, sender, false);
        }
        else {
            memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, false);
        }

        if (memberList.length == 0) {
            return MyFuncs.createErrorReply(splaJinroMessages.C09_MemberNotFound);
        }

        let teamA: string[] = [];
        let teamB: string[] = [];
        let other: string[] = [];

        // ランダムで一つ取り出す
        let members_work = memberList.concat(); // コピー
        const picMember = (): MyUser | undefined => {
            if (members_work.length <= 0) {
                return undefined;
            }
            // ランダムで一つ取り出す
            let i = Utils.getRandomInt(members_work.length - 1);
            const mem = members_work[i];
            // 取り出されたらフィルターで除く
            members_work = members_work.filter((v, idx) => idx != i).map(v => v);
            return mem;
        };

        const limitCountStr = cmd.getValue(0, 1);
        const limitCount = limitCountStr ? parseInt(limitCountStr) : TEAMBUILD_DEFAULT_NUM;

        const max = Math.min(limitCount, Math.ceil(memberList.length / 2));
        let mem = picMember();
        while (mem && teamA.length < max) {
            teamA.push(mem.name);
            mem = picMember();
        }
        while (mem && teamB.length < max) {
            teamB.push(mem.name)
            mem = picMember();
        }
        while (mem) {
            other.push(mem.name);
            mem = picMember();
        }

        // 埋め込みメッセージでチームを表示
        const embedA = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Aチーム！')
            .setDescription(teamA.length == 0 ? "メンバー無し" : teamA.join("\n"))
            .toJSON();

        const embedB = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('Bチーム！')
            .setDescription(teamB.length == 0 ? "メンバー無し" : teamB.join("\n"))
            .toJSON();

        let embeds: APIEmbed[] = [embedA, embedB];

        if (other.length > 0) {
            const embedOther = new EmbedBuilder()
                .setColor(Colors.Grey)
                .setTitle('観戦・休憩')
                .setDescription(other.join("\n"))
                .toJSON();
            embeds.push(embedOther);
        }

        return MyFuncs.createSuccessSendSameChannel({ content: "チームを作りました", embeds: embeds, },);
    }

    messageCopy = async (isDM: boolean, client: Client, ch: Channel, sender: MyUser, cmd: CommandParser, interaction?: Interaction): Promise<MyResult> => {
        if (isDM) {
            return MyFuncs.createErrorReply(coreMessages.C00_NotAllowFromDM,);
        }
        // 上記とかぶるが、型チェックしておきたいので
        if (ch.isDMBased()) {
            return MyFuncs.createErrorReply(coreMessages.C00_NotAllowFromDM,);
        }

        const selectedChannelId = cmd.getValue(0, 1)!;
        const targetChannel = await client.channels.fetch(selectedChannelId);
        if (!targetChannel) {
            return MyFuncs.createErrorReply("チャンネルがありません。",);
        }
        if (!targetChannel.isTextBased()) {
            return MyFuncs.createErrorReply("コピー先にはテキストチャンネルを指定してください。",);
        }
        if (!targetChannel.isTextBased()) {
            return MyFuncs.createErrorReply("コピー先にはテキストチャンネルを指定してください。",);
        }

        let isDatetimeRange = cmd.existsOption(eCommandOptions.datetimeRange);
        if (!isDatetimeRange) {
            // メッセージリンク指定による単体メッセージのコピー
            const messageLink = cmd.getValue(0, 2)!;
            const regex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;

            const match = messageLink.match(regex);
            if (!match) {
                return MyFuncs.createErrorReply("無効なリンクです。正しいメッセージリンクを入力してください。",);
            }
            const [, guildId, channelId, messageId] = match;
            if (ch.guildId != guildId) {
                return MyFuncs.createErrorReply("同じサーバー内のチャンネル間でのみコピーできます。",);
            }
            let msg: Message<boolean>;
            try {
                const channel = await client.channels.fetch(channelId);
                if (!channel?.isTextBased()) {
                    throw new Error("テキストチャンネルではないためメッセージは取得できない。")
                }
                msg = await channel!.messages.fetch(messageId);
            } catch (error) {
                return MyFuncs.createErrorReply("指定されたメッセージを取得できませんでした。",);
            }

            // 型チェックをしたいだけ
            if (msg.channel.isDMBased()) {
                return MyFuncs.createErrorReply("DMチャンネルからは参照できません。",);
            }

            // 添付ファイルの処理
            const attachments = msg.attachments.map(attachment => attachment.url);

            // メッセージを再投稿するコマンドリストを作成
            return MyFuncs.createSuccessSendOtherChannel(targetChannel, {
                embeds: [
                    {
                        author: {
                            name: msg.member?.displayName ?? msg.author.username,
                            icon_url: msg.author.displayAvatarURL(),
                        },
                        description: msg.content,
                        color: 0x00ff00, // 任意の色
                        timestamp: new Date(msg.createdTimestamp).toISOString(),
                        fields: [
                            {
                                name: '\u200B', // 空白文字
                                value: `[クリックして移動](https://discord.com/channels/${msg.guild!.id}/${msg.channel.id}/${msg.id})`,
                            }
                        ],
                        image: attachments.length > 0 ? { url: attachments[0] } : undefined, // 1つ目の添付ファイルを代表で画像として埋め込む
                    },
                ],
                flags: MessageFlags.SuppressNotifications, // 大変うるさそうなので非通知属性を付ける
            },);
        }

        // 日付範囲指定による複数メッセージのコピー

        if (!interaction) {
            return MyFuncs.createErrorReply("スラッシュコマンド専用コマンドです。",);
        }

        const errorRes: MyResult = {
            status: MyError,
            sendList: []
        }

        // const res = await DateRangeModal.show(interaction);
        // if (!res) {
        //     return errorRes;
        // }

        const [from_ymd, from_hm, to_ymd, to_hm] = [
            cmd.getValue(0, 2)!,
            cmd.getValue(0, 3)!,
            cmd.getValue(0, 4)!,
            cmd.getValue(0, 5)!,
        ];

        const from = new Date(`${from_ymd}T${from_hm}:00+09:00`);
        const to = new Date(`${to_ymd}T${to_hm}:00+09:00`);

        function isValidDate(date: Date) {
            return !isNaN(date.getTime());
        }
        if (!isValidDate(from)) {
            return MyFuncs.createErrorReply("有効な開始日を入力してください。",);
        }
        if (!isValidDate(to)) {
            return MyFuncs.createErrorReply("有効な終了日を入力してください。",);
        }

        if (!ch.isTextBased()) {
            // コマンドが打たれている以上はありえないケースではある。
            return MyFuncs.createErrorReply("テキストチャンネルで実行してください。",);
        }

        // メッセージの取得上限が100件、また、並び順が最新からになるため以下の手順で保存する。
        // メッセージを取得⇒DBに保存を繰り返す⇒
        // DBから並び替えを行って100件ずつ取得⇒同じ人のメッセージはグループ化⇒制限に引っかからないペースで登録
        const uuid = uuidv4();
        // 以下 tyr-catch での成果物（送信メッセージリスト）
        const sendlist: SendListItem[] = [];
        try {
            // メッセージを取得⇒DBに保存を繰り返す
            {
                const from_t = from.getTime();
                const to_t = to.getTime();
                let messages: Collection<string, Message<true>> = await ch.messages.fetch({ limit: 100 });
                const needLoop = () => (messages.size == 0 || messages.some(msg => (from_t <= msg.createdTimestamp)));
                while (needLoop()) {
                    const filteredMessages = messages.filter(msg => (from_t <= msg.createdTimestamp && msg.createdTimestamp <= to_t));
                    const records = filteredMessages.map((msg) => {
                        // 添付ファイルの処理
                        const attachments = msg.attachments.map(attachment => attachment.url);
                        // DBのレコードに保存
                        const record: WorkData = {
                            process_uuid: uuid,
                            sorter: new Date(msg.createdTimestamp).getTime(),
                            data: {
                                author: {
                                    name: msg.member?.displayName ?? msg.author.displayName ?? msg.author.username,
                                    icon_url: msg.author.displayAvatarURL(),
                                },
                                description: msg.content,
                                timestamp: new Date(msg.createdTimestamp).toISOString(),
                                fields: [
                                    {
                                        name: '\u200B', // 空白文字
                                        value: `[クリックして移動](https://discord.com/channels/${msg.guild!.id}/${msg.channel.id}/${msg.id})`,
                                    }
                                ],
                                image: attachments.length > 0 ? { url: attachments[0] } : undefined, // 1つ目の添付ファイルを代表で画像として埋め込む
                            }
                        };
                        return record;
                    });
                    if (records.length > 0) {
                        await this._dbAccesser?.asyncInsertWorkData(records);
                    }
                    messages = await ch.messages.fetch({ before: messages.lastKey(), limit: 100 });
                }
            }
            // DBから並び替えを行って取得⇒同じ人のメッセージはグループ化⇒制限に引っかからないように100件ペースで登録
            let groupBy: WorkData[] = [];
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            const asyncPushAndGroupByResetAndSleep = async () => {
                sendlist.push(MyFuncs.createSendOtherChannel(targetChannel, {
                    embeds: [
                        {
                            author: groupBy[0].data.author,
                            // 同じ人のメッセージはグループ化
                            description: groupBy.map(v=>v.data.description).join("\r\n"),
                            timestamp: groupBy[0].data.timestamp,
                            fields: groupBy[0].data.fields,
                            image: groupBy.slice(-1)[0].data.image,
                        },
                    ],
                    flags: MessageFlags.SuppressNotifications, // 大変うるさそうなので非通知属性を付ける
                    addAction: async () => { delay(20); return; } // リクエスト過多にならないよう考慮
                },));
                groupBy = [];
            }
            await this._dbAccesser?.asyncSelectWorkDataForEach(uuid, true, async (record) => {
                if (groupBy.length > 0 && groupBy[0].data.author.icon_url !== record.data.author.icon_url) {
                    // 投稿者が変わるなら登録して、グループ集計を解放
                    await asyncPushAndGroupByResetAndSleep();
                    groupBy.push(record);
                    return;
                }
                if (groupBy.length > 0 && groupBy.slice(-1)[0].data.image != null) {
                    // 投稿者が同じでも画像が投稿されているならそこまでで登録して、グループ集計を解放
                    await asyncPushAndGroupByResetAndSleep();
                    groupBy.push(record);
                    return;
                }
                if(groupBy.length > 0 && groupBy.length > 100) {
                    // リクエストのサイズが大きくなるのでいったん登録。グループが途切れるのはやむなしとする
                    groupBy.push(record);
                    await asyncPushAndGroupByResetAndSleep();
                    return;
                }
                if(groupBy.length > 0) {
                    // icon_url == icon_url && groupBy.length <= 100
                    groupBy.push(record);
                    return;
                }
                // groupBy.length == 0
                groupBy.push(record);
            });
            // 最後にグループ集計が残っている場合を考慮
            if (groupBy.length > 0) {
                await asyncPushAndGroupByResetAndSleep();
            }
        }
        finally {
            // 作業用DBの削除漏れが無いようにする
            await this._dbAccesser?.asyncDeleteWorkData(uuid);
        }

        return {
            status: MySuccess,
            sendList: sendlist,
        }
    }

    /* コンテキストメニューの実装 */
    processContextMenuCommand = async (cmd: eContextMenuCommands, interaction: Interaction): Promise<MyResult> => {
        switch (cmd) {
            case eContextMenuCommands.MessageDelete:
                return await this.messageDelete_ctxmn(interaction);
            default:
                return {
                    status: MySuccess,
                    sendList: [],
                };
        }
    }

    messageDelete_ctxmn = async (interaction: Interaction): Promise<MyResult> => {
        if (!interaction.isMessageContextMenuCommand()) {
            return {
                status: MyError,
                sendList: [],
            };
        }
        const targetMessage = interaction.targetMessage;

        // ボットが送信したメッセージかどうかを確認
        if (!targetMessage.author.bot) {
            return MyFuncs.createErrorReply("MODが作成したメッセージではないため削除できません。",);
        }

        // 確認方式が微妙だったのでコメントアウト
        // const yes = await DeleteConfirmModal.show(interaction);
        // if (yes) {
        //     await targetMessage.delete();
        // }
        await targetMessage.delete();

        return {
            status: MySuccess,
            sendList: [],
        };
    }


    /* 他Util */

    static Log = (msg: Message): void => {
        const isDM = DiscordUtils.isDM(msg.channel) ? "DM" : "not DM";
        console.log("Recept! msg:%s, sender:%s, DM?:%s", msg.content, msg.author.displayName, isDM)
    }

}

/**
 * 当処理の頻出箇所まとめ
 */
class MyFuncs {
    //#region  専用リザルト関連
    private static updateMessageContent(msg: AppMessage | MessageContent, ...args: unknown[]) {
        if (typeof msg === "string")
            msg = Utils.format(msg, ...args);
        else if (msg.content)
            msg.content = Utils.format(msg.content, ...args);
        return msg;
    }

    static createReply = (msg: AppMessage | MessageContent, ...args: unknown[]): SendListItem => {
        return {
            type: eSendType.sendReply,
            user: { id: "", name: "" },
            sendMessage: MyFuncs.updateMessageContent(msg, ...args),
        };
    }

    static createReplyDM = (msg: AppMessage | MessageContent, ...args: unknown[]): SendListItem => {
        return {
            type: eSendType.sendReplyByDM,
            user: { id: "", name: "" },
            sendMessage: MyFuncs.updateMessageContent(msg, ...args),
        };
    }

    static createDMToOtherUser = (user: MyUser, msg: AppMessage | MessageContent, ...args: unknown[]): SendListItem => {
        return {
            type: eSendType.sendDMByUserId,
            user: user,
            sendMessage: MyFuncs.updateMessageContent(msg, ...args),
        };
    }

    static createSendSameChannel = (msg: AppMessage | MessageContent, ...args: unknown[]): SendListItem => {
        return {
            type: eSendType.sendSameChannel,
            user: { id: "", name: "" },
            sendMessage: MyFuncs.updateMessageContent(msg, ...args),
        };
    }

    static createSendOtherChannel = (ch: TextBasedChannel, msg: AppMessage | MessageContent, ...args: unknown[]): SendListItem => {
        return {
            type: eSendType.sendOtherChannel,
            user: { id: "", name: "" },
            sendMessage: MyFuncs.updateMessageContent(msg, ...args),
            targetChannel: ch,
        };
    }

    static createErrorReply = (msg: AppMessage | MessageContent, ...args: unknown[]): MyResult => {
        return {
            status: MyError,
            sendList: [MyFuncs.createReply(formatError(msg, ...args))],
        }
    }
    static createSuccessReply = (msg: AppMessage | MessageContent, ...args: unknown[]): MyResult => {
        return {
            status: MySuccess,
            sendList: [MyFuncs.createReply(msg, ...args)],
        }
    }
    static createSuccessSendSameChannel = (msg: AppMessage | MessageContent, ...args: unknown[]): MyResult => {
        return {
            status: MySuccess,
            sendList: [MyFuncs.createSendSameChannel(msg, ...args)],
        }
    }
    static createSuccessSendOtherChannel = (ch: TextBasedChannel, msg: AppMessage | MessageContent, ...args: unknown[]): MyResult => {
        return {
            status: MySuccess,
            sendList: [MyFuncs.createSendOtherChannel(ch, msg, ...args)],
        }
    }
    //#endregion

    /**
     * 参加者取得
     * @param data 
     * @param ch 
     * @param gm
     * @param ignoreGm
     * @returns 
     */
    static getSplaJinroMemberList(data: SplaJinroData, ch: Channel, gm: MyUser, ignoreGm: boolean): MyUser[] {
        let members: MyUser[] = [];
        if (ch.isVoiceBased()) {
            ch.members.forEach(m => members.push({ id: m.id, name: m.displayName }));
        }
        data.add_member_list.forEach(adm => members.push(adm));
        members = Utils.unique(members, v => v.id);
        data.ignore_member_list.forEach(igm => {
            members = members.filter(m => m.id != igm.id);
        });
        // コマンド送信者がロールを確認している場合は、GMとみなすため、参加者からは省く
        if (ignoreGm) {
            members = members.filter(m => m.id != gm.id);
        }
        return members;
    }

    /**
     * sendRole オプション文字列パース
     */
    static parseSendRoleOption(optionStr: string): SendMemberRoleOption[] {
        let sendRoleOptionList: SendMemberRoleOption[] = [];

        // オプションか判定
        const optionStrList = optionStr.replace(SPACE_REGXg, "\n").split("\n");
        for (const optStr of optionStrList) {
            // 知られるオプションか判定
            {
                const sepalate = Utils.format(splaJinroMessages.C03_inner_0_know_to_1, "", "");
                const optArray = optStr.split(sepalate);
                if (optArray.length == 2) {
                    sendRoleOptionList.push({
                        targetRole: optArray[0],
                        action: "canknow",
                        complement: optArray[1],
                    });
                    continue;
                }
            }

            // …ほか追加あれば
        }

        return sendRoleOptionList;
    }

}
