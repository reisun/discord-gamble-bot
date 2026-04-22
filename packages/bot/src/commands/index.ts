import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import * as bet from './bet';
import * as mybets from './mybets';
import * as dashboard from './dashboard';
import * as postGame from './post-game';
import * as setAdminRole from './set-admin-role';

export type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};

export const commands: Map<string, Command> = new Map<string, Command>([
  ['bet', bet],
  ['mybets', mybets],
  ['dashboard', dashboard],
  ['post-game', postGame],
  ['set-admin-role', setAdminRole],
]);
