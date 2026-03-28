import { createClient } from '@supabase/supabase-js';

// NOTA: Estos valores seran reemplazados con el ID del proyecto y la credencial que proveas en el proximo mensaje
const supabaseUrl = 'https://__NEW_SUPABASE_PROJECT_ID__.supabase.co';
const supabaseKey = '__NEW_SUPABASE_ANON_KEY__';

// Exportando cliente de supabase para los backups vinculados a la cuenta Cloud (email/password)
export const supabaseCloud = createClient(supabaseUrl, supabaseKey);
