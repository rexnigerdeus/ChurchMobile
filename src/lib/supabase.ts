// src/lib/supabase.ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// ⚠️ Remplace par tes vraies clés Supabase (les mêmes que pour le web)
const supabaseUrl = 'https://xxwuxkkeiovzqsurlazk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4d3V4a2tlaW92enFzdXJsYXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMDM1MDMsImV4cCI6MjA5Mzc3OTUwM30.4T8U8eGNctkA06vXmu3XhRy3BQWFc694CU6nutmuAuw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})