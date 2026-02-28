const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://xadheyltgskjprmjbzvh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZGhleWx0Z3NranBybWpienZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDUwMDQsImV4cCI6MjA4NzMyMTAwNH0.IJ-uk4dUpk8ojsfs3ZYnR91--vzkfAYi7Kj8UysOCD0');

const fs = require('fs');

async function testConnection() {
  console.log('Testing Supabase Connection...');
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Profiles:', data);
  }
}

main();
