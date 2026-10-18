import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});