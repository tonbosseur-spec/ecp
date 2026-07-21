export interface PromoCode {
  id?: string;
  code: string;
  discount_type: 'percentage' | 'fixed'; // 'percentage' (-20%) ou 'fixed' (-5000 FCFA)
  discount_value: number;
  min_score: number; // 0, 21, 41, 61, 81
  max_score: number; // 20, 40, 60, 80, 100
  class_name: string;
  description?: string;
}

export interface QuizClassTier {
  level: number; // 1 à 5
  name: string;
  title: string;
  minScore: number;
  maxScore: number;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  defaultCode: string;
  defaultDiscount: number; // pourcentage
  description: string;
}

export const QUIZ_CLASSES: QuizClassTier[] = [
  {
    level: 1,
    name: "Classe 1",
    title: "Niveau Débutant",
    minScore: 0,
    maxScore: 20,
    badgeColor: "text-rose-700",
    badgeBg: "bg-rose-50",
    badgeBorder: "border-rose-200",
    defaultCode: "DEBUTANT10",
    defaultDiscount: 10,
    description: "Des bases sont présentes mais nécessitent d'être renforcées."
  },
  {
    level: 2,
    name: "Classe 2",
    title: "Niveau Évolutif",
    minScore: 21,
    maxScore: 40,
    badgeColor: "text-amber-700",
    badgeBg: "bg-amber-50",
    badgeBorder: "border-amber-200",
    defaultCode: "APPRENTI20",
    defaultDiscount: 20,
    description: "Notions en cours d'apprentissage et d'assimilation."
  },
  {
    level: 3,
    name: "Classe 3",
    title: "Niveau Intermédiaire",
    minScore: 41,
    maxScore: 60,
    badgeColor: "text-blue-700",
    badgeBg: "bg-blue-50",
    badgeBorder: "border-blue-200",
    defaultCode: "SOLIDE30",
    defaultDiscount: 30,
    description: "Acquis solides sur les principes fondamentaux."
  },
  {
    level: 4,
    name: "Classe 4",
    title: "Niveau Avancé",
    minScore: 61,
    maxScore: 80,
    badgeColor: "text-indigo-700",
    badgeBg: "bg-indigo-50",
    badgeBorder: "border-indigo-200",
    defaultCode: "AVANCE40",
    defaultDiscount: 40,
    description: "Excellente maîtrise technique et opérationnelle."
  },
  {
    level: 5,
    name: "Classe 5",
    title: "Niveau Expert",
    minScore: 81,
    maxScore: 100,
    badgeColor: "text-emerald-700",
    badgeBg: "bg-emerald-50",
    badgeBorder: "border-emerald-200",
    defaultCode: "EXPERT50",
    defaultDiscount: 50,
    description: "Maîtrise remarquable et profil à très haut potentiel !"
  }
];

export function getQuizClassForScore(score: number): QuizClassTier {
  const rounded = Math.round(score);
  return QUIZ_CLASSES.find(c => rounded >= c.minScore && rounded <= c.maxScore) || QUIZ_CLASSES[0];
}

export function getDefaultPromoCodesForCourse(): PromoCode[] {
  return QUIZ_CLASSES.map(qc => ({
    code: qc.defaultCode,
    discount_type: 'percentage',
    discount_value: qc.defaultDiscount,
    min_score: qc.minScore,
    max_score: qc.maxScore,
    class_name: qc.name,
    description: qc.description
  }));
}

export function calculateDiscountedPrice(originalPrice: number, promo: PromoCode | null): { finalPrice: number, discountAmount: number, savings: number } {
  if (!promo || !originalPrice || originalPrice <= 0) {
    return { finalPrice: originalPrice || 0, discountAmount: 0, savings: 0 };
  }

  let discount = 0;
  if (promo.discount_type === 'percentage') {
    discount = Math.round((originalPrice * (promo.discount_value || 0)) / 100);
  } else {
    discount = promo.discount_value || 0;
  }

  discount = Math.min(discount, originalPrice); // Ne peut pas dépasser le prix initial
  const finalPrice = Math.max(0, originalPrice - discount);

  return { finalPrice, discountAmount: discount, savings: discount };
}

/**
 * Extracts promo codes from course record (supports `promo_codes` JSONB column or fallback in `guide_text`)
 */
export function extractCoursePromoCodes(course: any): PromoCode[] {
  if (!course) return getDefaultPromoCodesForCourse();

  // 1. Direct column promo_codes
  if (Array.isArray(course.promo_codes) && course.promo_codes.length > 0) {
    return course.promo_codes;
  }

  // 2. Parsed guide_text JSON
  if (course.guide_text) {
    try {
      const trimmed = course.guide_text.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed.promo_codes) && parsed.promo_codes.length > 0) {
          return parsed.promo_codes;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return getDefaultPromoCodesForCourse();
}
