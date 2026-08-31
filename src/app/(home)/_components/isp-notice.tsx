"use client";

import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "isp-access-notice-dismissed";

export function IspNotice() {
  const [isDismissed, setIsDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setIsDismissed(stored === "true");
    } catch {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setIsDismissed(true);
  };

  if (!mounted || isDismissed) {
    return null;
  }

  return (
    <div className="bg-green-500/10 border border-green-500/20 rounded-md p-4 flex items-start gap-3">
      <p className="text-green-500 text-sm flex-1 min-w-0">
        <strong>Notice:</strong> I've talked with the US-based ISPs blocking the
        website and it should be accessible again now. If you still experience
        issues, please contact me on Discord (joexyz).
      </p>

      <Button
        variant="ghost"
        size="icon-xs"
        className="text-green-500 hover:text-green-500 hover:bg-green-500/10"
        onClick={handleDismiss}
      >
        <XIcon />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
