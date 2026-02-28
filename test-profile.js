require('dotenv').config({ path: 'src/environments/.env' });
const { createClient } = require('@supabase/supabase-js');
// wait, angular uses environments/environment.ts, let's just parse it.
