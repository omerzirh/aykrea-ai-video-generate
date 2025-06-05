require('dotenv').config();
const fetch = require('node-fetch');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing');
  process.exit(1);
}

async function createTable() {
  try {
    console.log('Creating generated_videos table...');
    
    // Use the REST API to create the table
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_generated_videos_table`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Error creating table via RPC:', error);
      console.log('Creating table via direct API...');
      
      // Let's create the table through the Supabase dashboard instead
      console.log(`
Please create the 'generated_videos' table manually through the Supabase dashboard with the following structure:

- id: uuid (primary key)
- user_id: uuid (foreign key to auth.users)
- url: text
- source_url: text
- type: text
- prompt_text: text
- prompt_image: boolean
- aspect_ratio: text
- created_at: timestamp with time zone

Then add the following RLS policies:
1. Users can view their own videos: auth.uid() = user_id
2. Users can insert their own videos: auth.uid() = user_id
`);
      
      return false;
    }
    
    console.log('Successfully created generated_videos table');
    return true;
  } catch (error) {
    console.error('Error creating table:', error);
    return false;
  }
}

createTable()
  .then(success => {
    if (success) {
      console.log('Database setup completed successfully');
    } else {
      console.error('Database setup failed');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error during database setup:', error);
    process.exit(1);
  });
