import { supabase } from './supabaseClient';

export interface ReferralCodeInfo {
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  code: string;
  discountPercent: number; // e.g. 10% off for buyer
  commissionPercent: number; // 10% commission for parrain
  createdAt: string;
}

export interface ReferralSale {
  id: string;
  registrationId: string;
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  buyerClientId?: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  paymentStatus: string;
  registeredAt: string;
  promoCode: string;
  parrainClientId: string;
  parrainName: string;
  commissionAmount: number; // 10% of coursePrice
}

const STORAGE_KEY_CODES = 'app_referral_promo_codes_v1';
const STORAGE_KEY_SALES = 'app_referral_sales_v1';
const STORAGE_KEY_USER_SPONSORS = 'app_referral_user_sponsors_v1';

export function getLocalUserSponsors(): Record<string, { promoCode: string; parrainClientId: string; parrainName: string; assignedAt: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_SPONSORS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveUserSponsor(userId: string, promoCode: string, info?: ReferralCodeInfo | null) {
  try {
    const sponsors = getLocalUserSponsors();
    sponsors[userId] = {
      promoCode: promoCode.trim().toUpperCase(),
      parrainClientId: info?.clientId || '',
      parrainName: info?.clientName || '',
      assignedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY_USER_SPONSORS, JSON.stringify(sponsors));
  } catch (e) {
    console.error("Error saving user sponsor:", e);
  }
}

export function getUserSponsor(userId: string) {
  if (!userId) return null;
  const sponsors = getLocalUserSponsors();
  return sponsors[userId] || null;
}

// Get all assigned referral promo codes
export function getLocalReferralCodes(): Record<string, ReferralCodeInfo> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CODES);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// Get all referral sales
export function getLocalReferralSales(): ReferralSale[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SALES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Save referral codes map to localStorage
export function saveLocalReferralCodes(codes: Record<string, ReferralCodeInfo>) {
  try {
    localStorage.setItem(STORAGE_KEY_CODES, JSON.stringify(codes));
  } catch (e) {
    console.error("Error saving referral codes:", e);
  }
}

// Save referral sales to localStorage
export function saveLocalReferralSales(sales: ReferralSale[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(sales));
  } catch (e) {
    console.error("Error saving referral sales:", e);
  }
}

/**
 * Assign or update a promo code for a client profile.
 */
export async function setClientReferralCode(
  clientId: string,
  code: string,
  clientInfo: { name: string; email: string; phone?: string }
): Promise<{ success: boolean; code: string; message?: string }> {
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!cleanCode) {
    return { success: false, code: '', message: 'Code promo invalide.' };
  }

  // Check if code is already taken by another client
  const existingCodes = getLocalReferralCodes();
  const duplicateOwner = Object.values(existingCodes).find(
    c => c.code === cleanCode && c.clientId !== clientId
  );

  if (duplicateOwner) {
    return {
      success: false,
      code: cleanCode,
      message: `Le code "${cleanCode}" est déjà attribué à ${duplicateOwner.clientName}. Veuillez en choisir un autre.`
    };
  }

  // Update in localStorage cache first
  const info: ReferralCodeInfo = {
    clientId,
    clientName: clientInfo.name,
    clientEmail: clientInfo.email,
    clientPhone: clientInfo.phone || '',
    code: cleanCode,
    discountPercent: 10,
    commissionPercent: 10,
    createdAt: new Date().toISOString()
  };

  existingCodes[clientId] = info;
  saveLocalReferralCodes(existingCodes);

  // Try updating Supabase client_profiles table (with fallback if column doesn't exist)
  try {
    const { error } = await supabase
      .from('client_profiles')
      .update({ promo_code: cleanCode })
      .eq('id', clientId);

    if (error && error.code !== '42703') {
      console.warn("Supabase client_profiles promo_code update notice:", error.message);
    }
  } catch (err) {
    console.warn("Could not update promo_code in Supabase client_profiles:", err);
  }

  return { success: true, code: cleanCode };
}

/**
 * Remove referral promo code from a client.
 */
export async function removeClientReferralCode(clientId: string): Promise<boolean> {
  const existingCodes = getLocalReferralCodes();
  delete existingCodes[clientId];
  saveLocalReferralCodes(existingCodes);

  try {
    await supabase
      .from('client_profiles')
      .update({ promo_code: null })
      .eq('id', clientId);
  } catch (e) {
    // Ignore error if column not present
  }

  return true;
}

/**
 * Lookup referral code info by code string.
 */
export async function findReferralCode(code: string): Promise<ReferralCodeInfo | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  // 1. Check local cache
  const localCodes = getLocalReferralCodes();
  const match = Object.values(localCodes).find(c => c.code === cleanCode);
  if (match) return match;

  // 2. Query Supabase client_profiles if available
  try {
    const { data: profile } = await supabase
      .from('client_profiles')
      .select('id, first_name, last_name, email, phone, promo_code')
      .eq('promo_code', cleanCode)
      .maybeSingle();

    if (profile && profile.promo_code) {
      const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
      const info: ReferralCodeInfo = {
        clientId: profile.id,
        clientName: name,
        clientEmail: profile.email || '',
        clientPhone: profile.phone || '',
        code: profile.promo_code,
        discountPercent: 10,
        commissionPercent: 10,
        createdAt: new Date().toISOString()
      };
      // Cache it locally
      localCodes[profile.id] = info;
      saveLocalReferralCodes(localCodes);
      return info;
    }
  } catch (e) {
    // Ignore error
  }

  return null;
}

/**
 * Get referral code for a specific client ID.
 */
export async function getClientReferralCode(clientId: string): Promise<ReferralCodeInfo | null> {
  if (!clientId) return null;

  // 1. Check local cache
  const localCodes = getLocalReferralCodes();
  if (localCodes[clientId]) {
    return localCodes[clientId];
  }

  // 2. Query Supabase client_profiles
  try {
    const { data: profile } = await supabase
      .from('client_profiles')
      .select('id, first_name, last_name, email, phone, promo_code')
      .eq('id', clientId)
      .single();

    if (profile && profile.promo_code) {
      const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
      const info: ReferralCodeInfo = {
        clientId: profile.id,
        clientName: name,
        clientEmail: profile.email || '',
        clientPhone: profile.phone || '',
        code: profile.promo_code,
        discountPercent: 10,
        commissionPercent: 10,
        createdAt: new Date().toISOString()
      };
      localCodes[clientId] = info;
      saveLocalReferralCodes(localCodes);
      return info;
    }
  } catch (e) {
    // Ignore error
  }

  return null;
}

/**
 * Record a new sale made with a referral promo code.
 */
export async function recordReferralSale(saleData: {
  registrationId: string;
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  buyerClientId?: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  paymentStatus: string;
  promoCode: string;
  parrainInfo: ReferralCodeInfo;
}) {
  const commissionAmount = Math.round(saleData.coursePrice * 0.10); // 10% commission

  const newSale: ReferralSale = {
    id: saleData.registrationId || `ref_sale_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    registrationId: saleData.registrationId,
    courseId: saleData.courseId,
    courseTitle: saleData.courseTitle,
    coursePrice: saleData.coursePrice,
    buyerClientId: saleData.buyerClientId,
    buyerName: saleData.buyerName,
    buyerEmail: saleData.buyerEmail,
    buyerPhone: saleData.buyerPhone,
    paymentStatus: saleData.paymentStatus || 'pending',
    registeredAt: new Date().toISOString(),
    promoCode: saleData.promoCode,
    parrainClientId: saleData.parrainInfo.clientId,
    parrainName: saleData.parrainInfo.clientName,
    commissionAmount: commissionAmount
  };

  const sales = getLocalReferralSales();
  // Avoid duplicate registration entries
  const existingIndex = sales.findIndex(s => s.registrationId === saleData.registrationId && s.registrationId !== '');
  if (existingIndex >= 0) {
    sales[existingIndex] = newSale;
  } else {
    sales.push(newSale);
  }
  saveLocalReferralSales(sales);

  return newSale;
}

/**
 * Fetch all referral sales for a parrain client ID.
 * Merges local sales cache with Supabase registrations if promo_code is saved in registrations.
 */
export async function getParrainReferralSales(parrainClientId: string, parrainCode: string): Promise<{
  sales: ReferralSale[];
  totalReferredCount: number;
  totalSalesVolume: number;
  totalCommissionEarned: number;
}> {
  const localSales = getLocalReferralSales().filter(
    s => s.parrainClientId === parrainClientId || s.promoCode.toUpperCase() === parrainCode.toUpperCase()
  );

  // Also query Supabase registrations table for registrations with promo_code = parrainCode
  let dbSales: ReferralSale[] = [];
  try {
    const { data: regs } = await supabase
      .from('registrations')
      .select('id, client_id, course_id, participant_name, participant_email, participant_phone, payment_status, registered_at, promo_code, courses(id, title, price_fcfa)')
      .eq('promo_code', parrainCode);

    if (regs && regs.length > 0) {
      dbSales = regs.map((r: any) => {
        const coursePrice = r.courses?.price_fcfa || 0;
        return {
          id: r.id,
          registrationId: r.id,
          courseId: r.course_id,
          courseTitle: r.courses?.title || 'Formation',
          coursePrice: coursePrice,
          buyerClientId: r.client_id,
          buyerName: r.participant_name,
          buyerEmail: r.participant_email,
          buyerPhone: r.participant_phone,
          paymentStatus: r.payment_status || 'pending',
          registeredAt: r.registered_at,
          promoCode: r.promo_code,
          parrainClientId: parrainClientId,
          parrainName: '',
          commissionAmount: Math.round(coursePrice * 0.10)
        };
      });
    }
  } catch (e) {
    // Column might not exist in Supabase DB, fallback to localSales
  }

  // Combine and deduplicate sales by registrationId/buyerEmail+courseId
  const mergedMap = new Map<string, ReferralSale>();
  
  [...localSales, ...dbSales].forEach(sale => {
    const key = sale.registrationId || `${sale.buyerEmail}_${sale.courseId}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, sale);
    } else {
      // Prefer approved status or newer entry
      const existing = mergedMap.get(key)!;
      if (sale.paymentStatus === 'approved' && existing.paymentStatus !== 'approved') {
        mergedMap.set(key, sale);
      }
    }
  });

  const allSales = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );

  const totalReferredCount = allSales.length;
  const totalSalesVolume = allSales.reduce((sum, s) => sum + (s.coursePrice || 0), 0);
  const totalCommissionEarned = allSales.reduce((sum, s) => sum + (s.commissionAmount || 0), 0);

  return {
    sales: allSales,
    totalReferredCount,
    totalSalesVolume,
    totalCommissionEarned
  };
}
