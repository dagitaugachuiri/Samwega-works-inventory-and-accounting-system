"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "../../../../lib/api";

export default function EditItemPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  const router = useRouter(); // Missing router import handling? Ah, view_file didn't show it but it's likely used if I add push.
  // Wait, line 3 in view_file: import { useParams } from "next/navigation"; 
  // I should check if useRouter is imported. It is NOT. I need to add it.


  useEffect(() => {
    if (!id) return;

    // Try to restore item from sessionStorage (set when clicking Edit on dashboard)
    if (typeof window !== "undefined") {
      try {
        const cached = window.sessionStorage.getItem("editItem");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id?.toString() === id.toString()) {
            setItem(parsed);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to restore cached item", e);
      }
    }

    const fetchItem = async () => {
      try {
        const [response, userRes] = await Promise.all([
          api.getInventoryById(id),
          api.getCurrentUser()
        ]);

        if (userRes.success) {
          if (userRes.data.role === 'accountant') {
            router.push('/dashboard');
            return;
          }
          setUser(userRes.data);
        }

        if (response.success && response.data) {
          setItem(response.data);
        } else {
          throw new Error("Item not found");
        }
      } catch (err) {
        setError(err.message || "Failed to load item");
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
          <p className="text-slate-600">Loading item...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center glass-panel px-8 py-6">
          <p className="text-amber-600 text-lg font-medium">
            {error || "Item not found"}
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 btn-ghost text-sm"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return <AddEditModal item={item} />;
}
