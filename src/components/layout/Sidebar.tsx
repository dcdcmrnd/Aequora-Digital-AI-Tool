"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermission } from "@/hooks/usePermission";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function NavLink({ href, label, icon }: NavItem) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-btn text-sm font-medium transition-colors",
        isActive
          ? "bg-white/10 text-white"
          : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
      )}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const canViewProjects = usePermission("projects.view");
  const canViewTasks = usePermission("tasks.view");
  const canViewNotes = usePermission("notes.view");
  const canViewTeam = usePermission("team.view");
  const canUseAI =
    usePermission("ai.task_assistant") || usePermission("ai.consultant");
  const isAdmin = session?.user?.role === "admin";

  return (
    <aside className="w-sidebar flex-shrink-0 bg-brand-dark flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-btn bg-brand-primary flex items-center justify-center">
            <WaveIcon />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Aequora Digital</p>
            <p className="text-[#64748B] text-xs">Workspace</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
        <NavLink
          href="/"
          label="Dashboard"
          icon={<HomeIcon />}
        />

        {canViewProjects && (
          <NavLink
            href="/projects"
            label="Projects"
            icon={<FolderIcon />}
          />
        )}

        {canViewTasks && (
          <NavLink
            href="/tasks"
            label="My Tasks"
            icon={<CheckSquareIcon />}
          />
        )}

        {canViewNotes && (
          <NavLink
            href="/notes"
            label="Notes"
            icon={<FileTextIcon />}
          />
        )}

        {canViewTeam && (
          <NavLink
            href="/team"
            label="Team"
            icon={<UsersIcon />}
          />
        )}

        <NavLink
          href="/calendar"
          label="Calendar"
          icon={<CalendarIcon />}
        />

        {canUseAI && (
          <NavLink
            href="/ai"
            label="AI Assistant"
            icon={<SparklesIcon />}
          />
        )}
      </nav>

      {/* User + Settings */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {isAdmin && (
          <NavLink
            href="/settings"
            label="Settings"
            icon={<SettingsIcon />}
          />
        )}
        {session?.user && (
          <Link
            href="/profile"
            className="flex items-center gap-3 px-3 py-2 mt-1 rounded-btn hover:bg-white/5 transition-colors"
          >
            <Avatar
              name={session.user.name ?? "?"}
              avatarUrl={session.user.avatarUrl}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {session.user.name}
              </p>
              <p className="text-[#64748B] text-xs truncate capitalize">
                {session.user.role}
              </p>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12c1.5-3 3-4.5 4.5-4.5S10.5 9 12 9s3-1.5 4.5-1.5S19.5 9 21 12" strokeLinecap="round" />
      <path d="M3 17c1.5-3 3-4.5 4.5-4.5S10.5 14.5 12 14.5s3-1.5 4.5-1.5S19.5 14.5 21 17" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CheckSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z" />
      <path d="M5 6l.75 2.25L8 9l-2.25.75L5 12l-.75-2.25L2 9l2.25-.75z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
