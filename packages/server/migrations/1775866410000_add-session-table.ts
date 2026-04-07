import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('session', {
    sid: { type: 'varchar', primaryKey: true },
    sess: { type: 'jsonb', notNull: true },
    expire: { type: 'timestamp without time zone', notNull: true },
  });

  pgm.createIndex('session', 'expire', { name: 'IDX_session_expire' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('session');
}
