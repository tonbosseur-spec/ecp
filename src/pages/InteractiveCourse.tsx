import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { WebREngine } from '../lib/webrEngine';

export default function InteractiveCourse() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const engine = useMemo(() => WebREngine.getInstance(), []);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      setError('');
      const { data: c, error: ce } = await supabase.from('interactive_courses').select('*').eq('id', courseId).single();
      if (ce) { setError(ce.message); return; }
      setCourse(c);
      const { data: modules, error: me } = await supabase.from('interactive_course_modules').select('*').eq('course_id', courseId).order('position');
      if (me) { setError(me.message); return; }
      const moduleIds = (modules || []).map((m: any) => m.id);
      if (!moduleIds.length) return;
      const { data: lessons, error: le } = await supabase.from('interactive_course_lessons').select('*').in('module_id', moduleIds).order('position');
      if (le) { setError(le.message); return; }
      const lessonIds = (lessons || []).map((l: any) => l.id);
      if (!lessonIds.length) return;
      const { data: acts, error: ae } = await supabase.from('interactive_activities').select('*').in('lesson_id', lessonIds).order('position');
      if (ae) { setError(ae.message); return; }
      setActivities(acts || []);
      if (acts?.[0]) {
        setSelected(acts[0]);
        setCode(acts[0].configuration?.starter_code || '');
      }
    })();
  }, [courseId]);

  const chooseActivity = (activity: any) => {
    setSelected(activity);
    setCode(activity.configuration?.starter_code || '');
    setOutput('');
  };

  const runR = async () => {
    if (!selected || selected.activity_type !== 'code_r') return;
    setBusy(true);
    setOutput('');
    setError('');
    try {
      const result = await engine.execute(code);
      const text = [...result.stdout, result.output, ...result.warnings, ...result.errors].filter(Boolean).join('\n');
      setOutput(text || (result.success ? '✓ Code exécuté avec succès.' : 'Échec de l’exécution.'));
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (userId && selected.id) {
        await supabase.from('interactive_activity_attempts').insert({
          user_id: userId,
          activity_id: selected.id,
          submitted_answer: { code },
          score: result.success ? selected.points : 0,
          is_correct: result.success,
          execution_error: result.success ? null : result.errors.join('\n')
        });
        await supabase.from('interactive_activity_progress').upsert({
          user_id: userId,
          activity_id: selected.id,
          is_completed: result.success,
          is_passed: result.success,
          best_score: result.success ? selected.points : 0,
          attempt_count: 1,
          last_attempt_at: new Date().toISOString()
        }, { onConflict: 'user_id,activity_id' });
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur WebR');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="min-h-screen p-6 text-red-600">{error}</div>;
  if (!course) return <div className="min-h-screen p-6">Chargement du cours…</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
        <p className="mt-1 text-gray-600">{course.description}</p>
        <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Activités</h2>
            <div className="space-y-2">
              {activities.map((a) => (
                <button key={a.id} onClick={() => chooseActivity(a)} className={`w-full rounded-lg p-3 text-left ${selected?.id === a.id ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-50'}`}>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs opacity-70">{a.activity_type}</div>
                </button>
              ))}
            </div>
          </aside>
          <main className="rounded-xl bg-white p-5 shadow-sm">
            {selected ? (
              <>
                <h2 className="text-xl font-semibold">{selected.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-700">{selected.instructions}</p>
                {selected.activity_type === 'code_r' && (
                  <>
                    <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="mt-5 min-h-64 w-full rounded-lg bg-gray-950 p-4 font-mono text-sm text-white outline-none" />
                    <button disabled={busy} onClick={runR} className="mt-3 rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white disabled:opacity-50">
                      {busy ? 'Exécution…' : '▶ Exécuter le code R'}
                    </button>
                    <pre className="mt-4 min-h-24 whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-sm">{output}</pre>
                  </>
                )}
                {selected.activity_type !== 'code_r' && <div className="mt-6 rounded-lg bg-gray-50 p-4">Cette activité est prête. Le support interactif sera ajouté progressivement.</div>}
              </>
            ) : <p>Aucune activité disponible.</p>}
          </main>
        </div>
      </div>
    </div>
  );
}
