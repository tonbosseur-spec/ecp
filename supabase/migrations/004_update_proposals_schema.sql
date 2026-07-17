-- Migration: Add admin_feedback and update status check for course_proposals
-- Brand: Exceller chez Pierre (ECP)

-- 1. Add admin_feedback column if not exists
ALTER TABLE course_proposals ADD COLUMN IF NOT EXISTS admin_feedback TEXT;

-- 2. Update status check constraint
-- First drop the old one (if it exists)
-- Note: Usually the constraint name is something like 'course_proposals_status_check'
ALTER TABLE course_proposals DROP CONSTRAINT IF EXISTS course_proposals_status_check;

-- Add the new constraint
ALTER TABLE course_proposals ADD CONSTRAINT course_proposals_status_check 
    CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected'));
