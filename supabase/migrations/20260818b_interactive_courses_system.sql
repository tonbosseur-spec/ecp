-- Minimal functional schema for autonomous interactive courses.
-- Safe to run after the existing ECP migrations.

CREATE TABLE IF NOT EXISTS public.interactive_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  level text NOT NULL DEFAULT 'beginner',
  category text NOT NULL DEFAULT 'R',
  status text NOT NULL DEFAULT 'draft',
  access_policy jsonb NOT NULL DEFAULT '{"type":"free"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interactive_course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.interactive_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.interactive_course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.interactive_course_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.interactive_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.interactive_course_lessons(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('text','video','image','quiz','code_r')),
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  points integer NOT NULL DEFAULT 10,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  hints jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.interactive_activity_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.interactive_activities(id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT false,
  is_passed boolean NOT NULL DEFAULT false,
  best_score integer NOT NULL DEFAULT 0,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  UNIQUE(user_id, activity_id)
);

CREATE TABLE IF NOT EXISTS public.interactive_activity_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.interactive_activities(id) ON DELETE CASCADE,
  submitted_answer jsonb NOT NULL,
  score integer NOT NULL DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT false,
  feedback text,
  execution_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interactive_modules_course ON public.interactive_course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_interactive_lessons_module ON public.interactive_course_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_interactive_activities_lesson ON public.interactive_activities(lesson_id);
CREATE INDEX IF NOT EXISTS idx_interactive_progress_activity ON public.interactive_activity_progress(activity_id);
CREATE INDEX IF NOT EXISTS idx_interactive_attempts_activity ON public.interactive_activity_attempts(activity_id);

ALTER TABLE public.interactive_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_activity_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_activity_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interactive_courses_read ON public.interactive_courses;
CREATE POLICY interactive_courses_read ON public.interactive_courses FOR SELECT TO authenticated
USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS interactive_modules_read ON public.interactive_course_modules;
CREATE POLICY interactive_modules_read ON public.interactive_course_modules FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.interactive_courses c WHERE c.id = course_id AND (c.status = 'published' OR public.is_admin())));

DROP POLICY IF EXISTS interactive_lessons_read ON public.interactive_course_lessons;
CREATE POLICY interactive_lessons_read ON public.interactive_course_lessons FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.interactive_course_modules m JOIN public.interactive_courses c ON c.id=m.course_id WHERE m.id=module_id AND (c.status='published' OR public.is_admin())));

DROP POLICY IF EXISTS interactive_activities_read ON public.interactive_activities;
CREATE POLICY interactive_activities_read ON public.interactive_activities FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.interactive_course_lessons l JOIN public.interactive_course_modules m ON m.id=l.module_id JOIN public.interactive_courses c ON c.id=m.course_id WHERE l.id=lesson_id AND (c.status='published' OR public.is_admin())));

DROP POLICY IF EXISTS interactive_progress_own_select ON public.interactive_activity_progress;
CREATE POLICY interactive_progress_own_select ON public.interactive_activity_progress FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS interactive_progress_own_insert ON public.interactive_activity_progress;
CREATE POLICY interactive_progress_own_insert ON public.interactive_activity_progress FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS interactive_progress_own_update ON public.interactive_activity_progress;
CREATE POLICY interactive_progress_own_update ON public.interactive_activity_progress FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

DROP POLICY IF EXISTS interactive_attempts_own_select ON public.interactive_activity_attempts;
CREATE POLICY interactive_attempts_own_select ON public.interactive_activity_attempts FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS interactive_attempts_own_insert ON public.interactive_activity_attempts;
CREATE POLICY interactive_attempts_own_insert ON public.interactive_activity_attempts FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
