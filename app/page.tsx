import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Hero3D } from "@/components/hero-3d";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
          <div className="flex gap-5 items-center font-semibold">
            <Link href={"/"}>Lumionfy</Link>
          </div>
          {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
        </div>
      </nav>

      {/* HERO 3D OCUPA O CENTRO */}
      <div className="flex-1 w-full relative">
        <Hero3D />
      </div>

      <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 h-16">
        <p>All rights reserved &copy; Lumionfy {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
