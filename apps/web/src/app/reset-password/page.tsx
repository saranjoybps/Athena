export default function ResetPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <input className="mt-6 w-full rounded-xl border px-3 py-3" placeholder="Email" />
      <button className="mt-3 w-full rounded-xl bg-clay py-3 text-white">Send reset link</button>
    </main>
  );
}
