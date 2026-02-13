import config from "./config";
import {
    Client, Events, GatewayIntentBits, Partials,
    // ↓ discord WebAPI
    REST, Routes,
} from 'discord.js';
import "./DiscordExtentions";
import { Controller } from "./Control";
import { COMMAND_JSONBODYS } from "./Commands";
import { CONTEXTMENU_JSONBODYS } from "./ContextMenuCommands";

console.log('import finished!');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
    ],
    // BotへのDMを受信するには以下が必要みたい
    // thanks!
    // https://stackoverflow.com/questions/68700270/event-messagecreate-not-firing-emitting-when-i-send-a-dm-to-my-bot-discord-js-v
    partials: [Partials.Channel],
});
// 
client.processingTaskCount = 0;

const rest = new REST({
    version: '10'
});

const controller = new Controller();

const asyncAddCommand = async (servId: string) => {
    const guild = client.guilds.cache.get(servId);
    if (!guild){
        // 参加していないサーバー
        return;
    }
    await rest.put(
        Routes.applicationGuildCommands(client.application!.id, servId),
        { body: (<any>COMMAND_JSONBODYS).concat((<any>CONTEXTMENU_JSONBODYS)) },
    );
}
const asyncRemoveCommand = async (servId: string) => {
    const guild = client.guilds.cache.get(servId);
    if (!guild){
        // 参加していないサーバー
        return;
    }
    await rest.put(
        Routes.applicationGuildCommands(client.application!.id, servId),
        { body: [] }, // 空配列を送信して登録コマンドをリセット
    );
}

const asyncUpdateCommand = async (servId: string) => {
    // 古いコマンドかもしれないので、同じAppIDのコマンドは削除
    await asyncRemoveCommand(servId);
    // コマンド追加
    await asyncAddCommand(servId);
}

client.once('ready', async () => {
    console.log('discord connected!');

    // スラッシュコマンド情報を更新
    // TODO version の値で更新するかチェックしたい
    // TODO appliation commands 内の create でコマンド追加もできるのでは？
    try {
        // 認可サーバーごとにループ
        for (const servId of config.allowedServers) {
            await asyncUpdateCommand(servId);
        }
        console.log('slash command refresh success!');
    } catch (error) {
        console.error('slash command refresh failed... :', error);
    }

    // ---アプリ初期処理
    await controller.asyncSetup();
});

client.on(Events.GuildCreate, guild => {
    asyncAddCommand(guild.id);
});

client.on(Events.GuildDelete, guild => {
    // これって効くのか？
    asyncRemoveCommand(guild.id);
});

// メッセージ受信時
client.on(Events.MessageCreate, async message => {
    if (!controller.initialized) {
        return;
    }
    try {
        client.processingTaskCount ++;
        await controller.processFromMessage(client, message);
    }
    catch (e) {
        console.log(e);
    }
    finally {
        client.processingTaskCount --;
    }
});

//スラッシュコマンド
client.on(Events.InteractionCreate, async interaction => {
    if (!controller.initialized) {
        return;
    }
    try {
        client.processingTaskCount ++;
        if (!interaction.isModalSubmit()) {
            await controller.processFromInteraction(client, interaction);
        }
        else {
            //await controller.processFromModalSubmit(client, interaction);
        }
    }
    catch (e) {
        console.log(e);
    }
    finally {
        client.processingTaskCount --;
    }
});

// リアクション
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (!controller.initialized) {
        return;
    }
    try {
        await controller.processFromReaction(client, reaction, user);
    }
    catch (e) {
        console.log(e);
    }
});

client.login(config.discordToken);
rest.setToken(config.discordToken);