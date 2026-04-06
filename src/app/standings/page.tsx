import { requireUser } from "@/lib/auth";
import { getActiveSeason, getStandings } from "@/lib/queries";

export default async function StandingsPage() {
  await requireUser();
  const season = await getActiveSeason();

  if (!season) return <div className="card">No active season.</div>;

  const standings = await getStandings(season.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Standings</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-600">
            <tr>
              <th className="py-2 pr-2">Player</th>
              <th className="py-2 pr-2">Regular</th>
              <th className="py-2 pr-2">Playoffs</th>
              <th className="py-2 pr-2">Overall</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.user_id} className="border-b border-slate-100">
                <td className="py-2 pr-2 font-medium">{row.display_name}</td>
                <td className="py-2 pr-2">{row.regular_points}</td>
                <td className="py-2 pr-2">{row.playoff_points}</td>
                <td className="py-2 pr-2 font-semibold">{row.overall_points}</td>
              </tr>
            ))}
            {!standings.length && (
              <tr>
                <td className="py-2" colSpan={4}>
                  No standings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
