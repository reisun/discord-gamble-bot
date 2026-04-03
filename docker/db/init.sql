-- ============================================================
-- Discord Gamble Bot - 初期テーブル定義
-- ============================================================

-- events（イベント）
CREATE TABLE events (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100)  NOT NULL,
    is_active        BOOLEAN       NOT NULL DEFAULT FALSE,
    initial_points   INTEGER       NOT NULL DEFAULT 10000,
    results_public   BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- games（ゲーム）
CREATE TABLE games (
    id                   SERIAL PRIMARY KEY,
    event_id             INTEGER       NOT NULL,
    title                VARCHAR(100)  NOT NULL,
    description          TEXT,
    deadline             TIMESTAMPTZ   NOT NULL,
    is_published         BOOLEAN       NOT NULL DEFAULT FALSE,
    status               VARCHAR(20)   NOT NULL DEFAULT 'open',
    bet_type             VARCHAR(30)   NOT NULL DEFAULT 'single',
    required_selections  INTEGER,
    result_symbols       VARCHAR(100),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_games_event    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT chk_games_status  CHECK (status IN ('open', 'closed', 'finished')),
    CONSTRAINT chk_games_bet_type CHECK (bet_type IN ('single', 'multi_unordered', 'multi_ordered', 'multi_ordered_dup')),
    CONSTRAINT chk_games_selections CHECK (
        (bet_type = 'single' AND required_selections IS NULL)
        OR (bet_type != 'single' AND required_selections >= 2)
    )
);

CREATE INDEX idx_games_event_id ON games(event_id);

-- bet_options（賭け項目）
CREATE TABLE bet_options (
    id         SERIAL PRIMARY KEY,
    game_id    INTEGER      NOT NULL,
    symbol     VARCHAR(5)   NOT NULL,
    label      VARCHAR(50)  NOT NULL,
    "order"    INTEGER      NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_bet_options_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT uq_bet_options_symbol UNIQUE (game_id, symbol)
);

CREATE INDEX idx_bet_options_game_id ON bet_options(game_id);

-- users（ユーザー）
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    discord_id    VARCHAR(30)   NOT NULL UNIQUE,
    discord_name  VARCHAR(100)  NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- bets（賭け）
CREATE TABLE bets (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER       NOT NULL,
    game_id          INTEGER       NOT NULL,
    selected_symbols VARCHAR(100)  NOT NULL,
    amount           INTEGER       NOT NULL,
    is_debt          BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_bets_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_bets_game    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT uq_bets_user_game UNIQUE (user_id, game_id),
    CONSTRAINT chk_bets_amount CHECK (amount > 0)
);

CREATE INDEX idx_bets_game_id ON bets(game_id);

-- point_history（ポイント履歴）
CREATE TABLE point_history (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER      NOT NULL,
    event_id       INTEGER      NOT NULL,
    game_id        INTEGER,
    change_amount  INTEGER      NOT NULL,
    reason         VARCHAR(50)  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_point_history_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_point_history_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_point_history_game  FOREIGN KEY (game_id)  REFERENCES games(id)  ON DELETE SET NULL
);

CREATE INDEX idx_point_history_user_event ON point_history(user_id, event_id);
CREATE INDEX idx_point_history_game_id    ON point_history(game_id);

-- debt_history（借金履歴）
CREATE TABLE debt_history (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER      NOT NULL,
    event_id       INTEGER      NOT NULL,
    game_id        INTEGER,
    change_amount  INTEGER      NOT NULL,
    reason         VARCHAR(50)  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_debt_history_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_debt_history_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_debt_history_game  FOREIGN KEY (game_id)  REFERENCES games(id)  ON DELETE SET NULL
);

CREATE INDEX idx_debt_history_user_event ON debt_history(user_id, event_id);
CREATE INDEX idx_debt_history_game_id    ON debt_history(game_id);
