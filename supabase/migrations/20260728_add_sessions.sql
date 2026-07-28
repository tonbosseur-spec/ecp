ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS sessions JSONB DEFAULT '[]'::jsonb;
