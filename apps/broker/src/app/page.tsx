"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function HomeContent() {
    const searchParams = useSearchParams();
    const code = searchParams.get("code");

    function handleLogin() {
        if (!code) {
            alert("Please start the connection from your okastr8 CLI.");
            return;
        }
        window.location.href = `/api/github/login?state=${code}`;
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-50 dark:bg-black font-sans">
            <div className="z-10 w-full max-w-2xl flex flex-col items-center gap-8 text-center">
                <h1 className="text-5xl font-bold tracking-tight text-black dark:text-zinc-50">
                    Connect GitHub to Okastr8
                </h1>
                
                <p className="text-xl text-zinc-600 dark:text-zinc-400">
                    The Okastr8 Broker bridges your GitHub repositories with your private servers, 
                    enabling zero-config automated deployments.
                </p>

                {code ? (
                    <div className="flex flex-col gap-4 w-full max-w-sm">
                        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
                            <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Linking Code</p>
                            <p className="text-2xl font-mono font-bold text-black dark:text-white">{code}</p>
                        </div>
                        <button 
                            onClick={handleLogin}
                            className="h-14 w-full rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-lg transition-transform hover:scale-105"
                        >
                            Login with GitHub
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 text-left p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                        <h2 className="text-lg font-bold">How to connect:</h2>
                        <ol className="list-decimal list-inside space-y-2 text-zinc-600 dark:text-zinc-400">
                            <li>Run <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">okastr8 github connect</code> on your server.</li>
                            <li>Open the URL provided in the terminal.</li>
                            <li>Log in here and enter the code.</li>
                        </ol>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <HomeContent />
        </Suspense>
    );
}
