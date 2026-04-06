import { submitPlayoffPick, submitRegularPick } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getActiveSeason } from "@/lib/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function PicksPage() {
  const user = await requireUser();
  const supabase = getSupabaseServerClient();
  const season = await getActiveSeason();

  if (!season) return <div className="card">No active season.</div>;

  const { data: weeks } = await supabase
    .from("weeks")
    .select("id, week_number, is_playoff, lock_at")
    .eq("season_id", season.id)
    .order("week_number", { ascending: true });

  const { data: teams } = await supabase.from("teams").select("id, abbreviation, name").order("name");

  const { data: myRegularWeekIds } = await supabase
    .from("picks")
    .select("week_id")
    .eq("user_id", user.id)
    .eq("season_id", season.id)
    .eq("pick_type", "REGULAR");

  const regularWeekSet = new Set((myRegularWeekIds ?? []).map((p) => p.week_id));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Weekly picks</h1>

      {(weeks ?? []).map((week) => {
        const locked = new Date(week.lock_at) <= new Date();

        if (!week.is_playoff) {
          const alreadyPicked = regularWeekSet.has(week.id);
          return (
            <section key={week.id} className="card">
              <h2 className="text-lg font-semibold">Week {week.week_number} (Regular)</h2>
              <p className="text-sm text-slate-600">Exactly one pick is allowed. Locks at {new Date(week.lock_at).toLocaleString()}.</p>
              <form action={submitRegularPick} className="mt-4 flex items-end gap-3">
                <input type="hidden" name="week_id" value={week.id} />
                <div>
                  <label className="mb-1 block text-sm font-medium">Team</label>
                  <select className="input" name="team_id" required disabled={locked || alreadyPicked}>
                    <option value="">Select team</option>
                    {(teams ?? []).map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn-primary" type="submit" disabled={locked || alreadyPicked}>
                  {alreadyPicked ? "Pick submitted" : locked ? "Locked" : "Submit pick"}
                </button>
              </form>
            </section>
          );
        }

        return (
          <PlayoffWeekCard
            key={week.id}
            weekId={week.id}
            weekNumber={week.week_number}
            seasonId={season.id}
            userId={user.id}
            teams={teams ?? []}
            submitPlayoffPick={submitPlayoffPick}
          />
        );
      })}
    </div>
  );
}

async function PlayoffWeekCard({
  weekId,
  weekNumber,
  seasonId,
  userId,
  teams,
  submitPlayoffPick
}: {
  weekId: string;
  weekNumber: number;
  seasonId: string;
  userId: string;
  teams: Array<{ id: string; abbreviation: string; name: string }>;
  submitPlayoffPick: (formData: FormData) => Promise<void>;
}) {
  const supabase = getSupabaseServerClient();
  const { data: games } = await supabase
    .from("games")
    .select("id, home_team_id, away_team_id, kickoff_at")
    .eq("week_id", weekId)
    .order("kickoff_at", { ascending: true });

  const { data: picks } = await supabase
    .from("picks")
    .select("game_id")
    .eq("season_id", seasonId)
    .eq("user_id", userId)
    .eq("pick_type", "PLAYOFF");

  const pickedSet = new Set((picks ?? []).map((p) => p.game_id));

  return (
    <section className="card">
      <h2 className="text-lg font-semibold">Week {weekNumber} (Playoffs)</h2>
      <p className="text-sm text-slate-600">One pick per playoff game.</p>
      <div className="mt-4 space-y-4">
        {(games ?? []).map((game) => {
          const locked = new Date(game.kickoff_at) <= new Date();
          const picked = pickedSet.has(game.id);
          const home = teams.find((t) => t.id === game.home_team_id);
          const away = teams.find((t) => t.id === game.away_team_id);

          return (
            <form key={game.id} action={submitPlayoffPick} className="rounded-lg border border-slate-200 p-4">
              <input type="hidden" name="game_id" value={game.id} />
              <p className="text-sm font-medium">
                {away?.abbreviation} @ {home?.abbreviation} • {new Date(game.kickoff_at).toLocaleString()}
              </p>
              <div className="mt-2 flex items-end gap-3">
                <select className="input" name="team_id" required disabled={locked || picked}>
                  <option value="">Pick winner</option>
                  {[away, home].filter(Boolean).map((team) => (
                    <option key={team?.id} value={team?.id}>
                      {team?.name}
                    </option>
                  ))}
                </select>
                <button className="btn-primary" type="submit" disabled={locked || picked}>
                  {picked ? "Submitted" : locked ? "Locked" : "Submit"}
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}
