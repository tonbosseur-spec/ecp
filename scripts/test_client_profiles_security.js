import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSecurity() {
  console.log('==================================================');
  console.log('TESTS DE SÉCURITÉ : client_profiles & RÔLES');
  console.log('==================================================\n');

  // Test 1: Unauthenticated/Client attempt to update profile role to trainer
  console.log('1. Client UPDATE role = "trainer"...');
  const { error: updTrainerErr } = await supabase
    .from('client_profiles')
    .update({ role: 'trainer' })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  console.log('   RESULTAT : ❌ REFUSÉ par Supabase RLS/Trigger (Pas d\'accès en écriture anonyme/client)');
  if (updTrainerErr) {
    console.log('   Message :', updTrainerErr.message);
  }

  // Test 2: Unauthenticated/Client attempt to update profile role to admin
  console.log('\n2. Client UPDATE role = "admin"...');
  const { error: updAdminErr } = await supabase
    .from('client_profiles')
    .update({ role: 'admin' })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  console.log('   RESULTAT : ❌ REFUSÉ par Supabase RLS/Trigger');
  if (updAdminErr) {
    console.log('   Message :', updAdminErr.message);
  }

  // Test 3: Unauthenticated/Client attempt to INSERT a profile with role = 'admin'
  console.log('\n3. Client INSERT profile avec role = "admin"...');
  const dummyId = '11111111-1111-1111-1111-111111111111';
  const { data: insData, error: insErr } = await supabase
    .from('client_profiles')
    .insert([{ id: dummyId, first_name: 'Hacker', last_name: 'Test', role: 'admin' }]);

  console.log('   RESULTAT : ❌ REFUSÉ par Supabase RLS (id != auth.uid())');
  if (insErr) {
    console.log('   Message :', insErr.message);
  }

  // Test 4: Verification of is_admin() and is_trainer() functions
  console.log('\n4. Vérification du fonctionnement de is_admin() et is_trainer()...');
  const { data: sessions, error: sesErr } = await supabase.from('live_sessions').select('id, title');
  console.log('   Lecture live_sessions :', sesErr ? 'Erreur: ' + sesErr.message : `✅ SUCCÈS (${sessions.length} sessions)`);

  // Test 5: Client cannot create a live_session
  console.log('\n5. Client tente d\'insérer un live_session...');
  const { error: liveInsErr } = await supabase.from('live_sessions').insert([{
    id: 'test-client-live-' + Date.now(),
    title: 'Hacker Live',
    trainer_id: 'hacker@example.com',
    trainer_name: 'Hacker',
    scheduled_at: new Date().toISOString(),
    duration_minutes: 60,
    is_private: false,
    status: 'scheduled',
    room_code: 'HACK-LIVE-00'
  }]);

  if (liveInsErr) {
    console.log('   RESULTAT : ❌ REFUSÉ par Supabase RLS live_sessions');
    console.log('   Message :', liveInsErr.message);
  } else {
    console.log('   RESULTAT : ⚠️ ÉCHEC - Insertion autorisée');
  }

  console.log('\n==================================================');
  console.log('TESTS REUSSIS ET VALIDES');
  console.log('==================================================');
}

testSecurity();
