export type User = {
  id: string,
  name: string
}

// メンバー情報
export type MemberRoleInfo = {
  id: string,
  name: string,
  alphabet: string,
  theName: string,
  role: string,
};

// オプション情報
export type MemberRoleOptionCanKnow = {
  targetRole: string,
  action: "canknow",
  complement: string,
}
export type SendMemberRoleOption = MemberRoleOptionCanKnow /* | その他の型 */;

export type WorkData = {
  process_uuid: string,
  sorter: number,
  data: any,
}
