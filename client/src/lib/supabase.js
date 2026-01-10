// Supabase Client Configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ylvnrtbkpsnpgskbkbyy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsdm5ydGJrcHNucGdza2JrYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1MjUsImV4cCI6MjA4MDc0MTUyNX0.fdDBrKAvMEDqdhekfNU6XNAU39xOx3D3oAsTEazg5Y0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
