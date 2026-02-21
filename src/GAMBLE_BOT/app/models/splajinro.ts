import { User } from './common';

export type SplaJinroDataVersion = 2;
export const SplaJinroDataVersion = 2;

export type SplaJinroData = {
  channel_id: string,
  add_member_list: User[],
  ignore_member_list: User[],
  prev_suggest_role_command_string: string,
  prev_send_role_command_string: string,
  eject_member_list: User[],
  send_role_option: string,
  last_update_datatime: Date,
  version: SplaJinroDataVersion,
}
