"use client";

import { useEffect, useState } from "react";
import { athena, type Paginated } from "@/lib/athena-client";

/** Build id → label maps so list UIs never show raw UUIDs. */
export function useNameMaps() {
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [crews, setCrews] = useState<Record<string, string>>({});
  const [labour, setLabour] = useState<Record<string, string>>({});

  useEffect(() => {
    const toMap = (res: Paginated<Record<string, unknown>>, keys: string[]) => {
      const map: Record<string, string> = {};
      for (const item of res.items) {
        const id = String(item.id || "");
        if (!id) continue;
        const label = keys.map((k) => item[k]).find((v) => v != null && String(v).trim()) ?? id;
        map[id] = String(label);
      }
      return map;
    };

    Promise.all([
      athena.projects.list().catch(() => ({ items: [] })),
      athena.materials.list().catch(() => ({ items: [] })),
      athena.suppliers.list().catch(() => ({ items: [] })),
      athena.crews.list().catch(() => ({ items: [] })),
      athena.labour.list().catch(() => ({ items: [] })),
    ]).then(([p, m, s, c, l]) => {
      setProjects(toMap(p, ["name", "number"]));
      setMaterials(toMap(m, ["name", "sku", "code"]));
      setSuppliers(toMap(s, ["name", "company"]));
      setCrews(toMap(c, ["name"]));
      setLabour(toMap(l, ["name", "trade"]));
    });
  }, []);

  return { projects, materials, suppliers, crews, labour };
}

export function formatQty(value: unknown): string {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return String(value ?? "0");
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
