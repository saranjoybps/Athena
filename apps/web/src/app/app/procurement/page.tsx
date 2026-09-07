"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";
import { formatQty, useNameMaps } from "@/lib/name-maps";

export default function Page() {
  const { materials, suppliers, projects } = useNameMaps();
  const [mrs, setMrs] = useState<Array<Record<string, unknown>>>([]);
  const [pos, setPos] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([athena.materialRequests.list(), athena.purchaseOrders.list()])
      .then(([a, b]) => {
        setMrs(a.items);
        setPos(b.items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Procurement</h1>
          <p className="mt-1 text-stone-600">Material requests and purchase orders.</p>
        </div>
        <Link href="/app/procurement/new" className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          New material request
        </Link>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Material requests</h2>
      <div className="mb-8 grid gap-3">
        {mrs.length === 0 ? <p className="text-stone-500">No material requests.</p> : null}
        {mrs.map((item) => {
          const materialId = String(item.materialId || "");
          const projectId = String(item.projectId || "");
          return (
            <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm flex justify-between gap-3">
              <div>
                <p className="font-medium">{materials[materialId] || "Material request"}</p>
                <p className="text-sm text-stone-600">
                  Qty {formatQty(item.qty)} · {String(item.status || "draft")}
                  {projectId ? ` · ${projects[projectId] || "Project"}` : ""}
                </p>
              </div>
              {String(item.status) !== "approved" ? (
                <button
                  type="button"
                  className="rounded-xl border px-3 py-1 text-sm"
                  onClick={async () => {
                    await athena.materialRequests.approve(String(item.id));
                    load();
                  }}
                >
                  Approve
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Purchase orders</h2>
      <div className="grid gap-3">
        {pos.length === 0 ? <p className="text-stone-500">No purchase orders.</p> : null}
        {pos.map((item) => {
          const supplierId = String(item.supplierId || "");
          return (
            <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">PO · {String(item.number || item.id)}</p>
              <p className="text-sm text-stone-600">
                {String(item.status || "")} · {suppliers[supplierId] || "Supplier"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
