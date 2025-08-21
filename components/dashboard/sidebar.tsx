"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Home,
  BarChart3,
  Menu,
  X,
} from "lucide-react";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Nova Análise",
    href: "/dashboard/analysis",
    icon: BarChart3,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex-1 flex flex-col pt-16 pb-4 overflow-y-auto">
      <nav className="mt-5 flex-1 px-2 space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-secondary"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.title}
              </Button>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-40 md:hidden",
        isMobileMenuOpen ? "block" : "hidden"
      )}>
        <div 
          className="fixed inset-0 bg-black/50" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div className="fixed left-0 top-0 bottom-0 w-64 bg-background border-r">
          <SidebarContent />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-30 bg-background border-r">
        <SidebarContent />
      </div>
    </>
  );
}