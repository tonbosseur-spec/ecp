const fs = require('fs');
const file = '/app/applet/src/pages/LiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
`            <div>
              <h3 className="text-lg font-bold text-slate-900">Aucune session Live trouvée</h3>
              <p className="text-xs text-slate-500 mt-1">
                Aucune séance programmée ne correspond aux filtres actuels.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-md hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Programmer une séance</span>
            </button>`,
`            <div>
              <h3 className="text-lg font-bold text-slate-900">Aucune session Live trouvée</h3>
              <p className="text-xs text-slate-500 mt-1">
                Aucune séance programmée ne correspond aux filtres actuels.
              </p>
            </div>
            {isTrainer && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-md hover:bg-indigo-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Programmer une séance</span>
              </button>
            )}`
);
fs.writeFileSync(file, content);
console.log('patched');
