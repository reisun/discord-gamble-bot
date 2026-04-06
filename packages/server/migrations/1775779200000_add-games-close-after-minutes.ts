import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('games', {
    close_after_minutes: { type: 'integer', notNull: true, default: 10 },
  });
  pgm.addConstraint('games', 'chk_games_close_after_minutes', 'CHECK (close_after_minutes >= 1)');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('games', 'chk_games_close_after_minutes');
  pgm.dropColumn('games', 'close_after_minutes');
}
