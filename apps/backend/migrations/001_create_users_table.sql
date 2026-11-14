-- Creating ENUM type for roles due to packages/shared/src/roles.ts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('student', 'lecturer', 'admin');
    END IF;
END
$$;

-- Creation table Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login VARCHAR(64) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique B-Tree index for login (faster search during login and ON CONFLICT work)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON users (login);