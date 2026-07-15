-- 1. Table trainers (Formateurs)
CREATE TABLE trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    photo_url TEXT
);

-- 2. Table courses (Formations)
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    initials TEXT,
    description TEXT,
    price_fcfa INTEGER NOT NULL,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    whatsapp_link TEXT,
    google_meet_link TEXT,
    guide_url TEXT,
    guide_text TEXT,
    youtube_video_url TEXT,
    cover_image_url TEXT,
    max_seats INTEGER,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table course_modules (Modules de la formation)
CREATE TABLE course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0
);

-- 4. Table registrations (Inscriptions)
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
    participant_name TEXT NOT NULL,
    participant_email TEXT NOT NULL,
    participant_phone TEXT NOT NULL,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Politiques de sécurité (RLS - Row Level Security)
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Accès en lecture public pour la page web
CREATE POLICY "Public profiles are viewable by everyone" ON trainers FOR SELECT USING (true);
CREATE POLICY "Courses are viewable by everyone" ON courses FOR SELECT USING (true);
CREATE POLICY "Course modules are viewable by everyone" ON course_modules FOR SELECT USING (true);

-- Tout le monde peut insérer une nouvelle ligne dans registrations (anonyme ou connecté avec son client_id)
CREATE POLICY "Anyone can register for a course" ON registrations FOR INSERT WITH CHECK (client_id = auth.uid() OR client_id IS NULL);

-- Un client authentifié peut lire uniquement ses propres inscriptions
CREATE POLICY "Clients can view their own registrations" ON registrations FOR SELECT TO authenticated USING (client_id = auth.uid());

-- Administrateurs (utilisateurs authentifiés) : Tous les privilèges
CREATE POLICY "Admins can manage trainers" ON trainers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage courses" ON courses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage course modules" ON course_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage registrations" ON registrations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Table templates (Modèles visuels)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    primary_color TEXT NOT NULL,
    bg_pattern TEXT NOT NULL,
    layout_style TEXT NOT NULL
);

-- Insertion des 4 Templates Pastel
INSERT INTO templates (name, primary_color, bg_pattern, layout_style) VALUES
('Bleu Sérénité', '#93C5FD', 'bg-slate-50', 'centered-classic'),
('Vert Menthe', '#86EFAC', 'pattern-dots', 'sidebar-left'),
('Pêche Dynamique', '#FDBA74', 'pattern-waves', 'bold-asymmetric'),
('Lavande Premium', '#D8B4FE', 'bg-purple-50', 'split-screen');

-- Ajout de la colonne template_id à la table courses
ALTER TABLE courses ADD COLUMN template_id UUID REFERENCES templates(id) ON DELETE SET NULL;

-- RLS pour la table templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates are viewable by everyone" ON templates FOR SELECT USING (true);
CREATE POLICY "Admins can manage templates" ON templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Table testimonials (Témoignages)
CREATE TABLE testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    comment TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5) DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS pour la table testimonials
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Testimonials are viewable by everyone" ON testimonials FOR SELECT USING (true);
CREATE POLICY "Anyone can add a testimonial" ON testimonials FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage testimonials" ON testimonials FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Table client_profiles (Profils clients)
CREATE TABLE client_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS pour la table client_profiles
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- Un client peut lire et modifier sa propre ligne
CREATE POLICY "Clients can view their own profile" ON client_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Clients can update their own profile" ON client_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- L'administrateur peut lire toutes les lignes (Ici, tous les utilisateurs authentifiés car ils agissent comme admin dans le reste du système)
CREATE POLICY "Admins can view all profiles" ON client_profiles FOR SELECT TO authenticated USING (true);

-- 9. Trigger pour création de profil automatique
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.client_profiles (id, first_name, last_name, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Déclencheur sur la table auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
