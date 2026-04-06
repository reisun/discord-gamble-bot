import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('access_tokens', {
    id: { type: 'serial', primaryKey: true },
    token_hash: { type: 'text', notNull: true, unique: true },
    guild_id: { type: 'varchar(30)', notNull: true },
    role: { type: 'varchar(10)', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('access_tokens', 'guild_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('access_tokens');
}
