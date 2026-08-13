DO $$
DECLARE
  new_id UUID := gen_random_uuid();
BEGIN
  -- simulate gotrue insert
  INSERT INTO auth.users (id, email) VALUES (new_id, 'test2@test.com');
  RAISE NOTICE 'Insert successful';
END;
$$;
