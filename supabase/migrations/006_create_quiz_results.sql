CREATE TABLE IF NOT EXISTS quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT,
    last_name TEXT,
    whatsapp_country TEXT,
    whatsapp_number TEXT,
    email TEXT,
    score_percentage NUMERIC NOT NULL,
    duration_sec INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (public endpoint)
CREATE POLICY "Allow public insert on quiz_results"
    ON quiz_results FOR INSERT
    WITH CHECK (true);

-- Allow admins to read everything
CREATE POLICY "Allow admin read on quiz_results"
    ON quiz_results FOR SELECT
    USING (auth.jwt() ->> 'email' = 'association.astral@gmail.com');

-- Allow admins to delete
CREATE POLICY "Allow admin delete on quiz_results"
    ON quiz_results FOR DELETE
    USING (auth.jwt() ->> 'email' = 'association.astral@gmail.com');
