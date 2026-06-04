import { createClient } from '@supabase/supabase-js';

// Replace these placeholders with your actual Supabase Project details
// Found in your Supabase Dashboard > Project Settings > API
const supabaseUrl = 'https://cvgqtqglrbvdphhdaxzr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z3F0cWdscmJ2ZHBoaGRheHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzQ0MjksImV4cCI6MjA5NjE1MDQyOX0.JDQScQyBUtTtpp09zC7tlPndpzoRNxf7rhCM5ryd9bo';

// Initialize and export the client database connection instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);