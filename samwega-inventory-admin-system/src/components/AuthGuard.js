'use client';

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple checks in React Strict Mode
    if (checkedRef.current) return;
    checkedRef.current = true;

    // Check for JWT token
    const token = api.getToken();
    if (!token) {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-sky-400" />
      </div>
    );
  }

  return <>{children}</>;
}