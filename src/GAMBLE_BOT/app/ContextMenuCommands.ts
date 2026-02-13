import {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    RESTPostAPIContextMenuApplicationCommandsJSONBody
} from "discord.js";

export const eContextMenuCommands = {
    MessageDelete: "bot_message_delete",
} as const;
export type eContextMenuCommands = (typeof eContextMenuCommands)[keyof typeof eContextMenuCommands];
export const isMyContextMenuCommand = (v: any): v is eContextMenuCommands => Object.values(eContextMenuCommands).some(elm => elm === v);

export const CONTEXTMENU_JSONBODYS: RESTPostAPIContextMenuApplicationCommandsJSONBody[] = [
    new ContextMenuCommandBuilder()
        .setName(eContextMenuCommands.MessageDelete)
        .setNameLocalization("ja", "BOTのメッセージ削除")
        .setType(ApplicationCommandType.Message.valueOf())
        .toJSON(),
]