import { PromoCode, getDefaultPromoCodesForCourse } from './promoUtils';

export interface CourseQuizSettings {
  quizTitle?: string | null;
  quizDescription?: string | null;
  guideText?: string | null;
  promoCodes?: PromoCode[] | null;
}

export function parseCourseQuizSettings(rawGuideText?: string | null): CourseQuizSettings {
  if (!rawGuideText) {
    return { quizTitle: null, quizDescription: null, guideText: '', promoCodes: getDefaultPromoCodesForCourse() };
  }

  const trimmed = rawGuideText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          quizTitle: parsed.quiz_title || null,
          quizDescription: parsed.quiz_description || null,
          guideText: parsed.guide_text || '',
          promoCodes: Array.isArray(parsed.promo_codes) && parsed.promo_codes.length > 0
            ? parsed.promo_codes
            : getDefaultPromoCodesForCourse()
        };
      }
    } catch (e) {
      // Fallback to plain text
    }
  }

  return { quizTitle: null, quizDescription: null, guideText: rawGuideText, promoCodes: getDefaultPromoCodesForCourse() };
}

export function encodeCourseQuizSettings(
  rawGuideText: string | null | undefined,
  newSettings: { quizTitle?: string | null; quizDescription?: string | null; guideText?: string | null; promoCodes?: PromoCode[] | null }
): string | null {
  const existing = parseCourseQuizSettings(rawGuideText);

  const updatedQuizTitle = newSettings.quizTitle !== undefined ? newSettings.quizTitle : existing.quizTitle;
  const updatedQuizDescription = newSettings.quizDescription !== undefined ? newSettings.quizDescription : existing.quizDescription;
  const updatedGuideText = newSettings.guideText !== undefined ? newSettings.guideText : existing.guideText;
  const updatedPromoCodes = newSettings.promoCodes !== undefined ? newSettings.promoCodes : existing.promoCodes;

  if (!updatedQuizTitle && !updatedQuizDescription && (!updatedPromoCodes || updatedPromoCodes.length === 0)) {
    return updatedGuideText || null;
  }

  return JSON.stringify({
    quiz_title: updatedQuizTitle || null,
    quiz_description: updatedQuizDescription || null,
    guide_text: updatedGuideText || '',
    promo_codes: updatedPromoCodes || []
  });
}
