CREATE TABLE IF NOT EXISTS quiz_challenge_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quiz_challenge_leads ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (public endpoint)
CREATE POLICY "Allow public insert on quiz_challenge_leads"
    ON quiz_challenge_leads FOR INSERT
    WITH CHECK (true);

-- Allow admins to read everything
CREATE POLICY "Allow admin read on quiz_challenge_leads"
    ON quiz_challenge_leads FOR SELECT
    USING (auth.jwt() ->> 'email' = 'association.astral@gmail.com');

-- Allow admins to delete
CREATE POLICY "Allow admin delete on quiz_challenge_leads"
    ON quiz_challenge_leads FOR DELETE
    USING (auth.jwt() ->> 'email' = 'association.astral@gmail.com');
