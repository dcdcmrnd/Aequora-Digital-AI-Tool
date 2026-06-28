"use client";

import { signOut, useSession } from "next-auth/react";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();

  const menuItems = [
    {
      label: "Sign out",
      onClick: () => signOut({ callbackUrl: "/login" }),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
      danger: true,
    },
  ];

  return (
    <header className="h-14 flex-shrink-0 bg-white border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Hamburger - mobile only */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden flex-shrink-0 p-1.5 rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        <NotificationBell />

        {session?.user && (
          <Dropdown
            trigger={
              <div className="flex items-center gap-2 cursor-pointer hover:bg-surface-hover rounded-btn px-2 py-1.5 transition-colors">
                <Avatar
                  name={session.user.name ?? "?"}
                  avatarUrl={session.user.avatarUrl}
                  size="sm"
                />
              </div>
            }
            items={menuItems}
          />
        )}
      </div>
    </header>
  );
}
