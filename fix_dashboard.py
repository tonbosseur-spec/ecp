import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

tuile_1_marker = '{/* TUILE 2: Gestion de formations */}'
if tuile_1_marker not in content:
    tuile_1_marker = '{/* TUILE 1: Gestion de formations */}'

du_nouveau_tuile = """            {/* TUILE 1: Du nouveau */}
            <Link
              to="/admin/activity"
              className="group bg-white hover:bg-slate-900/5 p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-6 relative overflow-hidden ring-1 ring-black/5 md:col-span-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-sky-200 group-hover:scale-105 transition-transform">
                  <Activity className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-full group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <span>Ouvrir</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-sky-900 transition-colors">
                  Du nouveau (Activité)
                </h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Consultez le fil d'actualité des nouveautés : nouvelles inscriptions, quizz validés, futurs sessions, nouveaux paiements, nouveaux leads...
                </p>
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <span className="px-2.5 py-1 bg-sky-50 text-sky-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Fil d'activité
                  </span>
                </div>
              </div>
            </Link>
"""

new_content = content.replace(tuile_1_marker, du_nouveau_tuile + "            " + tuile_1_marker)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(new_content)
