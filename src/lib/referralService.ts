import { supabase } from './supabaseClient';
import { extractCoursePromoCodes, PromoCode } from './promoUtils';

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

  // 1. Try updating the dedicated 'promo_code' table in Supabase (upsert)
  try {
    const { error: upsertError } = await supabase
      .from('promo_code')
      .upsert({
        client_id: clientId,
        client_name: clientInfo.name,
        client_email: clientInfo.email,
        client_phone: clientInfo.phone || '',
        code: cleanCode,
        discount_percent: 10,
        commission_percent: 10,
        created_at: new Date().toISOString()
      }, { onConflict: 'client_id' });

    if (upsertError) {
      console.warn("Could not upsert into promo_code table:", upsertError.message);
    }
  } catch (err) {
    console.warn("Could not upsert into promo_code table:", err);
  }

  // 2. Try updating Supabase client_profiles table (with fallback if column doesn't exist)
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

  // 3. Automatically add this referral code to all courses (as a general non-quiz promo code)
  try {
    const { data: courses } = await supabase.from('courses').select('id, promo_codes, guide_text');
    if (courses && courses.length > 0) {
      for (const course of courses) {
        let coursePromos = extractCoursePromoCodes(course);
        // Remove existing referral code if present to update it
        coursePromos = coursePromos.filter(p => p.code !== cleanCode);
        coursePromos.push({
          code: cleanCode,
          discount_type: 'percentage',
          discount_value: 10, // Default 10%
          min_score: 0,
          max_score: 100,
          class_name: 'Parrainage',
          description: `Code commercial: ${clientInfo.name}`
        });
        await supabase.from('courses').update({ promo_codes: coursePromos }).eq('id', course.id);
      }
    }
  } catch (err) {
    console.error("Error auto-adding referral code to courses:", err);
  }

  return { success: true, code: cleanCode };
}

/**
 * Remove referral promo code from a client.
 */
export async function removeClientReferralCode(clientId: string): Promise<boolean> {
  const existingCodes = getLocalReferralCodes();
  const codeToRemove = existingCodes[clientId]?.code;
  delete existingCodes[clientId];
  saveLocalReferralCodes(existingCodes);

  // Delete from dedicated 'promo_code' table
  try {
    if (!codeToRemove) {
      // Try to fetch it from DB just in case
      const { data: dbPromo } = await supabase.from('promo_code').select('code').eq('client_id', clientId).maybeSingle();
      if (dbPromo && dbPromo.code) {
        // We'll use this below
      }
    }
    
    await supabase
      .from('promo_code')
      .delete()
      .eq('client_id', clientId);
  } catch (e) {
    // Ignore error
  }

  // Fallback update on client_profiles
  try {
    const { data: profile } = await supabase.from('client_profiles').select('promo_code').eq('id', clientId).maybeSingle();
    const code = codeToRemove || profile?.promo_code;
    
    await supabase
      .from('client_profiles')
      .update({ promo_code: null })
      .eq('id', clientId);
      
    // Remove from courses
    if (code) {
      const { data: courses } = await supabase.from('courses').select('id, promo_codes, guide_text');
      if (courses && courses.length > 0) {
        for (const course of courses) {
          const coursePromos = extractCoursePromoCodes(course);
          const filteredPromos = coursePromos.filter(p => p.code !== code);
          if (filteredPromos.length !== coursePromos.length) {
            await supabase.from('courses').update({ promo_codes: filteredPromos }).eq('id', course.id);
          }
        }
      }
    }
  } catch (e) {
    // Ignore error if column not present
  }

  return true;
}

export async function getAllReferralCodes(): Promise<Record<string, ReferralCodeInfo>> {
  const localCodes = getLocalReferralCodes();
  let updated = false;

  // 1. Fetch from the dedicated 'promo_code' table
  try {
    const { data: dbCodes } = await supabase
      .from('promo_code')
      .select('*');

    if (dbCodes && dbCodes.length > 0) {
      dbCodes.forEach((c: any) => {
        const info: ReferralCodeInfo = {
          clientId: c.client_id,
          clientName: c.client_name,
          clientEmail: c.client_email,
          clientPhone: c.client_phone,
          code: c.code,
          discountPercent: c.discount_percent || 10,
          commissionPercent: c.commission_percent || 10,
          createdAt: c.created_at
        };
        localCodes[c.client_id] = info;
        updated = true;
      });
    }
  } catch (e) {
    console.warn("Could not fetch from promo_code table:", e);
  }

  // 2. Fetch from client_profiles table as fallback/merge
  try {
    const { data: profiles } = await supabase
      .from('client_profiles')
      .select('id, first_name, last_name, email, phone, promo_code')
      .not('promo_code', 'is', null);

    if (profiles && profiles.length > 0) {
      profiles.forEach(p => {
        if (p.promo_code && !localCodes[p.id]) {
          const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
          const info: ReferralCodeInfo = {
            clientId: p.id,
            clientName: name,
            clientEmail: p.email || '',
            clientPhone: p.phone || '',
            code: p.promo_code,
            discountPercent: 10,
            commissionPercent: 10,
            createdAt: new Date().toISOString()
          };
          localCodes[p.id] = info;
          updated = true;
        }
      });
    }
  } catch (e) {
    // Column might not exist or network error, fallback
  }

  if (updated) {
    saveLocalReferralCodes(localCodes);
  }
  
  return localCodes;
}

export async function findReferralCode(code: string): Promise<ReferralCodeInfo | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  // 1. Check local cache
  const localCodes = getLocalReferralCodes();
  const match = Object.values(localCodes).find(c => c.code === cleanCode);
  if (match) return match;

  // 2. Query dedicated 'promo_code' table
  try {
    const { data: dbPromo } = await supabase
      .from('promo_code')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();

    if (dbPromo) {
      const info: ReferralCodeInfo = {
        clientId: dbPromo.client_id,
        clientName: dbPromo.client_name,
        clientEmail: dbPromo.client_email,
        clientPhone: dbPromo.client_phone,
        code: dbPromo.code,
        discountPercent: dbPromo.discount_percent || 10,
        commissionPercent: dbPromo.commission_percent || 10,
        createdAt: dbPromo.created_at
      };
      localCodes[dbPromo.client_id] = info;
      saveLocalReferralCodes(localCodes);
      return info;
    }
  } catch (e) {
    // Ignore error
  }

  // 3. Query Supabase client_profiles as fallback
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

  // 2. Query dedicated 'promo_code' table
  try {
    const { data: dbPromo } = await supabase
      .from('promo_code')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (dbPromo) {
      const info: ReferralCodeInfo = {
        clientId: dbPromo.client_id,
        clientName: dbPromo.client_name,
        clientEmail: dbPromo.client_email,
        clientPhone: dbPromo.client_phone,
        code: dbPromo.code,
        discountPercent: dbPromo.discount_percent || 10,
        commissionPercent: dbPromo.commission_percent || 10,
        createdAt: dbPromo.created_at
      };
      localCodes[clientId] = info;
      saveLocalReferralCodes(localCodes);
      return info;
    }
  } catch (e) {
    // Ignore error
  }

  // 3. Query Supabase client_profiles as fallback
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
export async function getAllReferralSales(): Promise<ReferralSale[]> {
  const localSales = getLocalReferralSales();
  
  try {
    const { data: regs } = await supabase
      .from('registrations')
      .select('id, client_id, course_id, participant_name, participant_email, participant_phone, payment_status, registered_at, promo_code, courses(id, title, price_fcfa)')
      .not('promo_code', 'is', null);

    if (regs && regs.length > 0) {
      const dbSales: ReferralSale[] = regs.map((r: any) => {
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
          parrainClientId: '', // Will be matched locally or by promo_code lookup
          parrainName: '',
          commissionAmount: Math.round(coursePrice * 0.10)
        };
      });

      const mergedMap = new Map<string, ReferralSale>();
      
      [...localSales, ...dbSales].forEach(sale => {
        const key = sale.registrationId || `${sale.buyerEmail}_${sale.courseId}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, sale);
        } else {
          const existing = mergedMap.get(key)!;
          if (sale.paymentStatus === 'approved' && existing.paymentStatus !== 'approved') {
            mergedMap.set(key, sale);
          }
        }
      });
      
      const allSales = Array.from(mergedMap.values());
      saveLocalReferralSales(allSales);
      return allSales;
    }
  } catch (e) {
    // Fallback to local
  }
  return localSales;
}

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
