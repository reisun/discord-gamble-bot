import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // events（イベント）
  pgm.createTable('events', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'varchar(100)', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: false },
    initial_points: { type: 'integer', notNull: true, default: 10000 },
    results_public: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // games（ゲーム）
  pgm.createTable('games', {
    id: { type: 'serial', primaryKey: true },
    event_id: { type: 'integer', notNull: true, references: 'events(id)', onDelete: 'CASCADE' },
    title: { type: 'varchar(100)', notNull: true },
    description: { type: 'text' },
    deadline: { type: 'timestamptz', notNull: true },
    is_published: { type: 'boolean', notNull: true, default: false },
    status: { type: 'varchar(20)', notNull: true, default: 'open' },
    bet_type: { type: 'varchar(30)', notNull: true, default: 'single' },
    required_selections: { type: 'integer' },
    result_symbols: { type: 'varchar(100)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('games', 'chk_games_status', "status IN ('open', 'closed', 'finished')");
  pgm.addConstraint(
    'games',
    'chk_games_bet_type',
    "bet_type IN ('single', 'multi_unordered', 'multi_ordered', 'multi_ordered_dup')",
  );
  pgm.addConstraint(
    'games',
    'chk_games_selections',
    "(bet_type = 'single' AND required_selections IS NULL) OR (bet_type != 'single' AND required_selections >= 2)",
  );
  pgm.createIndex('games', 'event_id', { name: 'idx_games_event_id' });

  // bet_options（賭け項目）
  pgm.createTable('bet_options', {
    id: { type: 'serial', primaryKey: true },
    game_id: { type: 'integer', notNull: true, references: 'games(id)', onDelete: 'CASCADE' },
    symbol: { type: 'varchar(5)', notNull: true },
    label: { type: 'varchar(50)', notNull: true },
    order: { type: 'integer', notNull: true, default: 1 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('bet_options', 'uq_bet_options_symbol', { unique: ['game_id', 'symbol'] });
  pgm.createIndex('bet_options', 'game_id', { name: 'idx_bet_options_game_id' });

  // users（ユーザー）
  pgm.createTable('users', {
    id: { type: 'serial', primaryKey: true },
    discord_id: { type: 'varchar(30)', notNull: true, unique: true },
    discord_name: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // bets（賭け）
  pgm.createTable('bets', {
    id: { type: 'serial', primaryKey: true },
    user_id: { type: 'integer', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    game_id: { type: 'integer', notNull: true, references: 'games(id)', onDelete: 'CASCADE' },
    selected_symbols: { type: 'varchar(100)', notNull: true },
    amount: { type: 'integer', notNull: true },
    is_debt: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('bets', 'uq_bets_user_game', { unique: ['user_id', 'game_id'] });
  pgm.addConstraint('bets', 'chk_bets_amount', 'amount > 0');
  pgm.createIndex('bets', 'game_id', { name: 'idx_bets_game_id' });

  // point_history（ポイント履歴）
  pgm.createTable('point_history', {
    id: { type: 'serial', primaryKey: true },
    user_id: { type: 'integer', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    event_id: { type: 'integer', notNull: true, references: 'events(id)', onDelete: 'CASCADE' },
    game_id: {
      type: 'integer',
      references: 'games(id)',
      onDelete: 'SET NULL',
    },
    change_amount: { type: 'integer', notNull: true },
    reason: { type: 'varchar(50)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('point_history', ['user_id', 'event_id'], {
    name: 'idx_point_history_user_event',
  });
  pgm.createIndex('point_history', 'game_id', { name: 'idx_point_history_game_id' });

  // debt_history（借金履歴）
  pgm.createTable('debt_history', {
    id: { type: 'serial', primaryKey: true },
    user_id: { type: 'integer', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    event_id: { type: 'integer', notNull: true, references: 'events(id)', onDelete: 'CASCADE' },
    game_id: {
      type: 'integer',
      references: 'games(id)',
      onDelete: 'SET NULL',
    },
    change_amount: { type: 'integer', notNull: true },
    reason: { type: 'varchar(50)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('debt_history', ['user_id', 'event_id'], {
    name: 'idx_debt_history_user_event',
  });
  pgm.createIndex('debt_history', 'game_id', { name: 'idx_debt_history_game_id' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('debt_history');
  pgm.dropTable('point_history');
  pgm.dropTable('bets');
  pgm.dropTable('users');
  pgm.dropTable('bet_options');
  pgm.dropTable('games');
  pgm.dropTable('events');
}
