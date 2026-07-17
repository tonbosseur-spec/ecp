-- Table pour stocker les quizz associés aux modules
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE UNIQUE,
    title TEXT NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Question structure: { text: string, options: string[], correct_index: number }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation de la sécurité RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité
CREATE POLICY "Quizzes are viewable by everyone" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Admins have full access to quizzes" ON quizzes FOR ALL TO authenticated USING (true) WITH CHECK (true);
