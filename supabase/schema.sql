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
    date_time TIMESTAMP WITH TIME ZONE,
    is_date_tbd BOOLEAN DEFAULT false,
    whatsapp_link TEXT,
    google_meet_link TEXT,
    guide_url TEXT,
    guide_text TEXT,
    youtube_video_url TEXT,
    cover_image_url TEXT,
    product_type TEXT DEFAULT 'formation',
    download_file_url TEXT,
    max_seats INTEGER,
    is_active BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
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
    payment_status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Politiques de sécurité (RLS - Row Level Security)

-- Fonction d'aide réutilisable pour identifier l'administrateur unique
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.jwt() ->> 'email' = 'pmbom@ecp.cm';
$$;

ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Accès en lecture public pour la page web
CREATE POLICY "Public profiles are viewable by everyone" ON trainers FOR SELECT USING (true);
CREATE POLICY "Courses are viewable by everyone" ON courses FOR SELECT USING (is_active = true AND is_archived = false);
CREATE POLICY "Course modules are viewable by everyone" ON course_modules FOR SELECT USING (true);

-- Tout le monde peut insérer une nouvelle ligne dans registrations (anonyme ou connecté avec son client_id)
CREATE POLICY "Anyone can register for a course" ON registrations FOR INSERT WITH CHECK (client_id = auth.uid() OR client_id IS NULL);

-- Un client authentifié peut lire uniquement ses propres inscriptions
CREATE POLICY "Clients can view their own registrations" ON registrations FOR SELECT TO authenticated USING (client_id = auth.uid());

-- Administrateurs/Gestion : Accès sécurisé réservé à l'administrateur
CREATE POLICY "Anyone can manage trainers" ON trainers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Anyone can manage courses" ON courses FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Anyone can manage course modules" ON course_modules FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Anyone can manage registrations" ON registrations FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

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
CREATE POLICY "Admins can manage templates" ON templates FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

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
CREATE POLICY "Admins can manage testimonials" ON testimonials FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

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

-- L'administrateur peut lire toutes les lignes
CREATE POLICY "Admins can view all profiles" ON client_profiles FOR SELECT TO authenticated USING (is_admin());

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

-- 10. Table course_proposals (Propositions de formations)
CREATE TABLE course_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    custom_title TEXT,
    custom_description TEXT,
    proposed_price NUMERIC,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
    admin_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS pour la table course_proposals
ALTER TABLE course_proposals ENABLE ROW LEVEL SECURITY;

-- Un client connecté peut faire un INSERT de sa propre proposition
CREATE POLICY "Clients can insert their own proposals" ON course_proposals
    FOR INSERT 
    TO authenticated 
    WITH CHECK (client_id = auth.uid());

-- Un client connecté peut lire ses propres propositions
CREATE POLICY "Clients can view their own proposals" ON course_proposals
    FOR SELECT 
    TO authenticated 
    USING (client_id = auth.uid());

-- L'administrateur peut tout lire et modifier
CREATE POLICY "Admins can manage proposals" ON course_proposals
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());


-- 11. Table messages (Messagerie privée contextuelle)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation du Temps Réel (Realtime)
-- Ajoute la table messages à la publication de réplication en temps réel de Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Activation du RLS (Row Level Security)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (RLS) pour la table messages

-- 1. Lecture (SELECT) pour le Client : Un utilisateur authentifié peut lire un message uniquement si son ID (auth.uid()) est égal au client_id
CREATE POLICY "Clients can view their own messages" ON messages
    FOR SELECT
    TO authenticated
    USING (auth.uid() = client_id);

-- 2. Insertion (INSERT) pour le Client : Un utilisateur authentifié peut insérer un message uniquement si son ID (auth.uid()) est égal à la fois au client_id et au sender_id
CREATE POLICY "Clients can insert their own messages" ON messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = client_id AND auth.uid() = sender_id);

-- 3. Mise à jour (UPDATE) pour le Client : Permet au client de marquer les messages reçus comme lus (is_read = true)
CREATE POLICY "Clients can update their own messages" ON messages
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = client_id)
    WITH CHECK (auth.uid() = client_id);

-- 4. Accès Administrateur : Accès complet (ALL) en lecture, écriture, mise à jour et suppression
CREATE POLICY "Admins have full access to all messages" ON messages
    FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- 12. Storage Policies (Bucket course-image)
-- Ces politiques doivent être appliquées manuellement si le bucket n'est pas créé via SQL
-- INSERT INTO storage.buckets (id, name, public) VALUES ('course-image', 'course-image', true);

-- Politique pour permettre la lecture publique des images
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'course-image');

-- Politique pour permettre aux administrateurs de télécharger des images
-- CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'course-image' AND is_admin());
-- CREATE POLICY "Admin Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'course-image' AND is_admin());
-- CREATE POLICY "Admin Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'course-image' AND is_admin());


