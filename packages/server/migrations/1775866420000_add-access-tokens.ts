import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // 旧スキーマ（used_at カラムを持つ古い access_tokens）が存在する場合は削除して再作成
  pgm.dropTable('access_tokens', { ifExists: true, cascade: true });

  pgm.createTable('access_tokens', {
    id: { type: 'serial', primaryKey: true },
    token_hash: { type: 'text', notNull: true, unique: true },
    guild_id: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('access_tokens', 'chk_access_tokens_role', "CHECK (role IN ('editor', 'viewer'))");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('access_tokens');
}
