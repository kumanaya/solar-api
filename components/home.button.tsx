"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

export function HomeButton() {
  const router = useRouter();

  const home = async () => {
    router.push("/dashboard");
  };

  return (
    <Button
      onClick={home}
      variant="outline"
      className="gap-2 flex items-center"
      aria-label="Go to dashboard"
    >
      <LayoutDashboard size={20} strokeWidth={1.8} />
    </Button>
  );
}
