// supabase.js — initialises the Supabase client and exports it as window.sb
// Requires the Supabase CDN script to be loaded first in the HTML:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

(function () {
  const SUPABASE_URL     = 'https://jfegilifmksmngslnbgm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZWdpbGlmbWtzbW5nc2xuYmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDM3NTYsImV4cCI6MjA4NzE3OTc1Nn0.feYG3sPE26HqP0cW1dFBE7Vcf_OWGkukw9DuUyQbzlM';

  window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
