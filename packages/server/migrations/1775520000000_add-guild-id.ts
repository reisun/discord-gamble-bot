import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // guilds（ギルド情報）テーブルを追加
  pgm.createTable('guilds', {
    guild_id: { type: 'varchar(30)', primaryKey: true },
    guild_name: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // events に guild_id カラムを追加（既存行は '0' をデフォルト値として設定）
  pgm.addColumn('events', {
    guild_id: { type: 'varchar(30)', notNull: true, default: '0' },
  });

  pgm.createIndex('events', 'guild_id', { name: 'idx_events_guild_id' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('events', 'guild_id', { name: 'idx_events_guild_id' });
  pgm.dropColumn('events', 'guild_id');
  pgm.dropTable('guilds');
}
