export interface CourseQuizSettings {
  quizTitle?: string | null;
  quizDescription?: string | null;
  guideText?: string | null;
}

export function parseCourseQuizSettings(rawGuideText?: string | null): CourseQuizSettings {
  if (!rawGuideText) {
    return { quizTitle: null, quizDescription: null, guideText: '' };
  }

  const trimmed = rawGuideText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          quizTitle: parsed.quiz_title || null,
          quizDescription: parsed.quiz_description || null,
          guideText: parsed.guide_text || ''
        };
      }
    } catch (e) {
      // Fallback to plain text
    }
  }

  return { quizTitle: null, quizDescription: null, guideText: rawGuideText };
}

export function encodeCourseQuizSettings(
  rawGuideText: string | null | undefined,
  newSettings: { quizTitle?: string | null; quizDescription?: string | null; guideText?: string | null }
): string | null {
  const existing = parseCourseQuizSettings(rawGuideText);

  const updatedQuizTitle = newSettings.quizTitle !== undefined ? newSettings.quizTitle : existing.quizTitle;
  const updatedQuizDescription = newSettings.quizDescription !== undefined ? newSettings.quizDescription : existing.quizDescription;
  const updatedGuideText = newSettings.guideText !== undefined ? newSettings.guideText : existing.guideText;

  if (!updatedQuizTitle && !updatedQuizDescription) {
    return updatedGuideText || null;
  }

  return JSON.stringify({
    quiz_title: updatedQuizTitle || null,
    quiz_description: updatedQuizDescription || null,
    guide_text: updatedGuideText || ''
  });
}
