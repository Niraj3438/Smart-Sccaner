import { createClient } from '@supabase/supabase-js';

// The web build must also work when Vercel environment variables were not
// injected at build time. The publishable key is specifically intended for
// browser/client applications; never use a secret/service-role key here.
const DEFAULT_SUPABASE_URL = 'https://sdvwtpltzpjcvocbnybw.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_r_3tdQCVxo1SWdHn32PNvQ_5FaKfIaP';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// The existing React app expects a small window.smartscan session bridge.
// Electron provides the native implementation through preload. In Chrome,
// connect only the account/session methods to Supabase; filesystem methods
// remain disabled by the browser compatibility layer.
if(supabase && typeof window!=='undefined'){
  const native=window.smartscan||{};
  window.smartscan={
    ...native,
    getSession:async()=>{
      const {data,error}=await supabase.auth.getSession();
      if(error) throw error;
      const user=data?.session?.user;
      return user
        ? {ok:true,user:{id:user.id,username:user.email,displayName:user.user_metadata?.display_name||user.email}}
        : {ok:false};
    },
    logout:async()=>{
      const {error}=await supabase.auth.signOut();
      if(error) throw error;
      return {ok:true};
    },
  };

  supabase.auth.onAuthStateChange(()=>{
    // Root/Auth use the persisted Supabase session on the next render/load.
  });
}
