"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [userCode, setUserCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const authorize = useMutation(api.deviceCodes.authorize);
  const createUser = useMutation(api.users.create);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Initiate real GitHub OAuth flow
      // We pass the userCode as 'state' so we can link this session back to the CLI device code
      window.location.href = `/api/github/login?state=${userCode}`;
    } catch (err: any) {
      setError(err.message || "Failed to initiate login");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Connect Okastr8</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Enter the code displayed in your terminal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Device Code
            </label>
            <input
              id="code"
              type="text"
              placeholder="ABCD-1234"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value.toUpperCase())}
              required
              className="mt-1 block w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-widest"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "Authorizing..." : "Continue with GitHub"}
          </button>
        </form>
      </div>
    </div>
  );
}
