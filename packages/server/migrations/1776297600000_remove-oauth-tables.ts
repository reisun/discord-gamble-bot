import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('sessions', { ifExists: true });
  pgm.dropColumn('access_tokens', 'discord_id', { ifExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
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
  pgm.addColumn('access_tokens', {
    discord_id: { type: 'text' },
  });
}
