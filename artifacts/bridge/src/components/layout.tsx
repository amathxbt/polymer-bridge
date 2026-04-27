import { Link, useLocation } from "wouter";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 mr-6">
              <div className="bg-primary/20 p-2 rounded-lg">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <span className="font-bold text-lg tracking-tight">Polymer</span>
            </Link>
            
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link
                href="/"
                className={cn(
                  "transition-colors hover:text-primary",
                  location === "/" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Bridge
              </Link>
              <Link
                href="/history"
                className={cn(
                  "transition-colors hover:text-primary",
                  location === "/history" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                History
              </Link>
              <Link
                href="/explorer"
                className={cn(
                  "transition-colors hover:text-primary",
                  location === "/explorer" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Explorer
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-6 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        <div className="z-10 w-full max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
