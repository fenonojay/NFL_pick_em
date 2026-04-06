"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function parseUuid(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") return null;
  return /^[0-9a-fA-F-]{36}$/.test(value) ? value : null;
}

export async function submitRegularPick(formData: FormData) {
  const user = await requireUser();
  const supabase = getSupabaseServerClient();

  const weekId = parseUuid(formData.get("week_id"));
  const teamId = parseUuid(formData.get("team_id"));

  if (!weekId || !teamId) {
    throw new Error("Invalid pick payload.");
  }

  const { data: week } = await supabase
    .from("weeks")
    .select("id, season_id, week_number, is_playoff, lock_at, seasons(rule_mode)")
    .eq("id", weekId)
    .single();

  if (!week || week.is_playoff) throw new Error("Week not valid for regular-season picks.");
  if (new Date(week.lock_at) <= new Date()) throw new Error("Pick window is locked.");

  const { data: existingWeekPick } = await supabase
    .from("picks")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_id", weekId)
    .eq("pick_type", "REGULAR")
    .maybeSingle();

  if (existingWeekPick) {
    throw new Error("You already made your regular-season pick for this week.");
  }

  const ruleMode = (week.seasons as { rule_mode: "WINNER_NO_REPEAT" | "LOSER" }).rule_mode;

  if (ruleMode === "WINNER_NO_REPEAT") {
    const { data: usedTeam } = await supabase
      .from("picks")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", teamId)
      .eq("pick_type", "REGULAR")
      .eq("season_id", week.season_id)
      .maybeSingle();

    if (usedTeam) {
      throw new Error("No-repeat rule: you already won with this team.");
    }
  }

  const { error } = await supabase.from("picks").insert({
    user_id: user.id,
    season_id: week.season_id,
    week_id: week.id,
    team_id: teamId,
    pick_type: "REGULAR"
  });

  if (error) throw new Error(error.message);

  revalidatePath("/picks");
  revalidatePath("/dashboard");
}

export async function submitPlayoffPick(formData: FormData) {
  const user = await requireUser();
  const supabase = getSupabaseServerClient();

  const gameId = parseUuid(formData.get("game_id"));
  const teamId = parseUuid(formData.get("team_id"));
  if (!gameId || !teamId) throw new Error("Invalid playoff pick.");

  const { data: game } = await supabase
    .from("games")
    .select("id, kickoff_at, week_id, weeks(season_id, is_playoff)")
    .eq("id", gameId)
    .single();

  if (!game || !(game.weeks as { is_playoff: boolean }).is_playoff) {
    throw new Error("Game is not a playoff game.");
  }
  if (new Date(game.kickoff_at) <= new Date()) throw new Error("Game already started.");

  const { data: existing } = await supabase
    .from("picks")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .eq("pick_type", "PLAYOFF")
    .maybeSingle();

  if (existing) {
    throw new Error("You already made a playoff pick for this game.");
  }

  const { error } = await supabase.from("picks").insert({
    user_id: user.id,
    season_id: (game.weeks as { season_id: string }).season_id,
    week_id: game.week_id,
    game_id: game.id,
    team_id: teamId,
    pick_type: "PLAYOFF"
  });

  if (error) throw new Error(error.message);
  revalidatePath("/picks");
  revalidatePath("/standings");
}

export async function upsertSeason(formData: FormData) {
  await requireAdmin();
  const supabase = getSupabaseServerClient();

  const name = String(formData.get("name") || "").trim();
  const year = Number(formData.get("year"));
  const ruleMode = String(formData.get("rule_mode"));

  if (!name || !Number.isFinite(year)) throw new Error("Name and year are required.");
  if (!["WINNER_NO_REPEAT", "LOSER"].includes(ruleMode)) throw new Error("Invalid rule mode.");

  const { error } = await supabase.from("seasons").insert({
    name,
    year,
    rule_mode: ruleMode,
    is_active: true
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function createWeek(formData: FormData) {
  await requireAdmin();
  const supabase = getSupabaseServerClient();

  const seasonId = parseUuid(formData.get("season_id"));
  const weekNumber = Number(formData.get("week_number"));
  const isPlayoff = String(formData.get("is_playoff")) === "true";
  const lockAt = String(formData.get("lock_at"));

  if (!seasonId || !Number.isFinite(weekNumber) || !lockAt) {
    throw new Error("Invalid week payload.");
  }

  const { error } = await supabase.from("weeks").insert({
    season_id: seasonId,
    week_number: weekNumber,
    is_playoff: isPlayoff,
    lock_at: new Date(lockAt).toISOString()
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function createGame(formData: FormData) {
  await requireAdmin();
  const supabase = getSupabaseServerClient();

  const weekId = parseUuid(formData.get("week_id"));
  const homeTeamId = parseUuid(formData.get("home_team_id"));
  const awayTeamId = parseUuid(formData.get("away_team_id"));
  const kickoffAt = String(formData.get("kickoff_at"));

  if (!weekId || !homeTeamId || !awayTeamId || !kickoffAt || homeTeamId === awayTeamId) {
    throw new Error("Invalid game payload.");
  }

  const { error } = await supabase.from("games").insert({
    week_id: weekId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    kickoff_at: new Date(kickoffAt).toISOString()
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setGameResult(formData: FormData) {
  await requireAdmin();
  const supabase = getSupabaseServerClient();

  const gameId = parseUuid(formData.get("game_id"));
  const winnerTeamId = parseUuid(formData.get("winner_team_id"));
  if (!gameId || !winnerTeamId) throw new Error("Invalid game result payload.");

  const { data: game, error } = await supabase
    .from("games")
    .update({ winner_team_id: winnerTeamId })
    .eq("id", gameId)
    .select("id, week_id, weeks(season_id, is_playoff, seasons(rule_mode))")
    .single();

  if (error || !game) throw new Error(error?.message || "Could not update game.");

  const { error: gradeError } = await supabase.rpc("grade_game_picks", { p_game_id: gameId });
  if (gradeError) throw new Error(gradeError.message);

  revalidatePath("/admin");
  revalidatePath("/standings");
  revalidatePath("/dashboard");
}
