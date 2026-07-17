-- Migration: Fix Admin RLS Policies and introduce is_admin() helper function
-- Brand: Exceller chez Pierre (ECP)

-- 1. Create is_admin() helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.jwt() ->> 'email' = 'pmbom@ecp.cm';
$$;

-- 2. Clean up previous permissive policies (if they exist)
DROP POLICY IF EXISTS "Anyone can manage trainers" ON trainers;
DROP POLICY IF EXISTS "Anyone can manage courses" ON courses;
DROP POLICY IF EXISTS "Anyone can manage course modules" ON course_modules;
DROP POLICY IF EXISTS "Anyone can manage registrations" ON registrations;
DROP POLICY IF EXISTS "Admins can manage templates" ON templates;
DROP POLICY IF EXISTS "Admins can manage testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can view all profiles" ON client_profiles;
DROP POLICY IF EXISTS "Admins can manage proposals" ON course_proposals;
DROP POLICY IF EXISTS "Admins have full access to all messages" ON messages;

-- 3. Re-create secure admin policies using is_admin()

-- Table: trainers
CREATE POLICY "Anyone can manage trainers" ON trainers 
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- Table: courses
CREATE POLICY "Anyone can manage courses" ON courses 
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- Table: course_modules
CREATE POLICY "Anyone can manage course modules" ON course_modules 
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- Table: registrations (full access only for admins)
CREATE POLICY "Anyone can manage registrations" ON registrations 
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- Table: templates
CREATE POLICY "Admins can manage templates" ON templates 
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- Table: testimonials
CREATE POLICY "Admins can manage testimonials" ON testimonials 
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- Table: client_profiles
CREATE POLICY "Admins can view all profiles" ON client_profiles 
    FOR SELECT 
    TO authenticated 
    USING (is_admin());

-- Table: course_proposals
CREATE POLICY "Admins can manage proposals" ON course_proposals 
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- Table: messages
CREATE POLICY "Admins have full access to all messages" ON messages 
    FOR ALL 
    TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());
