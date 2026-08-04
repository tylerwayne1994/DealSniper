// Shared helper for uploading a file onto a deal's document list — extracted
// from DealRoomPage.jsx's handleUpload/persistDocumentRecord so other
// features (e.g. UnderwritingModelTab's "Save Model to Documents") can
// attach a file to a deal without duplicating the bucket-fallback logic.
// Same client-side pattern: direct Supabase Storage upload + deal_documents
// insert, using the caller's own authenticated session (RLS-protected).
import { supabase } from './supabase';

/**
 * @param {string} dealId
 * @param {File|Blob} file - if a Blob (not a File), pass `fileName` too.
 * @param {{category?: string, fileName?: string, visibleToInvestors?: boolean}} [opts]
 */
export async function uploadDealDocument(dealId, file, opts = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to upload files.');

  const fileName = opts.fileName || file.name || 'document';
  const fileType = file.type || 'application/octet-stream';
  const fileSize = file.size || 0;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/${dealId}/${Date.now()}_${safeName}`;

  let activeBucket = 'deal-documents';
  let uploadErr = null;
  let uploadSuccess = false;

  const first = await supabase.storage.from(activeBucket).upload(storagePath, file, { upsert: false });
  if (!first.error) {
    uploadSuccess = true;
  } else {
    uploadErr = first.error;
    activeBucket = 'deal-images';
    const second = await supabase.storage.from(activeBucket).upload(storagePath, file, { upsert: false });
    if (!second.error) { uploadSuccess = true; uploadErr = null; }
    else uploadErr = second.error;
  }
  if (!uploadSuccess) throw uploadErr || new Error('Storage upload failed');

  const { data: urlData } = supabase.storage.from(activeBucket).getPublicUrl(storagePath);

  const record = {
    deal_id: dealId,
    user_id: user.id,
    file_name: fileName,
    file_size: fileSize,
    file_type: fileType,
    category: opts.category || 'underwriting_model',
    storage_path: storagePath,
    bucket: activeBucket,
    public_url: urlData?.publicUrl || '',
    visible_to_investors: !!opts.visibleToInvestors,
    uploaded_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('deal_documents').insert(record);
  if (error) throw error;
  return record;
}

/**
 * Like uploadDealDocument, but writes to a STABLE storage path (upsert) and
 * updates the existing deal_documents row instead of inserting a new one —
 * for content that's saved repeatedly over time (e.g. the underwriting
 * model auto-saving as it's edited) where you want one always-current
 * document, not a growing pile of timestamped duplicates.
 *
 * @param {string} dealId
 * @param {File|Blob} file
 * @param {{category?: string, fileName?: string, stableKey?: string, visibleToInvestors?: boolean}} [opts]
 */
export async function upsertDealDocument(dealId, file, opts = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to upload files.');

  const fileName = opts.fileName || file.name || 'document';
  const fileType = file.type || 'application/octet-stream';
  const fileSize = file.size || 0;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stableKey = (opts.stableKey || safeName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/${dealId}/${stableKey}`;

  let activeBucket = 'deal-documents';
  let uploadErr = null;
  let uploadSuccess = false;

  const first = await supabase.storage.from(activeBucket).upload(storagePath, file, { upsert: true });
  if (!first.error) {
    uploadSuccess = true;
  } else {
    uploadErr = first.error;
    activeBucket = 'deal-images';
    const second = await supabase.storage.from(activeBucket).upload(storagePath, file, { upsert: true });
    if (!second.error) { uploadSuccess = true; uploadErr = null; }
    else uploadErr = second.error;
  }
  if (!uploadSuccess) throw uploadErr || new Error('Storage upload failed');

  const { data: urlData } = supabase.storage.from(activeBucket).getPublicUrl(storagePath);

  const record = {
    deal_id: dealId,
    user_id: user.id,
    file_name: fileName,
    file_size: fileSize,
    file_type: fileType,
    category: opts.category || 'underwriting_model',
    storage_path: storagePath,
    bucket: activeBucket,
    public_url: urlData?.publicUrl || '',
    visible_to_investors: !!opts.visibleToInvestors,
    uploaded_at: new Date().toISOString(),
  };

  const { data: existingRows } = await supabase
    .from('deal_documents')
    .select('id')
    .eq('deal_id', dealId)
    .eq('storage_path', storagePath)
    .limit(1);

  if (existingRows && existingRows.length > 0) {
    const { error } = await supabase.from('deal_documents').update(record).eq('id', existingRows[0].id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('deal_documents').insert(record);
    if (error) throw error;
  }
  return record;
}
