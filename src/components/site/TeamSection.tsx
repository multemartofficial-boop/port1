import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TeamMember = {
  id: string;
  name: string;
  position: string;
  photo_url: string | null;
  bio: string | null;
  department_id?: string | null;
  sort_order?: number | null;
};

type Dept = { id: string; name: string };

function useTeam() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  useEffect(() => {
    supabase
      .from("team_members")
      .select("id,name,position,photo_url,bio,department_id,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data }) => setTeam((data as TeamMember[]) ?? []));
  }, []);
  return team;
}

function useDepartments() {
  const [depts, setDepts] = useState<Dept[]>([]);
  useEffect(() => {
    supabase
      .from("departments")
      .select("id,name")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setDepts((data as Dept[]) ?? []));
  }, []);
  return depts;
}

function MemberCard({ m, dept }: { m: TeamMember; dept?: string }) {
  const [open, setOpen] = useState(false);
  const isLong = (m.bio?.length ?? 0) > 90;
  return (
    <article className="text-center">
      <div className="mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-2xl bg-secondary">
        {m.photo_url ? (
          <img src={m.photo_url} alt={m.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-4xl font-black text-muted-foreground">
            {m.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="mt-4 font-bold leading-tight">{m.name}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-primary font-bold">{m.position}</div>
      {dept && (
        <div className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {dept}
        </div>
      )}
      {m.bio && (
        <>
          <p className={"mt-2 text-xs text-muted-foreground whitespace-pre-line " + (open ? "" : "line-clamp-3")}>{m.bio}</p>
          {isLong && (
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="mt-1 text-[11px] font-bold uppercase tracking-widest text-primary"
            >
              {open ? "Read less" : "Read more"}
            </button>
          )}
        </>
      )}
    </article>
  );
}

/** Clean, centered grid used on the About → Team tab, grouped by department. */
export function TeamGrid() {
  const team = useTeam();
  const depts = useDepartments();

  const rank = (m: TeamMember) => (typeof m.sort_order === "number" ? m.sort_order : Number.MAX_SAFE_INTEGER);
  const groups: { key: string; title: string; members: TeamMember[] }[] = [
    ...depts.map(d => ({ key: d.id, title: d.name, members: team.filter(m => m.department_id === d.id) })),
    { key: "none", title: "Other team members", members: team.filter(m => !m.department_id || !depts.some(d => d.id === m.department_id)) },
  ]
    .map(g => ({ ...g, members: [...g.members].sort((a, b) => rank(a) - rank(b)) }))
    .filter(g => g.members.length > 0)
    // group order follows the admin ordering of the members inside it
    .sort((a, b) => rank(a.members[0]) - rank(b.members[0]));

  return (
    <section className="container-page py-14">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-[11px] uppercase tracking-widest text-primary font-bold">Our Team</div>
        <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">The dream team</h1>
        <p className="mt-4 text-muted-foreground">
          From the workshop floor to the front desk — the people keeping you rolling, every single day.
        </p>
      </div>

      {team.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">Team members will appear here soon.</p>
      ) : groups.length <= 1 ? (
        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
          {team.map(m => <MemberCard key={m.id} m={m} dept={depts.find(d => d.id === m.department_id)?.name} />)}
        </div>
      ) : (
        <div className="mt-12 space-y-14">
          {groups.map(g => (
            <div key={g.key}>
              <h2 className="text-center text-xl sm:text-2xl font-black tracking-tight">{g.title}</h2>
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-primary" />
              <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
                {g.members.map(m => <MemberCard key={m.id} m={m} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


/** Compact section kept for reuse elsewhere. */
export function TeamSection() {
  const team = useTeam();
  if (team.length === 0) return null;

  return (
    <section id="team" className="bg-surface border-t border-border scroll-mt-24">
      <div className="container-page py-14">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-widest text-primary font-bold">Our Team</div>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">The people behind Yours</h2>
        </div>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {team.map(m => (
            <article key={m.id} className="rounded-xl border border-border bg-background overflow-hidden flex flex-col">
              <div className="aspect-square bg-secondary overflow-hidden">
                {m.photo_url ? (
                  <img src={m.photo_url} alt={m.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-3xl font-black text-muted-foreground">
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="p-4 flex-1">
                <div className="font-bold leading-tight">{m.name}</div>
                <div className="text-xs uppercase tracking-widest text-primary font-bold mt-1">{m.position}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
