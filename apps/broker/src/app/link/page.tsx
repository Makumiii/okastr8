"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Id } from "../../../convex/_generated/dataModel";

export default function LinkPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    
    const code = searchParams.get("code");
    const userId = searchParams.get("userId") as Id<"users"> | null;

    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    const authorize = useMutation(api.deviceCodes.authorize);

    useEffect(() => {
        if (code && userId && status === "idle") {
            handleLink();
        }
    }, [code, userId]);

    async function handleLink() {
        if (!code || !userId) return;

        setStatus("loading");
        try {
            await authorize({
                userCode: code,
                userId: userId,
            });
            setStatus("success");
            
            // Redirect to GitHub App installation after a short delay
            setTimeout(() => {
                const appId = "okastr8-broker"; // TODO: Make this dynamic or configurable
                window.location.href = `https://github.com/apps/${appId}/installations/new`;
            }, 2000);
        } catch (err: any) {
            setStatus("error");
            setError(err.message);
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24">
            <div className="z-10 w-full max-w-md items-center justify-between font-mono text-sm">
                <h1 className="text-4xl font-bold mb-8 text-center">Linking Okastr8</h1>
                
                <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
                    {status === "loading" && (
                        <p className="text-center">Linking your GitHub account to your server...</p>
                    )}
                    
                    {status === "success" && (
                        <div className="text-center">
                            <p className="text-green-600 font-bold mb-4">Successfully Linked!</p>
                            <p className="text-gray-600">Redirecting you to GitHub to install the App...</p>
                        </div>
                    )}
                    
                    {status === "error" && (
                        <div className="text-center text-red-600">
                            <p className="font-bold mb-2">Error Linking Account</p>
                            <p>{error}</p>
                            <button 
                                onClick={() => router.push("/")}
                                className="mt-4 px-4 py-2 bg-black text-white rounded-md"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {!code && (
                         <div className="text-center">
                            <p className="mb-4">No linking code found. Please start the process from your CLI.</p>
                            <button 
                                onClick={() => router.push("/")}
                                className="px-4 py-2 bg-black text-white rounded-md"
                            >
                                Go Home
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
