-- Etapa 1a: contas e sessões

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username            text NOT NULL CHECK (username ~ '^[A-Za-z0-9_.]{3,32}$'),
  display_name        text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 32),
  email               text NOT NULL CHECK (char_length(email) <= 254),
  password_hash       text NOT NULL,
  birth_date          date NOT NULL,
  email_verified      boolean NOT NULL DEFAULT false,
  avatar_url          text,
  bio                 text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 190),
  status              text NOT NULL DEFAULT 'online'
                      CHECK (status IN ('online', 'away', 'dnd', 'invisible')),
  failed_login_count  integer NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Unicidade sem diferenciar maiúsculas e minúsculas
CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));
CREATE UNIQUE INDEX users_email_idx ON users (email);

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);
