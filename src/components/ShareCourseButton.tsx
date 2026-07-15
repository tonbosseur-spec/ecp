import React, { useState } from 'react';
import { Share2, Check, Copy } from 'lucide-react';

interface ShareCourseButtonProps {
  courseId: string;
  courseTitle: string;
  className?: string;
}

export default function ShareCourseButton({ courseId, courseTitle, className = '' }: ShareCourseButtonProps) {
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
      } catch (error) {
        console.error('Erreur lors du partage natif:', error);
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
      className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm active:scale-95 ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-5 h-5" />
          Lien copié !
        </>
      ) : (
        <>
          <Share2 className="w-5 h-5" />
          Partager le lien
        </>
      )}
    </button>
  );
}
