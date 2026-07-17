-- Crée la table module_files pour stocker plusieurs fichiers par module
CREATE TABLE IF NOT EXISTS module_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation de la sécurité RLS
ALTER TABLE module_files ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (RLS)
CREATE POLICY "Anyone can view module files" 
    ON module_files 
    FOR SELECT 
    USING (true);

CREATE POLICY "Admins have full access to module files" 
    ON module_files 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
