// Deals Service - Supabase integration for saving/loading deals
import { supabase } from './supabase';
import { geocodeAddress as googleGeocodeAddress } from '../utils/geocode';

// Helper: get current authenticated user id
async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user?.id || null;
}

// Nominatim/Google both choke on a few common real-world address quirks:
// address ranges ("1611-1629 Fairfax Rd") and a literal "(Copy)" suffix left
// over from duplicating a deal. Strip those before geocoding so the address
// actually resolves instead of silently failing.
function normalizeAddressForGeocoding(address) {
  if (!address) return address;
  return address
    .replace(/\s*\(copy(?:\s*\d+)?\)\s*/gi, ' ') // "123 Main St (Copy)" -> "123 Main St"
    .replace(/^(\d+)\s*-\s*\d+(\s)/, '$1$2')     // "1611-1629 Fairfax Rd" -> "1611 Fairfax Rd"
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple geocoder using Nominatim (no external dependencies)
async function nominatimGeocode(address) {
  if (!address || !address.trim()) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&limit=1&countrycodes=us`,
      { headers: { 'User-Agent': 'DealSniper/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
    }
  } catch (e) {
    console.warn('Nominatim geocode failed:', e);
  }
  return null;
}

/**
 * Geocode an address trying Google Maps first (handles messy/range addresses
 * much better) and falling back to Nominatim if Google is unavailable (e.g.
 * REACT_APP_GOOGLE_MAPS_KEY not configured in this environment, or the key
 * doesn't have the Geocoding API enabled) or returns no result. Always
 * normalizes the address first. If the full street address still can't be
 * resolved (Nominatim in particular struggles with rural/highway-route
 * addresses like "12800 Texas 110"), falls back to geocoding just the
 * city/state so the property still gets an approximate pin instead of
 * disappearing from the map entirely. Exported so callers like
 * ResultsPageV2's push-to-pipeline flow get the same reliability.
 */
export async function robustGeocodeAddress(rawAddress) {
  const address = normalizeAddressForGeocoding(rawAddress);
  if (!address) return null;
  try {
    const fromGoogle = await googleGeocodeAddress(address);
    if (fromGoogle && fromGoogle.latitude && fromGoogle.longitude) return fromGoogle;
  } catch (e) {
    console.warn('Google geocode failed, falling back to Nominatim:', e);
  }
  const fromNominatim = await nominatimGeocode(address);
  if (fromNominatim) return fromNominatim;

  // Last resort: strip the street portion and try just "City, ST" so the
  // pin lands approximately right instead of not showing up at all. Handles
  // "City, ST", "City, ST 12345" AND "City, ST, 12345" (comma before the zip
  // — the previous regex only handled a space there and silently matched
  // nothing for addresses formatted with a comma, e.g. "Danville, VA, 24541").
  const cityStateMatch = address.match(/([^,]+),\s*([A-Z]{2})\s*,?\s*\d{0,5}$/);
  if (cityStateMatch) {
    const cityState = `${cityStateMatch[1].trim()}, ${cityStateMatch[2]}`;
    if (cityState !== address) {
      console.warn(`Full address geocode failed for "${address}", trying city-level fallback: "${cityState}"`);
      return nominatimGeocode(cityState);
    }
  }
  return null;
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

  // Auto-geocode if no coordinates provided
  let finalLat = latitude;
  let finalLng = longitude;
  if (!finalLat || !finalLng) {
    const fullAddress = address || parsedData?.property?.address || '';
    if (fullAddress && fullAddress !== 'Unknown Address') {
      const coords = await robustGeocodeAddress(fullAddress);
      if (coords) {
        finalLat = coords.latitude;
        finalLng = coords.longitude;
      }
    }
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
    images: images || [],
    broker_name: brokerName,
    broker_phone: brokerPhone,
    broker_email: brokerEmail,
    notes: notes,
    latitude: finalLat,
    longitude: finalLng,
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
/**
 * Transform a raw `deals` table row (snake_case, as returned by Supabase)
 * into the camelCase shape the rest of the app expects. Exported so the
 * public investor pitch-deck view (which fetches a deal via a backend
 * proxy rather than the authenticated Supabase client) can produce an
 * identical `deal` object without duplicating this mapping.
 */
export function mapDealRow(data) {
  if (!data) return null;
  const rawImages = Array.isArray(data.images) ? data.images : [];
  const parsedImages = Array.isArray(data.parsed_data?.images) ? data.parsed_data.images : [];
  const mergedImages = [...rawImages, ...parsedImages];
  const calculations = data.scenario_data?.calculations || {};

  return {
    dealId: data.deal_id,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    units: data.units,
    purchasePrice: data.purchase_price,
    dealStructure: data.deal_structure,
    dealStage: data.deal_stage || 'underwritten',
    stageChangedAt: data.stage_changed_at,
    deathReason: data.death_reason,
    parsedData: data.parsed_data,
    scenarioData: data.scenario_data,
    businessPlanMarkdown: data.business_plan_markdown,
    businessPlanData: data.business_plan_data,
    businessPlanGeneratedAt: data.business_plan_generated_at,
    marketCapRate: data.market_cap_rate,
    rentcastData: data.rentcast_data,
    costsegData: data.costseg_data,
    images: mergedImages,
    brokerName: data.broker_name,
    brokerPhone: data.broker_phone,
    brokerEmail: data.broker_email,
    notes: data.notes,
    pipelineStatus: data.pipeline_status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    // Extract key metrics from scenario_data
    dayOneCashFlow: calculations.dayOneCashFlow || calculations.day_one_cash_flow || calculations.monthlyCashFlow || calculations.monthly_cash_flow || 0,
    stabilizedCashFlow: calculations.stabilizedCashFlow || calculations.stabilized_cash_flow || 0,
    refiValue: calculations.refiValue || calculations.refi_value || calculations.terminalValue || calculations.terminal_value || 0,
    cashOutRefiAmount: calculations.cashOutRefiAmount || calculations.cash_out_refi_amount || 0,
    userTotalInPocket: calculations.userTotalInPocket || calculations.user_total_in_pocket || 0
  };
}

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

  return mapDealRow(data);
}

/**
 * Load all deals from pipeline
 * @returns {Array} - Array of deal summaries
 */
export async function loadPipelineDeals() {
  const userId = await getCurrentUserId();
  let data, error;
  // Only filter by user_id when available; otherwise query without user filter
  const baseSelect = `
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
        longitude,
        deal_stage,
        stage_changed_at,
        death_reason,
        images
      `;
  // preferred_return_pct / gp_promote_pct are optional columns (added by a
  // migration the user may not have run yet) — request them separately so a
  // missing column never breaks loading every other deal list in the app.
  const dealTermsSelect = `${baseSelect}, preferred_return_pct, gp_promote_pct`;

  let query = supabase
    .from('deals')
    .select(dealTermsSelect)
    .eq('pipeline_status', 'pipeline')
    .order('created_at', { ascending: false });
  if (userId) {
    query = query.eq('user_id', userId);
  }
  let resp = await query;
  data = resp.data;
  error = resp.error;

  if (error) {
    // Fall back to the base column set (e.g. deal terms migration not run yet)
    let fallbackQuery = supabase
      .from('deals')
      .select(baseSelect)
      .eq('pipeline_status', 'pipeline')
      .order('created_at', { ascending: false });
    if (userId) fallbackQuery = fallbackQuery.eq('user_id', userId);
    const fallbackResp = await fallbackQuery;
    data = fallbackResp.data;
    error = fallbackResp.error;
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
    // Sponsor-set deal terms (used to default investor allocations)
    preferredReturnPct: deal.preferred_return_pct ?? 8,
    gpPromotePct: deal.gp_promote_pct ?? 20,
    // Pipeline CRM stage tracking
    deal_stage: deal.deal_stage || 'underwritten',
    stage_changed_at: deal.stage_changed_at,
    death_reason: deal.death_reason,
    // Property images
    images: deal.images || [],
    // Keep full data for view/LOI
    fullScenarioData: deal.scenario_data,
    fullParsedData: deal.parsed_data
  }));
}

/**
 * Backfill geocoding for existing pipeline deals that are missing coordinates.
 * Called automatically from the map when deals without coords are found.
 */
export async function geocodeExistingDeals() {
  const userId = await getCurrentUserId();
  
  // Fetch deals missing coordinates
  let query = supabase
    .from('deals')
    .select('deal_id, address, parsed_data, latitude, longitude')
    .eq('pipeline_status', 'pipeline');
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data: deals, error } = await query;
  if (error || !deals) return 0;

  const needsGeocode = deals.filter(d => !d.latitude || !d.longitude);
  if (needsGeocode.length === 0) return 0;

  console.log(`Geocoding ${needsGeocode.length} deals missing coordinates...`);

  let updated = 0;

  for (const deal of needsGeocode) {
    const addr = deal.address || deal.parsed_data?.property?.address || '';
    if (!addr || addr === 'Unknown Address') continue;

    try {
      const coords = await robustGeocodeAddress(addr);
      if (coords && coords.latitude && coords.longitude) {
        const { error: updateErr } = await supabase
          .from('deals')
          .update({ latitude: coords.latitude, longitude: coords.longitude })
          .eq('deal_id', deal.deal_id);
        if (!updateErr) updated++;
      }
    } catch (e) {
      console.warn(`Geocode failed for ${addr}:`, e);
    }
    // Throttle: 1.1s between requests to respect Nominatim usage policy
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`Geocoded ${updated}/${needsGeocode.length} deals`);
  return updated;
}

// Pipeline pins are re-derived from the `deals` table on every map load, so
// removing one from the map (a plain client-side delete) always reappeared
// on the next reload/deployment since nothing was actually persisted. These
// two functions let a user "dismiss" a pipeline deal's pin permanently
// without touching the deal itself. Requires the map_dismissed_pins table
// (backend/migrations/create_map_dismissed_pins.sql) — no-ops gracefully
// (empty set / silently skip) if that migration hasn't been run yet.
export async function getDismissedPipelinePinIds() {
  const userId = await getCurrentUserId();
  if (!userId) return new Set();
  try {
    const { data, error } = await supabase
      .from('map_dismissed_pins')
      .select('deal_id')
      .eq('user_id', userId);
    if (error) return new Set();
    return new Set((data || []).map(r => r.deal_id));
  } catch (e) {
    return new Set();
  }
}

export async function dismissPipelinePin(dealId) {
  const userId = await getCurrentUserId();
  if (!userId || !dealId) return false;
  try {
    const { error } = await supabase
      .from('map_dismissed_pins')
      .upsert({ user_id: userId, deal_id: dealId }, { onConflict: 'user_id,deal_id' });
    return !error;
  } catch (e) {
    console.warn('Failed to dismiss pipeline pin (has the map_dismissed_pins migration been run?):', e);
    return false;
  }
}

/**
 * Save a batch of Rapid Fire deals into Supabase as a separate queue.
 * These are lightweight leads (from the Rapid Fire tool), not fully underwritten deals.
 * They are stored in the same `deals` table with pipeline_status = 'rapidfire'.
 * NOW INCLUDES GEOCODING for each deal so they appear on the map.
 */
export async function saveRapidFireDeals(rapidFireDeals) {
  if (!Array.isArray(rapidFireDeals) || rapidFireDeals.length === 0) return;

  const nowIso = new Date().toISOString();

  // Geocode function using Nominatim
  const geocodeAddress = async (address) => {
    if (!address || !address.trim()) return { lat: null, lng: null };
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&addressdetails=1`;
      const res = await fetch(url, { 
        headers: { 'Accept-Language': 'en-US' }
      });
      
      if (!res.ok) return { lat: null, lng: null };
      
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const best = data[0];
        const lat = parseFloat(best.lat);
        const lng = parseFloat(best.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    } catch (e) {
      console.error('Geocoding failed for:', address, e);
    }
    return { lat: null, lng: null };
  };

  // Geocode all deals in parallel with throttling
  console.log(`🗺️ Starting geocoding for ${rapidFireDeals.length} rapid fire deals...`);
  const geocodedDeals = [];
  for (let i = 0; i < rapidFireDeals.length; i++) {
    const deal = rapidFireDeals[i];
    const address = deal.name || 'Rapid Fire Deal';
    
    console.log(`🗺️ Geocoding [${i + 1}/${rapidFireDeals.length}]: ${address}`);
    const { lat, lng } = await geocodeAddress(address);
    
    geocodedDeals.push({ ...deal, latitude: lat, longitude: lng });
    
    // Throttle to ~1 request per second to respect Nominatim usage policy
    if (i < rapidFireDeals.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }
  console.log(`✅ Geocoding complete for ${geocodedDeals.length} deals`);

  let rows = geocodedDeals.map((deal, index) => {
    const baseName = (deal.name || 'rapidfire-deal').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'rapidfire-deal';
    const dealId = `${baseName}-${Date.now()}-${index}`;

    return {
      deal_id: dealId,
      address: deal.name || 'Rapid Fire Deal',
      units: deal.units || 0,
      purchase_price: deal.totalPrice || 0,
      deal_structure: 'Rapid Fire Queue',
      listing_url: deal.listingUrl || null,
      latitude: deal.latitude,
      longitude: deal.longitude,
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

  // Attach current user id to ensure per-member scoping
  const userId = await getCurrentUserId();
  if (userId) {
    rows = rows.map(r => ({ ...r, user_id: userId }));
  }

  // Attempt insert with user_id; fallback if column missing
  let insertError;
  const attempt = await supabase
    .from('deals')
    .insert(rows);
  insertError = attempt.error;
  if (insertError && (insertError.message || '').toLowerCase().includes('column "user_id"')) {
    const fallback = await supabase
      .from('deals')
      .insert(rows.map(r => { const { user_id, ...rest } = r; return rest; }));
    insertError = fallback.error;
  }

  if (insertError) throw insertError;
}

/**
 * Load all Rapid Fire queue deals from Supabase.
 * These are deals pushed from the Rapid Fire screen with pipeline_status = 'rapidfire'.
 */
export async function loadRapidFireDeals() {
  const userId = await getCurrentUserId();
  let data, error;
  const baseSelect = `
        deal_id,
        address,
        units,
        purchase_price,
        listing_url,
        parsed_data,
        created_at
      `;
  let query = supabase
    .from('deals')
    .select(baseSelect)
    .eq('pipeline_status', 'rapidfire')
    .order('created_at', { ascending: false });
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const resp = await query;
  data = resp.data;
  error = resp.error;

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
    images: data.images || data.parsed_data?.images || [],
    address: data.address,
    units: data.units,
    purchasePrice: data.purchase_price,
    dealStructure: data.deal_structure,
    dealStage: data.deal_stage || 'underwritten',
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
 * Bulk delete multiple deals from Supabase
 * @param {string[]} dealIds - Array of deal IDs to delete
 */
export async function bulkDeleteDeals(dealIds) {
  if (!dealIds || dealIds.length === 0) return;
  const { error } = await supabase
    .from('deals')
    .delete()
    .in('deal_id', dealIds);

  if (error) throw error;
}

/**
 * Duplicate a deal — loads it and saves a copy with a new ID
 * @param {string} dealId - The source deal ID
 * @returns {Object} - The duplicated deal
 */
export async function duplicateDeal(dealId) {
  const original = await loadDeal(dealId);
  if (!original) throw new Error('Deal not found');

  const newDealId = crypto.randomUUID();
  const duplicatedDeal = {
    ...original,
    dealId: newDealId,
    address: `${original.address || 'Deal'} (Copy)`,
    notes: original.notes ? `Copied from ${original.dealId}\n${original.notes}` : `Copied from ${original.dealId}`,
  };

  await saveDeal(duplicatedDeal);
  return duplicatedDeal;
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
 * Update deal with arbitrary fields
 * @param {string} dealId - The deal ID
 * @param {Object} updates - Object with fields to update
 */
export async function updateDeal(dealId, updates) {
  const userId = await getCurrentUserId();
  let query = supabase
    .from('deals')
    .update({ 
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('deal_id', dealId);
  if (userId) query = query.eq('user_id', userId);
  const { error } = await query;

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
    state: data.state || '',
    brandLogoUrl: data.brand_logo_url || '',
    brandPrimaryColor: data.brand_primary_color || '#2563eb',
    brandSecondaryColor: data.brand_secondary_color || '#1A1A1A',
    brandAccentColor: data.brand_accent_color || '#0052FF',
    brandCompanyName: data.brand_company_name || '',
    brandLetterheadText: data.brand_letterhead_text || '',
    googleSheetId: data.google_sheet_id || '',
    googleSheetTab: data.google_sheet_tab || 'Model',
    // Only ever set by the Stripe webhook after a real checkout completes —
    // the canonical "has this account actually paid" signal used to gate
    // access post-login (see DashboardPage.js and AuthCallbackPage.js).
    // Do NOT use subscription_status for this — it defaults to 'trialing'
    // at the DB column level for every brand-new profile row regardless of
    // payment (see backend/migrations/add_trial_columns.sql).
    stripeCustomerId: data.stripe_customer_id || null
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
    brand_logo_url: profile.brandLogoUrl || null,
    brand_primary_color: profile.brandPrimaryColor || '#2563eb',
    brand_secondary_color: profile.brandSecondaryColor || '#1A1A1A',
    brand_accent_color: profile.brandAccentColor || '#0052FF',
    brand_company_name: profile.brandCompanyName || null,
    brand_letterhead_text: profile.brandLetterheadText || null,
    google_sheet_id: profile.googleSheetId
      ? (profile.googleSheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) || [])[1] || profile.googleSheetId.trim()
      : null,
    google_sheet_tab: profile.googleSheetTab || 'Model',
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

const dealsServiceExports = {
  saveDeal,
  loadDeal,
  loadPipelineDeals,
  loadRapidFireDeals,
  loadDealForResults,
  deleteDeal,
  bulkDeleteDeals,
  duplicateDeal,
  updateDeal,
  updateDealStatus,
  updateDealNotes,
  saveDueDiligenceData,
  loadDueDiligenceData,
  loadProfile,
  saveProfile,
  saveRapidFireDeals
};
export default dealsServiceExports;
