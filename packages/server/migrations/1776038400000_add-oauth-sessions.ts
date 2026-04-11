import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('sessions', {
    id: { type: 'serial', primaryKey: true },
    session_token: { type: 'text', notNull: true, unique: true },
    discord_user_id: { type: 'text', notNull: true },
    discord_username: { type: 'text' },
    guild_id: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('sessions', 'chk_sessions_role', "CHECK (role IN ('editor', 'viewer'))");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('sessions');
}
