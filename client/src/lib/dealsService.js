// Deals Service - Supabase integration for saving/loading deals
import { supabase } from './supabase';

// Helper: get current authenticated user id
async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user?.id || null;
}

/**
 * Save a deal to Supabase
 * @param {Object} dealData - The complete deal data to save
 * @returns {Object} - The saved deal with ID
 */
export async function saveDeal(dealData) {
  const {
    dealId,
    address,
    units,
    purchasePrice,
    dealStructure,
    parsedData,        // Original parsed JSON from Claude
    scenarioData,      // User's financing/assumptions choices
    marketCapRate,     // LLM-derived cap rate data
    rentcastData,      // RentCast API data (if fetched)
    costsegData,       // Cost seg analysis (if ran)
    images,            // NEW: Array of extracted property images
    brokerName,
    brokerPhone,
    brokerEmail,
    notes,
    latitude,          // NEW: Geocoded latitude
    longitude          // NEW: Geocoded longitude
  } = dealData;

  const userId = await getCurrentUserId();

  // Check if deal already exists (update vs insert)
  let existing = null;
  try {
    const { data } = await supabase
      .from('deals')
      .select('id')
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .single();
    existing = data || null;
  } catch (e) {
    // Fallback if user_id column doesn't exist yet
    const { data } = await supabase
      .from('deals')
      .select('id')
      .eq('deal_id', dealId)
      .single();
    existing = data || null;
  }

  const dealRecord = {
    deal_id: dealId,
    address: address || parsedData?.property?.address || 'Unknown Address',
    units: units || parsedData?.property?.units || 0,
    purchase_price: purchasePrice || parsedData?.pricing_financing?.price || 0,
    deal_structure: dealStructure || 'Traditional',
    parsed_data: parsedData,
    scenario_data: scenarioData,
    market_cap_rate: marketCapRate,
    rentcast_data: rentcastData,
    costseg_data: costsegData,
    images: images || [],  // NEW: Store extracted images
    broker_name: brokerName,
    broker_phone: brokerPhone,
    broker_email: brokerEmail,
    notes: notes,
    latitude: latitude,      // NEW: Store geocoded coordinates
    longitude: longitude,    // NEW: Store geocoded coordinates
    pipeline_status: 'pipeline',
    updated_at: new Date().toISOString()
  };

  // Attach user scoping if available
  if (userId) {
    dealRecord.user_id = userId;
  }

  let result;
  
  if (existing) {
    // Update existing deal
    const { data, error } = await supabase
      .from('deals')
      .update(dealRecord)
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    result = data;
  } else {
    // Insert new deal
    dealRecord.created_at = new Date().toISOString();
    
    // Attempt insert with user_id; fallback if column missing
    let insertError, insertData;
    const attempt = await supabase
      .from('deals')
      .insert(dealRecord)
      .select()
      .single();
    insertError = attempt.error;
    insertData = attempt.data;
    if (insertError && (insertError.message || '').toLowerCase().includes('column "user_id"')) {
      const fallback = await supabase
        .from('deals')
        .insert({
          ...dealRecord,
          user_id: undefined
        })
        .select()
        .single();
      insertError = fallback.error;
      insertData = fallback.data;
    }
    const error = insertError;
    const data = insertData;
    
    if (error) throw error;
    result = data;
  }

  return result;
}

/**
 * Load a deal from Supabase by deal_id
 * @param {string} dealId - The deal ID to load
 * @returns {Object|null} - The deal data or null if not found
 */
export async function loadDeal(dealId) {
  const userId = await getCurrentUserId();
  let data, error;
  try {
    const resp = await supabase
      .from('deals')
      .select('*')
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .single();
    data = resp.data;
    error = resp.error;
  } catch (e) {
    const resp = await supabase
      .from('deals')
      .select('*')
      .eq('deal_id', dealId)
      .single();
    data = resp.data;
    error = resp.error;
  }

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw error;
  }

  if (!data) return null;

  // Transform to camelCase format for frontend
  return {
    dealId: data.deal_id,
    address: data.address,
    units: data.units,
    purchasePrice: data.purchase_price,
    dealStructure: data.deal_structure,
    parsedData: data.parsed_data,
    scenarioData: data.scenario_data,
    marketCapRate: data.market_cap_rate,
    rentcastData: data.rentcast_data,
    costsegData: data.costseg_data,
    images: data.images || [],
    brokerName: data.broker_name,
    brokerPhone: data.broker_phone,
    brokerEmail: data.broker_email,
    notes: data.notes,
    pipelineStatus: data.pipeline_status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    // Extract key metrics from scenario_data
    dayOneCashFlow: data.scenario_data?.calculations?.dayOneCashFlow || 0,
    stabilizedCashFlow: data.scenario_data?.calculations?.stabilizedCashFlow || 0,
    refiValue: data.scenario_data?.calculations?.refiValue || 0,
    cashOutRefiAmount: data.scenario_data?.calculations?.cashOutRefiAmount || 0,
    userTotalInPocket: data.scenario_data?.calculations?.userTotalInPocket || 0
  };
}

/**
 * Load all deals from pipeline
 * @returns {Array} - Array of deal summaries
 */
export async function loadPipelineDeals() {
  const userId = await getCurrentUserId();
  let data, error;
  try {
    const resp = await supabase
      .from('deals')
      .select(`
        id,
        deal_id,
        address,
        units,
        purchase_price,
        deal_structure,
        broker_name,
        broker_phone,
        broker_email,
        pipeline_status,
        created_at,
        updated_at,
        scenario_data,
        parsed_data,
        latitude,
        longitude
      `)
      .eq('pipeline_status', 'pipeline')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    data = resp.data;
    error = resp.error;
  } catch (e) {
    const resp = await supabase
      .from('deals')
      .select(`
        id,
        deal_id,
        address,
        units,
        purchase_price,
        deal_structure,
        broker_name,
        broker_phone,
        broker_email,
        pipeline_status,
        created_at,
        updated_at,
        scenario_data,
        parsed_data,
        latitude,
        longitude
      `)
      .eq('pipeline_status', 'pipeline')
      .order('created_at', { ascending: false });
    data = resp.data;
    error = resp.error;
  }

  if (error) throw error;

  // Transform to match existing pipeline format
  return (data || []).map(deal => ({
    dealId: deal.deal_id,
    address: deal.address,
    units: deal.units,
    purchasePrice: deal.purchase_price,
    dealStructure: deal.deal_structure,
    brokerName: deal.broker_name,
    brokerPhone: deal.broker_phone,
    brokerEmail: deal.broker_email,
    pushedAt: deal.created_at,
    latitude: deal.latitude,
    longitude: deal.longitude,
    // Extract key metrics from scenario_data for display
    dayOneCashFlow: deal.scenario_data?.calculations?.dayOneCashFlow || 0,
    stabilizedCashFlow: deal.scenario_data?.calculations?.stabilizedCashFlow || 0,
    refiValue: deal.scenario_data?.calculations?.refiValue || 0,
    cashOutRefiAmount: deal.scenario_data?.calculations?.cashOutRefiAmount || 0,
    userTotalInPocket: deal.scenario_data?.calculations?.userTotalInPocket || 0,
    postRefiCashFlow: deal.scenario_data?.calculations?.postRefiCashFlow || 0,
    // Keep full data for view/LOI
    fullScenarioData: deal.scenario_data,
    fullParsedData: deal.parsed_data
  }));
}

/**
 * Save a batch of Rapid Fire deals into Supabase as a separate queue.
 * These are lightweight leads (from the Rapid Fire tool), not fully underwritten deals.
 * They are stored in the same `deals` table with pipeline_status = 'rapidfire'.
 */
export async function saveRapidFireDeals(rapidFireDeals) {
  if (!Array.isArray(rapidFireDeals) || rapidFireDeals.length === 0) return;

  const nowIso = new Date().toISOString();

  const rows = rapidFireDeals.map((deal, index) => {
    const baseName = (deal.name || 'rapidfire-deal').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'rapidfire-deal';
    const dealId = `${baseName}-${Date.now()}-${index}`;

    return {
      deal_id: dealId,
      address: deal.name || 'Rapid Fire Deal',
      units: deal.units || 0,
      purchase_price: deal.totalPrice || 0,
      deal_structure: 'Rapid Fire Queue',
      listing_url: deal.listingUrl || null,
      // Store all Rapid Fire metrics in parsed_data.rapidfire for later use.
      parsed_data: {
        rapidfire: {
          name: deal.name || '',
          city: deal.city || '',
          state: deal.state || '',
          ownerName: deal.ownerName || '',
          units: deal.units || null,
          totalPrice: deal.totalPrice || null,
          pricePerUnit: deal.pricePerUnit || null,
          brokerCapRate: deal.brokerCapRate || null,
          noi: deal.noi || null,
          calculatedCapRate: deal.calculatedCapRate || null,
          dscr: deal.dscr || null,
          cashOnCash: deal.cashOnCash || null,
          monthlyCashFlow: deal.monthlyCashFlow || null,
          listingUrl: deal.listingUrl || null,
          verdict: deal.verdict || null,
          verdictReasons: deal.verdictReasons || []
        }
      },
      pipeline_status: 'rapidfire',
      created_at: nowIso,
      updated_at: nowIso
    };
  });

  const { error } = await supabase
    .from('deals')
    .insert(rows);

  if (error) throw error;
}

/**
 * Load all Rapid Fire queue deals from Supabase.
 * These are deals pushed from the Rapid Fire screen with pipeline_status = 'rapidfire'.
 */
export async function loadRapidFireDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      deal_id,
      address,
      units,
      purchase_price,
      listing_url,
      parsed_data,
      created_at
    `)
    .eq('pipeline_status', 'rapidfire')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(deal => {
    const rf = (deal.parsed_data && deal.parsed_data.rapidfire) || {};
    return {
      dealId: deal.deal_id,
      name: rf.name || deal.address || 'Rapid Fire Deal',
      address: deal.address || rf.name || 'Rapid Fire Deal',
      city: rf.city || '',
      state: rf.state || '',
      units: deal.units || rf.units || 0,
      totalPrice: rf.totalPrice || deal.purchase_price || 0,
      pricePerUnit: rf.pricePerUnit || null,
      brokerCapRate: rf.brokerCapRate || null,
      noi: rf.noi || null,
      calculatedCapRate: rf.calculatedCapRate || null,
      dscr: rf.dscr || null,
      cashOnCash: rf.cashOnCash || null,
      monthlyCashFlow: rf.monthlyCashFlow || null,
      listingUrl: rf.listingUrl || deal.listing_url || null,
      verdict: rf.verdict || null,
      verdictReasons: rf.verdictReasons || [],
      pushedAt: deal.created_at
    };
  });
}

/**
 * Load full deal data for Results page
 * @param {string} dealId - The deal ID to load
 * @returns {Object} - Full deal data ready for Results page
 */
export async function loadDealForResults(dealId) {
  const userId = await getCurrentUserId();
  let data, error;
  try {
    const resp = await supabase
      .from('deals')
      .select('*')
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .single();
    data = resp.data;
    error = resp.error;
  } catch (e) {
    const resp = await supabase
      .from('deals')
      .select('*')
      .eq('deal_id', dealId)
      .single();
    data = resp.data;
    error = resp.error;
  }

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  // Return in format expected by Results page
  return {
    dealId: data.deal_id,
    parsedData: data.parsed_data,
    scenarioData: data.scenario_data,
    marketCapRate: data.market_cap_rate,
    rentcastData: data.rentcast_data,
    costsegData: data.costseg_data,
    address: data.address,
    units: data.units,
    purchasePrice: data.purchase_price,
    dealStructure: data.deal_structure,
    brokerName: data.broker_name,
    brokerPhone: data.broker_phone,
    brokerEmail: data.broker_email
  };
}

/**
 * Delete a deal from Supabase
 * @param {string} dealId - The deal ID to delete
 */
export async function deleteDeal(dealId) {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('deal_id', dealId);

  if (error) throw error;
}

/**
 * Update deal pipeline status
 * @param {string} dealId - The deal ID
 * @param {string} status - New status: 'pipeline', 'archived', 'closed'
 */
export async function updateDealStatus(dealId, status) {
  const { error } = await supabase
    .from('deals')
    .update({ 
      pipeline_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('deal_id', dealId);

  if (error) throw error;
}

/**
 * Update deal notes
 * @param {string} dealId - The deal ID
 * @param {string} notes - New notes
 */
export async function updateDealNotes(dealId, notes) {
  const { error } = await supabase
    .from('deals')
    .update({ 
      notes: notes,
      updated_at: new Date().toISOString()
    })
    .eq('deal_id', dealId);

  if (error) throw error;
}

/**
 * Save Due Diligence data for a deal
 * @param {string} dealId - The deal ID
 * @param {Object} ddData - Due diligence data to save
 */
export async function saveDueDiligenceData(dealId, ddData) {
  const { error } = await supabase
    .from('deals')
    .update({ 
      due_diligence_data: ddData,
      updated_at: new Date().toISOString()
    })
    .eq('deal_id', dealId);

  if (error) throw error;
}

/**
 * Load Due Diligence data for a deal
 * @param {string} dealId - The deal ID
 * @returns {Object|null} - DD data or null
 */
export async function loadDueDiligenceData(dealId) {
  const { data, error } = await supabase
    .from('deals')
    .select('due_diligence_data')
    .eq('deal_id', dealId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data?.due_diligence_data || null;
}

// ============================================================================
// Profile Functions
// ============================================================================

/**
 * Load user profile from Supabase
 * @returns {Object|null} - Profile data or null
 */
export async function loadProfile() {
  const userId = await getCurrentUserId();
  let data, error;
  if (userId) {
    const resp = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    data = resp.data;
    error = resp.error;
  } else {
    const resp = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .single();
    data = resp.data;
    error = resp.error;
  }

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  if (!data) return null;

  // Transform to camelCase for frontend
  return {
    id: data.id,
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    phone: data.phone || '',
    email: data.email || '',
    company: data.company || '',
    title: data.title || '',
    city: data.city || '',
    state: data.state || ''
  };
}

/**
 * Save user profile to Supabase
 * @param {Object} profile - Profile data to save
 */
export async function saveProfile(profile) {
  const userId = await getCurrentUserId();
  // First check if profile exists for current user
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  const profileRecord = {
    first_name: profile.firstName,
    last_name: profile.lastName,
    phone: profile.phone,
    email: profile.email,
    company: profile.company,
    title: profile.title,
    city: profile.city,
    state: profile.state,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    // Update existing profile
    const { error } = await supabase
      .from('profiles')
      .update(profileRecord)
      .eq('id', existing.id);
    
    if (error) throw error;
  } else {
    // Insert new profile
    profileRecord.created_at = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .insert({ ...profileRecord, id: userId });
    
    if (error) throw error;
  }
}

export default {
  saveDeal,
  loadDeal,
  loadPipelineDeals,
  loadRapidFireDeals,
  loadDealForResults,
  deleteDeal,
  updateDealStatus,
  updateDealNotes,
  saveDueDiligenceData,
  loadDueDiligenceData,
  loadProfile,
  saveProfile,
  saveRapidFireDeals
};
