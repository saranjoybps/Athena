"use client";

import { useState } from "react";
import { athena } from "@/lib/athena-client";

export default function FieldExpensePage() {
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("transport");
  const [msg, setMsg] = useState("");

  async function submit() {
    await athena.expenses.create({ projectId, amount, category, paidBy: "cash", description: "Field expense" });
    setMsg("Expense recorded");
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4">
      <h1 className="text-lg font-semibold">Quick expense</h1>
      <input className="w-full rounded-xl border px-3 py-3" placeholder="Project ID" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
      <input className="w-full rounded-xl border px-3 py-3" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className="w-full rounded-xl border px-3 py-3" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="transport">Transport</option>
        <option value="materials">Materials</option>
        <option value="food">Food</option>
        <option value="miscellaneous">Miscellaneous</option>
      </select>
      <button className="w-full rounded-xl bg-clay py-3 text-white" type="button" onClick={submit}>
        Save
      </button>
      {msg ? <p className="text-green-800">{msg}</p> : null}
    </div>
  );
}
