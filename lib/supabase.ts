import { createClient } from "@supabase/supabase-js";
import { FocusSession } from "./domain";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseSession = {
  id: string;
  user_id: string;
  date: string;
  project_title: string;
  task_title: string;
  hours: number;
  start_time: string;
  end_time: string;
  raw_data: FocusSession;
};
