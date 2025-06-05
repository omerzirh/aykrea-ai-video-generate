require('dotenv').config();
const fetch = require('node-fetch');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase environment variables are missing');
  process.exit(1);
}

// SQL to create the generated_images table
const createImagesTableSQL = `
-- Create the generated_images table
CREATE TABLE IF NOT EXISTS public.generated_images (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_url TEXT,
  prompt_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Policy for users to view only their own images
CREATE POLICY "Users can view their own images"
  ON public.generated_images
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own images
CREATE POLICY "Users can insert their own images"
  ON public.generated_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add index on user_id for faster queries
CREATE INDEX IF NOT EXISTS generated_images_user_id_idx ON public.generated_images (user_id);

-- Add index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS generated_images_created_at_idx ON public.generated_images (created_at DESC);
`;

console.log('SQL to create the generated_images table:');
console.log(createImagesTableSQL);
console.log('\nRun this SQL in your Supabase SQL Editor to create the table.');
