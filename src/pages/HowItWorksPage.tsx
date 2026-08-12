import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import { 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  Search, 
  User, 
  RefreshCw, 
  GraduationCap,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';

function formatDescriptionHtml(text: string | null | undefined): string {
  if (!text) return '';
  const hasHtml = /<[a-z][\s\S]*>/i.test(text);
  if (hasHtml) {
    return text;
  }
  return text
    .split('\n\n')
    .map(p => `<p className="mb-1 leading-relaxed">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export default function HowItWorksPage() {
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'free' | 'paid'>('all');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchEbooks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch active & non-archived e-books from Supabase
      let { data, error: dbError } = await supabase
        .from('courses')
        .select('*, trainers(name, photo_url)')
        .eq('product_type', 'ebook')
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (dbError) {
        // Fallback if is_archived column is missing or errors
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('courses')
          .select('*, trainers(name, photo_url)')
          .eq('product_type', 'ebook')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        data = fallbackData;
      }

      setEbooks(data || []);
    } catch (err: any) {
      console.error("Erreur chargement e-books:", err);
      setError("Impossible de charger la bibliothèque d'e-books pour le moment. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEbooks();
  }, []);

  // Filter ebooks
  const filteredEbooks = ebooks.filter((ebook) => {
    const matchesSearch =
      ebook.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ebook.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ebook.trainers?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterType === 'free') {
      return matchesSearch && (!ebook.price_fcfa || ebook.price_fcfa === 0);
    }
    if (filterType === 'paid') {
      return matchesSearch && ebook.price_fcfa > 0;
    }

    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-emerald-200 pt-safe pb-safe">
      <ClientNavBar currentSession={currentSession} />
      
      <main className="flex-1">
        {/* Header Section */}
        <section className="bg-white py-12 sm:py-20 border-b border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-50/60 rounded-full blur-3xl pointer-events-none -mt-20"></div>
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-50/60 rounded-full blur-3xl pointer-events-none -mb-20"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-xs uppercase tracking-wider mb-6">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bibliothèque Numérique</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4 sm:mb-6">
              Tous nos <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">E-books & Guides</span>
            </h1>

            <p className="text-gray-600 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10">
              Des manuels pratiques, des guides pas-à-pas et des ouvrages méthodologiques rédigés par nos experts pour progresser en toute autonomie.
            </p>

            {/* Search & Filter Controls */}
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un e-book, sujet, logiciel..."
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded-md bg-gray-200/60"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  Tous ({ebooks.length})
                </button>
                <button
                  onClick={() => setFilterType('free')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    filterType === 'free'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  Gratuits
                </button>
                <button
                  onClick={() => setFilterType('paid')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    filterType === 'paid'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  Payants
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* E-books Library Grid Section */}
        <section className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <button
                onClick={fetchEbooks}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réessayer</span>
              </button>
            </div>
          )}

          {/* Skeleton Loading */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-white rounded-[2rem] border border-gray-150 p-4 shadow-xs animate-pulse flex flex-col justify-between">
                  <div>
                    <div className="w-full h-56 bg-gray-200 rounded-2xl mb-4" />
                    <div className="h-4 bg-gray-200 rounded-md w-1/3 mb-3" />
                    <div className="h-5 bg-gray-200 rounded-md w-4/5 mb-2" />
                    <div className="h-3 bg-gray-100 rounded-md w-full mb-1" />
                    <div className="h-3 bg-gray-100 rounded-md w-2/3 mb-4" />
                  </div>
                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                    <div className="h-5 bg-gray-200 rounded-md w-20" />
                    <div className="h-8 bg-gray-200 rounded-xl w-24" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredEbooks.length === 0 && (
            <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-gray-100 shadow-sm max-w-2xl mx-auto text-center my-8">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xs">
                <BookOpen className="w-10 h-10" />
              </div>

              <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-3">
                {searchTerm ? "Aucun e-book ne correspond à votre recherche" : "Nos e-books arrivent bientôt."}
              </h3>

              <p className="text-gray-600 text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-8">
                {searchTerm
                  ? `Aucun ouvrage ne correspond au terme "${searchTerm}". Essayez avec un autre mot-clé ou réinitialisez le filtre.`
                  : "Nous préparons actuellement de nouveaux guides pratiques et manuels d'analyse de données rédigés par nos experts. En attendant, vous pouvez découvrir nos formations."}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {searchTerm ? (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setFilterType('all');
                    }}
                    className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-extrabold rounded-2xl shadow-sm text-sm transition-all"
                  >
                    Réinitialiser les filtres
                  </button>
                ) : (
                  <Link
                    to="/catalogue"
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Explorer le catalogue de formations</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* E-books Grid */}
          {!loading && !error && filteredEbooks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredEbooks.map((ebook) => {
                const isFree = !ebook.price_fcfa || ebook.price_fcfa === 0;
                const createdDate = ebook.created_at ? new Date(ebook.created_at) : null;
                const isRecent = createdDate ? (Date.now() - createdDate.getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
                const authorName = ebook.trainers?.name || "Pierre & l'équipe Exceller";
                const formattedPrice = isFree ? "Gratuit" : `${Number(ebook.price_fcfa).toLocaleString('fr-FR')} FCFA`;

                return (
                  <Link
                    key={ebook.id}
                    to={`/course/${ebook.id}`}
                    className="group bg-white rounded-[2rem] border border-gray-150/80 shadow-xs hover:shadow-2xl hover:border-emerald-200/80 transition-all duration-300 flex flex-col overflow-hidden active:scale-[0.98] cursor-pointer relative"
                  >
                    {/* Cover Container */}
                    <div className="relative w-full h-60 sm:h-64 bg-slate-900 overflow-hidden flex items-center justify-center">
                      {ebook.cover_image_url ? (
                        <img
                          src={ebook.cover_image_url}
                          alt={ebook.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          loading="lazy"
                        />
                      ) : (
                        /* High quality fallback cover matching brand identity */
                        <div className="w-full h-full bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 flex flex-col justify-between text-white relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                          <div className="flex items-center justify-between z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                              E-Book
                            </span>
                            <BookOpen className="w-5 h-5 text-emerald-300" />
                          </div>
                          <div className="z-10 my-auto py-2">
                            <h4 className="font-black text-lg leading-snug line-clamp-2 text-white drop-shadow-xs">
                              {ebook.title}
                            </h4>
                          </div>
                          <div className="z-10 flex items-center gap-1.5 text-xs text-emerald-200/80 font-medium">
                            <span>Exceller chez Pierre</span>
                          </div>
                        </div>
                      )}

                      {/* Badges overlay */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-20">
                        {isFree ? (
                          <span className="bg-emerald-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                            Gratuit
                          </span>
                        ) : (
                          <span className="bg-slate-900/80 backdrop-blur-md text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border border-white/20 shadow-md">
                            PDF
                          </span>
                        )}
                        {isRecent && (
                          <span className="bg-blue-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                            Nouveau
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-5 sm:p-6 flex flex-col flex-1 justify-between bg-white">
                      <div>
                        {/* Author */}
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mb-2">
                          <User className="w-3.5 h-3.5" />
                          <span className="truncate">{authorName}</span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base sm:text-lg font-black text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug line-clamp-2 mb-2">
                          {ebook.title}
                        </h3>

                        {/* Description */}
                        {ebook.description && (
                          <div 
                            className="text-gray-600 text-xs sm:text-sm line-clamp-2 leading-relaxed mb-4 [&_*]:inline [&_*]:m-0 [&_*]:font-normal [&_strong]:font-bold [&_b]:font-bold [&_em]:italic"
                            dangerouslySetInnerHTML={{ __html: formatDescriptionHtml(ebook.description) }}
                          />
                        )}
                      </div>

                      {/* Card Footer: Price & CTA */}
                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">Prix</span>
                          <span className={`text-sm sm:text-base font-black ${isFree ? 'text-emerald-600' : 'text-gray-900'}`}>
                            {formattedPrice}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-700 group-hover:text-white text-xs font-black transition-all shadow-xs">
                          <span>Découvrir</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
