import React, { useState } from 'react';
import { Share2, Check, Copy } from 'lucide-react';

interface ShareCourseButtonProps {
  courseId: string;
  courseTitle: string;
  className?: string;
  mobileIconOnly?: boolean;
}

export default function ShareCourseButton({ courseId, courseTitle, className = '', mobileIconOnly = false }: ShareCourseButtonProps) {
  const [copied, setCopied] = useState(false);
  
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/course/${courseId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: courseTitle,
          text: `Découvrez la formation : ${courseTitle}`,
          url: shareUrl,
        });
      } catch (error: any) {
        if (error?.name === 'AbortError' || error?.message?.toLowerCase().includes('cancel')) {
          // User intentionally canceled the native share dialog
          return;
        }
        // Fallback to clipboard if native share fails for another reason
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (copyErr) {
          console.error('Erreur lors de la copie:', copyErr);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Erreur lors de la copie:', error);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm active:scale-95 ${className}`}
      title={copied ? "Lien copié !" : "Partager la formation"}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 shrink-0" />
          <span className={mobileIconOnly ? "hidden sm:inline" : ""}>Lien copié !</span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4 shrink-0" />
          <span className={mobileIconOnly ? "hidden sm:inline" : ""}>Partager le lien</span>
        </>
      )}
    </button>
  );
}
