import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = getSupabaseServerClient();
  const season = await getActiveSeason();

  if (!season) {
    return <div className="card">No active season. Ask an admin to create one.</div>;
  }

  const { data: nextWeek } = await supabase
    .from("weeks")
    .select("id, week_number, is_playoff, lock_at")
    .eq("season_id", season.id)
    .gte("lock_at", new Date().toISOString())
    .order("week_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: myPicks } = await supabase
    .from("picks")
    .select("id, pick_type, is_correct, created_at")
    .eq("season_id", season.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-2xl font-bold">Hi, {user.email}</h1>
        <p className="mt-2 text-slate-600">
          Active season: <span className="font-semibold">{season.name}</span> ({season.rule_mode})
        </p>
        {nextWeek ? (
          <p className="mt-2 text-sm">
            Next: Week {nextWeek.week_number} {nextWeek.is_playoff ? "Playoffs" : "Regular"} (locks {new Date(nextWeek.lock_at).toLocaleString()})
          </p>
        ) : (
          <p className="mt-2 text-sm">No open week yet.</p>
        )}
        <div className="mt-4 flex gap-3">
          <Link className="btn-primary" href="/picks">
            Make picks
          </Link>
          <Link className="btn-secondary" href="/standings">
            View standings
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Recent picks</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {(myPicks ?? []).map((pick) => (
            <li key={pick.id}>
              {pick.pick_type} • {pick.is_correct === null ? "Pending" : pick.is_correct ? "Correct" : "Incorrect"} • {new Date(pick.created_at).toLocaleString()}
            </li>
          ))}
          {!myPicks?.length && <li>No picks yet.</li>}
        </ul>
      </section>
    </div>
  );
}
