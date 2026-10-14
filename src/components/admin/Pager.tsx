import { useEffect, useMemo, useState } from "react";

export function usePager<T>(rows: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);
  const slice = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);
  return { page, setPage, pages, total, pageSize, slice };
}

export function Pager({ page, pages, total, pageSize, onPage }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">Showing {from}–{to} of {total}</span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-border px-3 py-1.5 font-bold disabled:opacity-40">Prev</button>
          <span className="px-2 font-bold">{page} / {pages}</span>
          <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={page === pages} className="rounded-md border border-border px-3 py-1.5 font-bold disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
