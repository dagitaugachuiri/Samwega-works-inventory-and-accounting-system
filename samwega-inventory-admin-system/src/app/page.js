"use client"
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "../lib/api";

export default function HomePage() {
  const router = useRouter();
  const checkedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple redirects in React Strict Mode
    if (checkedRef.current) return;
    checkedRef.current = true;

    // Check if user is authenticated
    const token = api.getToken();
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-sky-400" />
    </div>
  );
}