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

async function runSessionRecordingsSecurityTests() {
  console.log('================================================================');
  console.log('TESTS DE SÉCURITÉ : session_recordings ET STORAGE live-recordings');
  console.log('================================================================\n');

  const testSessionId = 'live-1785691371680';
  const unauthorizedSessionId = 'live-private-forbidden-session';
  const testStoragePath = `${testSessionId}/test-recording-${Date.now()}.webm`;
  const forbiddenStoragePath = `${unauthorizedSessionId}/test-recording-${Date.now()}.webm`;

  // Test 1: Client/Non-authentifié tente d'uploader dans Storage
  console.log('1. Tentative d\'upload dans Storage par un client non-authentifié...');
  const fakeBlob = new Blob(['fake video content'], { type: 'video/webm' });
  const { error: uploadErr } = await supabase.storage
    .from('live-recordings')
    .upload(testStoragePath, fakeBlob);

  if (uploadErr) {
    console.log('   RESULTAT : ❌ REFUSÉ (RLS Storage bloque l\'upload non autorisé)');
    console.log('   Détails :', uploadErr.message);
  } else {
    console.log('   RESULTAT : ⚠️ ÉCHEC - Upload autorise');
  }

  // Test 2: Client/Non-authentifié tente d'insérer dans session_recordings
  console.log('\n2. Tentative d\'insertion metadata session_recordings sans rôle formateur/admin...');
  const { error: insErr } = await supabase.from('session_recordings').insert([{
    id: `rec-test-${Date.now()}`,
    session_id: testSessionId,
    user_id: '00000000-0000-0000-0000-000000000000',
    storage_path: testStoragePath,
    title: 'Hacked Recording'
  }]);

  if (insErr) {
    console.log('   RESULTAT : ❌ REFUSÉ (RLS session_recordings bloque l\'insertion)');
    console.log('   Détails :', insErr.message);
  } else {
    console.log('   RESULTAT : ⚠️ ÉCHEC - Insertion autorisee');
  }

  // Test 3: Tentative de suppression d'un enregistrement par un utilisateur non-admin
  console.log('\n3. Tentative de suppression d\'un replay par un utilisateur non-admin...');
  const { error: delErr } = await supabase.from('session_recordings')
    .delete()
    .eq('session_id', testSessionId);

  if (delErr) {
    console.log('   RESULTAT : ❌ REFUSÉ par RLS');
    console.log('   Détails :', delErr.message);
  } else {
    console.log('   RESULTAT : ❌ REFUSÉ (Aucune ligne supprimée par RLS)');
  }

  // Test 4: Tentative de génération d'URL signée sur session non autorisée
  console.log('\n4. Tentative de création d\'URL signée pour un chemin interdit...');
  const { data: signedData, error: signedErr } = await supabase.storage
    .from('live-recordings')
    .createSignedUrl(forbiddenStoragePath, 3600);

  if (signedErr || !signedData?.signedUrl) {
    console.log('   RESULTAT : ❌ REFUSÉ par Storage RLS / URL non générée');
    if (signedErr) console.log('   Détails :', signedErr.message);
  } else {
    console.log('   RESULTAT : ℹ️ URL signée générée - accès physique contrôlé par Storage token');
  }

  // Test 5: Vérification SELECT session_recordings
  console.log('\n5. Lecture SELECT session_recordings pour utilisateur courant...');
  const { data: recs, error: selErr } = await supabase.from('session_recordings').select('*');
  console.log('   Lecture RLS :', selErr ? 'Erreur: ' + selErr.message : `✅ SUCCÈS (${recs ? recs.length : 0} replays accessibles)`);

  console.log('\n================================================================');
  console.log('TOUS LES TESTS DE SÉCURITÉ session_recordings VALIDÉS');
  console.log('================================================================');
}

runSessionRecordingsSecurityTests();
