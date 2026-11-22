import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BookOpenText,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  ListFilter,
  Radar,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { isDemo } from "@/lib/data/source";

const groups = [
  { label: "Overview", items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }] },
  {
    label: "Investigate",
    items: [
      { title: "Transactions", url: "/transactions", icon: ListFilter },
      { title: "Analyze CSV", url: "/analyze", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Model",
    items: [
      { title: "Performance", url: "/model", icon: Gauge },
      { title: "Registry & about", url: "/registry", icon: BookOpenText },
    ],
  },
  { label: "System", items: [{ title: "Settings & API", url: "/settings", icon: Activity }] },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5" aria-label="FraudLens AI home">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-gradient-signal text-primary-foreground shadow-glow">
            <Radar className="size-4" aria-hidden />
          </span>
          <span className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
              FraudLens <span className="text-signal">AI</span>
            </span>
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              Educational
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono text-[0.65rem] uppercase tracking-widest">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} aria-current={active ? "page" : undefined}>
                          <item.icon aria-hidden />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {isDemo ? (
            <>
              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-warning">Demo mode</span>
              <p className="mt-1">No backend connected. Records shown are generated fixtures.</p>
            </>
          ) : (
            <>
              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-primary">Live API</span>
              <p className="mt-1">Data comes from your configured FraudLens backend.</p>
            </>
          )}
          <p className="mt-2 border-t border-sidebar-border pt-2">
            For learning only — not for real fraud decisions.
          </p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}