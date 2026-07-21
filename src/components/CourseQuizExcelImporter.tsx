import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, RefreshCw, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';

interface CourseQuizExcelImporterProps {
  courseId: string;
  onImportComplete: () => void;
}

interface ParsedQuestion {
  Numero_Module: number;
  Titre_Module?: string;
  Question: string;
  Option_A: string;
  Option_B: string;
  Option_C: string;
  Option_D: string;
  Reponse_Correcte: string;
  Explication?: string;
}

interface ModuleInfo {
  id: string;
  order_index: number;
  title: string;
}

export function CourseQuizExcelImporter({ courseId, onImportComplete }: CourseQuizExcelImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [parsedData, setParsedData] = useState<Record<string, any[]>>({}); // moduleId -> questions
  const [unmatchedModules, setUnmatchedModules] = useState<number[]>([]);
  
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchModules();
  }, [courseId]);

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('course_modules')
        .select('id, order_index, title')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });
        
      if (error) throw error;
      setModules(data || []);
    } catch (err: any) {
      console.error("Erreur chargement modules:", err);
      setError("Impossible de charger les modules de la formation.");
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Numero_Module: 1,
        Question: "Quelle est la capitale de la France ?",
        Option_A: "Londres",
        Option_B: "Berlin",
        Option_C: "Paris",
        Option_D: "Madrid",
        Reponse_Correcte: "C",
        Explication: "Paris est la capitale politique et culturelle de la France."
      },
      {
        Numero_Module: 1,
        Question: "Quel est le résultat de 2+2 ?",
        Option_A: "3",
        Option_B: "4",
        Option_C: "5",
        Option_D: "22",
        Reponse_Correcte: "B",
        Explication: ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quiz");
    XLSX.writeFile(wb, "Modele_Import_Quiz.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    parseExcel(selectedFile);
  };

  const parseExcel = (fileToParse: File) => {
    setParsing(true);
    setError(null);
    setSuccess(null);
    setParsedData({});
    setUnmatchedModules([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json<ParsedQuestion>(worksheet);
        
        if (jsonData.length === 0) {
          throw new Error("Le fichier Excel est vide.");
        }

        const groupedData: Record<string, any[]> = {};
        const unmatched: Set<number> = new Set();

        jsonData.forEach((row, index) => {
          if (!row.Question || !row.Option_A || !row.Option_B || !row.Option_C || !row.Option_D || !row.Reponse_Correcte) {
            console.warn(`Ligne ${index + 2} ignorée: données manquantes.`);
            return;
          }

          let targetModule = null;
          
          if (row.Numero_Module !== undefined) {
            // Correspondance par index (Numero_Module 1 correspond à order_index 0)
            targetModule = modules.find(m => m.order_index === (row.Numero_Module - 1));
            if (!targetModule) {
              unmatched.add(row.Numero_Module);
            }
          } else if (row.Titre_Module) {
            targetModule = modules.find(m => m.title.toLowerCase() === row.Titre_Module?.toLowerCase());
          }

          if (targetModule) {
            if (!groupedData[targetModule.id]) {
              groupedData[targetModule.id] = [];
            }
            
            // Convertir A, B, C, D en 0, 1, 2, 3
            const answerMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            const correctIndex = answerMap[row.Reponse_Correcte.toUpperCase()] ?? 0;

            groupedData[targetModule.id].push({
              text: String(row.Question),
              options: [String(row.Option_A), String(row.Option_B), String(row.Option_C), String(row.Option_D)],
              correct_index: correctIndex,
              explanation: row.Explication ? String(row.Explication) : undefined
            });
          }
        });

        if (Object.keys(groupedData).length === 0) {
          throw new Error("Aucune question valide n'a pu être associée aux modules existants.");
        }

        setParsedData(groupedData);
        setUnmatchedModules(Array.from(unmatched));
        
      } catch (err: any) {
        setError(err.message || "Erreur lors de l'analyse du fichier Excel.");
      } finally {
        setParsing(false);
      }
    };
    reader.readAsArrayBuffer(fileToParse);
  };

  const handleImport = async () => {
    if (Object.keys(parsedData).length === 0) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const moduleIds = Object.keys(parsedData);
      
      // Récupérer les quizzes existants
      const { data: existingQuizzes, error: fetchError } = await supabase
        .from('quizzes')
        .select('*')
        .in('module_id', moduleIds);
        
      if (fetchError) throw fetchError;

      const upsertPromises = moduleIds.map(async (moduleId) => {
        const newQuestions = parsedData[moduleId];
        const existingQuiz = existingQuizzes?.find(q => q.module_id === moduleId);
        const moduleInfo = modules.find(m => m.id === moduleId);
        
        let finalQuestions = newQuestions;
        if (importMode === 'append' && existingQuiz?.questions) {
          finalQuestions = [...existingQuiz.questions, ...newQuestions];
        }

        if (existingQuiz) {
          return supabase
            .from('quizzes')
            .update({ questions: finalQuestions })
            .eq('id', existingQuiz.id);
        } else {
          return supabase
            .from('quizzes')
            .insert({
              module_id: moduleId,
              title: `Quizz : ${moduleInfo?.title || 'Validation'}`,
              questions: finalQuestions
            });
        }
      });

      await Promise.all(upsertPromises);

      const totalQuestions = Object.values(parsedData).reduce((acc: number, val: any) => acc + (val as any[]).length, 0);
      const totalModules = moduleIds.length;
      
      setSuccess(`🎉 ${totalQuestions} question(s) importée(s) avec succès réparties sur ${totalModules} module(s) !`);
      setFile(null);
      setParsedData({});
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      onImportComplete();
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de l'importation dans la base de données.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Importation Globale des Quiz (Excel)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Importez les questions de tous vos modules en une seule fois via un fichier Excel.
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          Télécharger le modèle (.xlsx)
        </button>
      </div>

      <div className="space-y-6">
        {/* File Input */}
        <div>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="hidden"
            id="excel-upload"
          />
          <label
            htmlFor="excel-upload"
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              file ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-300 hover:bg-gray-50 bg-white'
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className={`w-8 h-8 mb-3 ${file ? 'text-emerald-500' : 'text-gray-400'}`} />
              <p className="mb-2 text-sm text-gray-600">
                <span className="font-bold">Cliquez pour téléverser</span> ou glissez-déposez
              </p>
              <p className="text-xs text-gray-500">
                {file ? file.name : 'Fichiers .xlsx ou .xls uniquement'}
              </p>
            </div>
          </label>
        </div>

        {/* Preview & Summary */}
        {parsing && (
          <div className="flex items-center justify-center py-4 text-emerald-600 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Analyse du fichier en cours...</span>
          </div>
        )}

        {Object.keys(parsedData).length > 0 && !parsing && (
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-4">Synthèse Récapitulative</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {Object.entries(parsedData).map(([moduleId, questions]) => {
                const module = modules.find(m => m.id === moduleId);
                return (
                  <div key={moduleId} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Module {module ? module.order_index + 1 : '?'}</div>
                      <div className="text-sm font-medium text-slate-900 line-clamp-1" title={module?.title}>{module?.title}</div>
                    </div>
                    <div className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-md">
                      {(questions as any[]).length} Q
                    </div>
                  </div>
                );
              })}
            </div>

            {unmatchedModules.length > 0 && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-bold">Attention</p>
                  <p>Les numéros de module suivants dans votre fichier n'ont pas été trouvés dans cette formation et seront ignorés : {unmatchedModules.join(', ')}.</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="radio" 
                      name="importMode" 
                      className="peer sr-only"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                    />
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 peer-checked:border-emerald-600 peer-checked:bg-emerald-600 transition-all flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Remplacer</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="radio" 
                      name="importMode" 
                      className="peer sr-only"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                    />
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 peer-checked:border-emerald-600 peer-checked:bg-emerald-600 transition-all flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Ajouter aux existants</span>
                </label>
              </div>

              <button
                onClick={handleImport}
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-sm"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Valider et Importer tous les Quiz
              </button>
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm flex items-start gap-3 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
}
