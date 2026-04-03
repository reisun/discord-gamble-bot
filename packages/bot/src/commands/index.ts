import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import * as bet from './bet';
import * as mybet from './mybet';
import * as mybets from './mybets';
import * as adminLink from './admin-link';
import * as postGame from './post-game';
import * as link from './link';

export type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};

export const commands: Map<string, Command> = new Map([
  ['bet', bet],
  ['mybet', mybet],
  ['mybets', mybets],
  ['admin-link', adminLink],
  ['post-game', postGame],
  ['link', link],
]);
