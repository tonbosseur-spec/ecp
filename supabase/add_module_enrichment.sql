-- 1. Ajout des colonnes d'enrichissement à la table course_modules
ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS long_summary TEXT;
ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS download_files JSONB DEFAULT '[]'::jsonb;

-- 2. Création de la table module_progress pour le suivi de la progression des élèves
CREATE TABLE IF NOT EXISTS module_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (client_id, module_id)
);

-- Activation de RLS pour module_progress
ALTER TABLE module_progress ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour module_progress
CREATE POLICY "Clients can view their own progress" 
    ON module_progress 
    FOR SELECT 
    TO authenticated 
    USING (client_id = auth.uid());

CREATE POLICY "Clients can insert their own progress" 
    ON module_progress 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can delete their own progress" 
    ON module_progress 
    FOR DELETE 
    TO authenticated 
    USING (client_id = auth.uid());

-- Règle d'accès complète pour l'administrateur
CREATE POLICY "Admins have full access to progress" 
    ON module_progress 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 3. Création de la table module_files pour stocker les fichiers de chaque module
CREATE TABLE IF NOT EXISTS module_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation de RLS pour module_files
ALTER TABLE module_files ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour module_files
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

