"use client";

import { CheckCircle2 } from "lucide-react";

export default function SuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="p-12 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 space-y-6 max-w-md">
        <div className="flex justify-center">
          <CheckCircle2 className="w-20 h-20 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Authenticated!</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Your server has been successfully connected. You can now close this window and return to your terminal.
        </p>
        <div className="pt-4">
          <button 
            onClick={() => window.close()}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline underline-offset-4"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
