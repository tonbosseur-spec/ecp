import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Keyboard, 
  X, 
  BookOpen, 
  Users, 
  LayoutDashboard, 
  Video, 
  GraduationCap, 
  MessageSquare, 
  PlusCircle,
  Command,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShortcutItem {
  key: string;
  altKey?: boolean;
  label: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    key: 'f',
    label: 'F',
    description: 'Gestion des Formations & Cours',
    path: '/admin/formations',
    icon: <BookOpen className="w-4 h-4 text-blue-500" />,
  },
  {
    key: 'c',
    label: 'C',
    description: 'Gestion des Clients & Contacts',
    path: '/admin/clients',
    icon: <Users className="w-4 h-4 text-emerald-500" />,
  },
  {
    key: 'd',
    label: 'D',
    description: 'Tableau de bord principal',
    path: '/dashboard',
    icon: <LayoutDashboard className="w-4 h-4 text-indigo-500" />,
  },
  {
    key: 's',
    label: 'S',
    description: 'Sessions Live & Visioconférences',
    path: '/admin/sessions',
    icon: <Video className="w-4 h-4 text-rose-500" />,
  },
  {
    key: 't',
    label: 'T',
    description: 'Gestion des Formateurs',
    path: '/trainers',
    icon: <GraduationCap className="w-4 h-4 text-amber-500" />,
  },
  {
    key: 'm',
    label: 'M',
    description: 'Messagerie & Échanges clients',
    path: '/admin/clients?tab=messages',
    icon: <MessageSquare className="w-4 h-4 text-purple-500" />,
  },
  {
    key: 'n',
    label: 'N',
    description: 'Créer une nouvelle formation',
    path: '/courses/new',
    icon: <PlusCircle className="w-4 h-4 text-teal-500" />,
  },
];

export default function AdminKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in form controls or editable elements
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Toggle help modal on '?' (Shift + /) or Ctrl+K / Cmd+K
      if ((e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !isInput) {
        e.preventDefault();
        setShowModal((prev) => !prev);
        return;
      }

      // Close modal on Escape
      if (e.key === 'Escape' && showModal) {
        e.preventDefault();
        setShowModal(false);
        return;
      }

      // Ignore standard shortcut keys if user is typing in input
      if (isInput) return;

      // Don't override browser native hotkeys (Ctrl/Cmd + key or Alt key combos except explicit)
      if (e.ctrlKey || e.metaKey) return;

      const keyLower = e.key.toLowerCase();

      // Find matching shortcut
      const match = SHORTCUTS.find(
        (s) => s.key === keyLower || (e.altKey && s.key === keyLower)
      );

      if (match) {
        // Prevent default action if applicable
        e.preventDefault();

        // Avoid re-navigating to the exact same location
        const currentPath = location.pathname + location.search;
        if (currentPath !== match.path) {
          navigate(match.path);
          setActiveToast(`Raccourci [${match.label}] : ${match.description}`);
          
          // Clear toast after 2 seconds
          setTimeout(() => {
            setActiveToast((current) => (current?.includes(`[${match.label}]`) ? null : current));
          }, 2000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location, showModal]);

  return (
    <>
      {/* Floating Action Badge / Button to trigger help modal */}
      <div className="fixed bottom-5 right-5 z-40 hidden md:flex items-center gap-2">
        <button
          onClick={() => setShowModal(true)}
          title="Afficher les raccourcis clavier (Appuyez sur ?)"
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/95 hover:bg-slate-800 text-white text-xs font-semibold rounded-full shadow-lg border border-slate-700/60 backdrop-blur-md transition-all hover:scale-105 active:scale-95 group"
        >
          <Keyboard className="w-4 h-4 text-indigo-400 group-hover:rotate-12 transition-transform" />
          <span>Raccourcis</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-black bg-slate-800 text-indigo-300 rounded border border-slate-700">
            ?
          </kbd>
        </button>
      </div>

      {/* Navigation Feedback Toast */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-2xl shadow-2xl border border-slate-800 backdrop-blur-md"
          >
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
            <span>{activeToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shortcuts Guide Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Raccourcis Clavier Administrateur
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Naviguez instantanément avec votre clavier
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/40 flex items-center gap-2">
                  <Command className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    Appuyez simplement sur une touche depuis n'importe quelle page d'administration (hors champs de texte).
                  </span>
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {SHORTCUTS.map((item) => {
                    const isActive = location.pathname + location.search === item.path;
                    return (
                      <div
                        key={item.key}
                        onClick={() => {
                          navigate(item.path);
                          setShowModal(false);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                          isActive
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                            : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-2xs">
                            {item.icon}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {item.description}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                              {item.path}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <kbd className="px-2.5 py-1 text-xs font-mono font-black bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:border-indigo-400 transition-colors">
                            {item.label}
                          </kbd>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    Aide : <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">?</kbd> ou <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">Ctrl + K</kbd>
                  </span>
                  <span className="flex items-center gap-1.5">
                    Fermer : <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">Esc</kbd>
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
