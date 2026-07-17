-- Migration: Add archiving capability to courses
-- Brand: Exceller chez Pierre (ECP)

-- 1. Add is_archived column
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- 2. Update Public Select Policy
-- We want visitors to see only active AND non-archived courses
DROP POLICY IF EXISTS "Courses are viewable by everyone" ON courses;
CREATE POLICY "Courses are viewable by everyone" ON courses 
    FOR SELECT 
    USING (is_active = true AND is_archived = false);
