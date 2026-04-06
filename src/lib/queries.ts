import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getActiveSeason() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function getStandings(seasonId: string) {
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("standings_view")
    .select("*")
    .eq("season_id", seasonId)
    .order("overall_points", { ascending: false });

  return data ?? [];
}
