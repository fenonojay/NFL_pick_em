import { createGame, createWeek, setGameResult, upsertSeason } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = getSupabaseServerClient();

  const { data: seasons } = await supabase.from("seasons").select("id, name, year, rule_mode, is_active").order("year", { ascending: false });
  const activeSeason = seasons?.find((season) => season.is_active) ?? seasons?.[0];

  const { data: weeks } = await supabase
    .from("weeks")
    .select("id, week_number, is_playoff")
    .eq("season_id", activeSeason?.id ?? "")
    .order("week_number", { ascending: true });

  const { data: games } = await supabase
    .from("games")
    .select("id, kickoff_at, winner_team_id, home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name), weeks(week_number)")
    .order("kickoff_at", { ascending: false })
    .limit(15);

  const { data: teams } = await supabase.from("teams").select("id, name").order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin settings</h1>

      <section className="card">
        <h2 className="text-lg font-semibold">Create season</h2>
        <form action={upsertSeason} className="mt-4 grid gap-3 md:grid-cols-4">
          <input className="input" type="text" name="name" placeholder="2026 Family Season" required />
          <input className="input" type="number" name="year" placeholder="2026" required />
          <select className="input" name="rule_mode" defaultValue="WINNER_NO_REPEAT">
            <option value="WINNER_NO_REPEAT">Winner no-repeat</option>
            <option value="LOSER">Pick loser</option>
          </select>
          <button type="submit" className="btn-primary">
            Save season
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Seasons</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(seasons ?? []).map((season) => (
            <li key={season.id}>
              {season.name} ({season.year}) - {season.rule_mode} {season.is_active ? "• active" : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Add week</h2>
        <form action={createWeek} className="mt-4 grid gap-3 md:grid-cols-4">
          <select className="input" name="season_id" defaultValue={activeSeason?.id} required>
            {(seasons ?? []).map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
          <input className="input" type="number" name="week_number" placeholder="Week #" required />
          <select className="input" name="is_playoff" defaultValue="false">
            <option value="false">Regular</option>
            <option value="true">Playoff</option>
          </select>
          <input className="input" type="datetime-local" name="lock_at" required />
          <button className="btn-primary md:col-span-4" type="submit">
            Add week
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Add game</h2>
        <form action={createGame} className="mt-4 grid gap-3 md:grid-cols-5">
          <select className="input" name="week_id" required>
            <option value="">Select week</option>
            {(weeks ?? []).map((week) => (
              <option key={week.id} value={week.id}>
                Week {week.week_number} ({week.is_playoff ? "Playoff" : "Regular"})
              </option>
            ))}
          </select>
          <select className="input" name="away_team_id" required>
            <option value="">Away team</option>
            {(teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <select className="input" name="home_team_id" required>
            <option value="">Home team</option>
            {(teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <input className="input" type="datetime-local" name="kickoff_at" required />
          <button className="btn-primary" type="submit">
            Add game
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Enter weekly results</h2>
        <div className="mt-3 space-y-3">
          {(games ?? []).map((game) => (
            <form key={game.id} action={setGameResult} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-4">
              <input type="hidden" name="game_id" value={game.id} />
              <p className="text-sm md:col-span-2">
                Week {(game.weeks as { week_number: number }).week_number} • {(game.away as { name: string }).name} @ {(game.home as { name: string }).name}
              </p>
              <select className="input" name="winner_team_id" defaultValue={game.winner_team_id ?? ""} required>
                <option value="">Set winner</option>
                {(teams ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button className="btn-primary" type="submit">
                Save result
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
