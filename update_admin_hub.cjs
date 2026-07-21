const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminHub.tsx', 'utf-8');

// 1. Add state for quiz leads
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'formations' | 'paiements'>('formations');",
  "const [activeTab, setActiveTab] = useState<'formations' | 'paiements' | 'quizz'>('formations');\n  const [quizLeads, setQuizLeads] = useState<any[]>([]);"
);

// 2. Fetch quiz leads in fetchData
content = content.replace(
  "const { data: payData, error: payError } = await supabase\n        .from('payments')",
  `const { data: leadsData, error: leadsError } = await supabase
        .from('course_proposals')
        .select('*, client_profiles(first_name, last_name), courses(title)')
        .eq('status', 'quiz_lead')
        .order('created_at', { ascending: false });

      if (leadsData) setQuizLeads(leadsData);

      const { data: payData, error: payError } = await supabase
        .from('payments')`
);

// 3. Add Quiz tab button
const tabsSection = `
          <button
            onClick={() => setActiveTab('quizz')}
            className={\`px-6 py-3 font-bold text-sm transition-all relative flex items-center gap-2 \${
              activeTab === 'quizz' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }\`}
          >
            Leads & Quizz
            {quizLeads.length > 0 && (
              <span className="bg-purple-100 text-purple-700 py-0.5 px-2 rounded-full text-[10px] font-black">
                {quizLeads.length}
              </span>
            )}
            {activeTab === 'quizz' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>}
          </button>
        </div>
`;

content = content.replace(
  "{activeTab === 'paiements' && <div className=\"absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900\"></div>}\n          </button>\n        </div>",
  "{activeTab === 'paiements' && <div className=\"absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900\"></div>}\n          </button>" + tabsSection
);

// 4. Add the Quizz Tab Content
const copyFunction = `
  const copyQuizLink = (courseId: string) => {
    const url = window.location.origin + '/challenge/' + courseId;
    navigator.clipboard.writeText(url);
    alert('Lien du challenge copié : ' + url);
  };
`;

content = content.replace(
  "const handleValidatePayment = async",
  copyFunction + "\n  const handleValidatePayment = async"
);

const quizzTabContent = `
        {activeTab === 'quizz' ? (
          <div className="animate-fade-in space-y-8">
            {/* List of quiz links */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Liens des Challenges Publics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {courses.map(course => (
                  <div key={course.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <span className="font-bold text-sm text-gray-700 truncate mr-4">{course.title}</span>
                    <button 
                      onClick={() => copyQuizLink(course.id)}
                      className="shrink-0 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      Copier
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* List of leads */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Répondants aux Quizz ({quizLeads.length})</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {quizLeads.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-medium">Aucun répondant pour le moment.</div>
                ) : (
                  quizLeads.map((lead) => (
                    <div key={lead.id} className="p-6 hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-gray-900">
                            {lead.client_profiles?.first_name} {lead.client_profiles?.last_name}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg font-medium">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-purple-600 mb-2">{lead.custom_title}</p>
                        <p className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 p-3 rounded-xl border border-gray-100">
                          {lead.description}
                        </p>
                      </div>
                      
                      <div className="shrink-0 flex items-center gap-2">
                        <Link 
                          to={\`/messages?client=\${lead.client_id}\`}
                          className="px-4 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Contacter
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'paiements' ? (
`;

content = content.replace(
  "{activeTab === 'paiements' ? (",
  quizzTabContent
);

// Add missing icon imports
content = content.replace(
  "import { Plus, Search, BookOpen, ExternalLink, RefreshCw, CheckCircle2, ChevronRight, XCircle, MoreVertical, CreditCard, Clock, Link } from 'lucide-react';",
  "import { Plus, Search, BookOpen, ExternalLink, RefreshCw, CheckCircle2, ChevronRight, XCircle, MoreVertical, CreditCard, Clock, LinkIcon, MessageSquare } from 'lucide-react';"
);


fs.writeFileSync('src/pages/AdminHub.tsx', content);
