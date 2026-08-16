import React, { useState, useEffect } from 'react';
import { Lightbulb, BookOpen, AlertCircle, Sparkles, Loader2, X, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';

interface GeminiAssistantProps {
  exerciseId: string;
  studentCode: string;
  errorMessage?: string;
  isFailedAttempt?: boolean;
  aiAssistanceEnabled: boolean;
  onHintUsed?: (level: number) => void;
}

type HintLevel = 1 | 2 | 3;

interface GeminiResponse {
  type: 'hint' | 'understand' | 'error';
  content: string;
  level?: HintLevel;
}

export default function GeminiAssistant({
  exerciseId,
  studentCode,
  errorMessage,
  isFailedAttempt,
  aiAssistanceEnabled,
  onHintUsed
}: GeminiAssistantProps) {
  const [loadingType, setLoadingType] = useState<'hint' | 'understand' | 'error' | null>(null);
  const [currentHintLevel, setCurrentHintLevel] = useState<HintLevel>(1);
  const [activeResponse, setActiveResponse] = useState<GeminiResponse | null>(null);
  const { toast } = useToast();

  // Reset state when exercise changes
  useEffect(() => {
    setLoadingType(null);
    setCurrentHintLevel(1);
    setActiveResponse(null);
  }, [exerciseId]);

  if (!aiAssistanceEnabled) {
    return null;
  }

  const callGemini = async (type: 'hint' | 'understand' | 'error') => {
    try {
      setLoadingType(type);
      setActiveResponse(null); // Clear previous response
      
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Vous n'êtes pas authentifié.");
      }

      const payload = {
        exercise_id: exerciseId,
        request_type: type,
        hint_level: type === 'hint' ? currentHintLevel : 1,
        student_code: studentCode.substring(0, 3000), // Safety truncation
        error_message: errorMessage ? errorMessage.substring(0, 2000) : (isFailedAttempt ? "Le code s'exécute, mais le résultat ne valide pas les critères de l'exercice." : undefined)
      };

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Une erreur s'est produite avec l'assistant.");
      }

      setActiveResponse({
        type,
        content: data.response,
        level: type === 'hint' ? currentHintLevel : undefined
      });

      if (type === 'hint') {
        onHintUsed?.(currentHintLevel);
        if (currentHintLevel < 3) {
          setCurrentHintLevel((prev) => (prev + 1) as HintLevel);
        }
      }

    } catch (err: any) {
      console.error("Gemini API Error:", err);
      toast.error("Impossible d'obtenir une aide pour le moment. Réessaie dans quelques instants.");
    } finally {
      setLoadingType(null);
    }
  };

  const isHintExhausted = currentHintLevel > 3;

  return (
    <div className="w-full mt-4 space-y-3">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Hint Button */}
        {!isHintExhausted ? (
          <button
            type="button"
            onClick={() => callGemini('hint')}
            disabled={loadingType !== null}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
          >
            {loadingType === 'hint' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lightbulb className="w-4 h-4 text-amber-500" />
            )}
            Indice {currentHintLevel}/3
          </button>
        ) : (
           <div className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 bg-gray-50 text-gray-400 font-bold rounded-xl border border-gray-200 text-xs sm:text-sm">
             <Lightbulb className="w-4 h-4 mr-2 opacity-50" />
             Indices épuisés
           </div>
        )}

        {/* Understand Button */}
        <button
          type="button"
          onClick={() => callGemini('understand')}
          disabled={loadingType !== null}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-xl border border-sky-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
        >
          {loadingType === 'understand' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <BookOpen className="w-4 h-4" />
          )}
          Comprendre
        </button>
        
        {/* Error Button (Only show if there's an error message or a failed attempt) */}
        {(errorMessage || isFailedAttempt) && (
           <button
             type="button"
             onClick={() => callGemini('error')}
             disabled={loadingType !== null}
             className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
           >
             {loadingType === 'error' ? (
               <Loader2 className="w-4 h-4 animate-spin" />
             ) : (
               <AlertCircle className="w-4 h-4" />
             )}
             Comprendre mon erreur
           </button>
        )}
      </div>

      {/* Response Card */}
      {activeResponse && (
        <div className="relative bg-white p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm animate-in slide-in-from-top-2 fade-in duration-200">
          <button 
            onClick={() => setActiveResponse(null)}
            className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100">
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div className="flex-1 pt-1 pr-6">
               <div className="text-[11px] sm:text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                 {activeResponse.type === 'hint' && `Indice ${activeResponse.level}`}
                 {activeResponse.type === 'understand' && 'Explication'}
                 {activeResponse.type === 'error' && 'Analyse de l\'erreur'}
               </div>
               <div className="text-sm text-gray-800 leading-relaxed font-medium [&>p]:mb-2 [&>p:last-child]:mb-0 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-indigo-700 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:mb-1">
                 <Markdown>{activeResponse.content}</Markdown>
               </div>
               {activeResponse.type === 'hint' && currentHintLevel <= 3 && (
                 <button 
                   onClick={() => callGemini('hint')}
                   disabled={loadingType !== null}
                   className="mt-3 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                 >
                   Obtenir un indice plus précis <ChevronRight className="w-3.5 h-3.5" />
                 </button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
