const fs = require('fs');

let content = fs.readFileSync('src/pages/PublicQuizChallenge.tsx', 'utf-8');

// 1. Add auth step
content = content.replace(
  "const [step, setStep] = useState<'landing' | 'quiz' | 'results'>('landing');",
  "const [step, setStep] = useState<'landing' | 'quiz' | 'auth' | 'results'>('landing');\n  const [session, setSession] = useState<any>(null);\n  const [authMode, setAuthMode] = useState<'register'|'login'>('register');\n  const [email, setEmail] = useState('');\n  const [password, setPassword] = useState('');\n  const [firstName, setFirstName] = useState('');\n  const [lastName, setLastName] = useState('');\n  const [phone, setPhone] = useState('');\n  const [authLoading, setAuthLoading] = useState(false);\n  const [authError, setAuthError] = useState('');"
);

// 2. Add auth effect
content = content.replace(
  "useEffect(() => {",
  "useEffect(() => {\n    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));\n    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));\n    return () => subscription.unsubscribe();\n  }, []);\n\n  useEffect(() => {"
);

// 3. Update finishQuiz
content = content.replace(
  /const finishQuiz = \(finalAnswers: number\[\]\) => \{[\s\S]*?if \(scorePercentage >= 80\) \{\s*triggerConfetti\(\);\s*\}\s*\};/,
  `const finishQuiz = async (finalAnswers: number[]) => {
    let correctCount = 0;
    finalAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].correct_index) correctCount++;
    });
    
    const scorePercentage = (correctCount / questions.length) * 100;
    
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (currentSession) {
      await saveResult(currentSession.user.id, scorePercentage);
      setStep('results');
      if (scorePercentage >= 80) triggerConfetti();
    } else {
      setStep('auth');
    }
  };

  const saveResult = async (userId: string, score: number) => {
    try {
      await supabase.from('course_proposals').insert({
        client_id: userId,
        course_id: courseId,
        custom_title: \`Résultat Quizz : \${course?.title}\`,
        description: \`Score : \${Math.round(score)}% - Code Promo : \${score >= 80 ? 'EXPERT50' : 'BOOST20'}\`,
        status: 'quiz_lead',
        price: 0
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    
    try {
      let authRes;
      if (authMode === 'register') {
        authRes = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName, phone }
          }
        });
      } else {
        authRes = await supabase.auth.signInWithPassword({
          email,
          password
        });
      }

      if (authRes.error) throw authRes.error;
      
      if (authRes.data.session) {
        let correctCount = 0;
        answers.forEach((ans, idx) => {
          if (ans === questions[idx].correct_index) correctCount++;
        });
        const scorePercentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
        
        await saveResult(authRes.data.session.user.id, scorePercentage);
        setStep('results');
        if (scorePercentage >= 80) triggerConfetti();
      }
    } catch (err: any) {
      setAuthError(err.message === 'User already registered' ? 'Cet email est déjà utilisé. Connectez-vous.' : err.message);
    } finally {
      setAuthLoading(false);
    }
  };`
);

// 4. Add the auth step rendering
const authStepUI = `
        {step === 'auth' && (
          <div className="animate-fade-in w-full max-w-md mx-auto">
            <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Débloquez vos résultats</h2>
                <p className="text-slate-600">Créez votre compte gratuitement pour voir votre score détaillé et obtenir votre code promo exclusif.</p>
              </div>

              {authError && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 flex items-start gap-2">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <p>{authError}</p>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Prénom</label>
                        <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nom</label>
                        <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                      <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mot de passe</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <button type="submit" disabled={authLoading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
                  {authLoading ? 'Chargement...' : (authMode === 'register' ? 'Créer mon compte & Voir mes résultats' : 'Me connecter & Voir mes résultats')}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button type="button" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')} className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                  {authMode === 'register' ? 'Déjà un compte ? Connectez-vous' : 'Pas de compte ? Inscrivez-vous'}
                </button>
              </div>
            </div>
          </div>
        )}
`;

content = content.replace("{step === 'results' && (", authStepUI + "\n        {step === 'results' && (");

fs.writeFileSync('src/pages/PublicQuizChallenge.tsx', content);
