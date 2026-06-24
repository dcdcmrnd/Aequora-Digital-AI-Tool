"use client";

import { ALL_PERMISSIONS, type PermissionType } from "@/types";

interface Props {
  selected: PermissionType[];
  onChange: (perms: PermissionType[]) => void;
  disabled?: boolean;
}

const GROUPS = ["Projects", "Tasks", "Notes", "Team", "AI", "Admin"];

export function UserPermissionsEditor({ selected, onChange, disabled }: Props) {
  const toggle = (key: PermissionType) => {
    if (disabled) return;
    const next = selected.includes(key)
      ? selected.filter((p) => p !== key)
      : [...selected, key];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => {
        const perms = ALL_PERMISSIONS.filter((p) => p.group === group);
        return (
          <div key={group}>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              {group}
            </p>
            <div className="space-y-1.5">
              {perms.map((perm) => (
                <label
                  key={perm.key}
                  className={`flex items-center gap-3 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(perm.key)}
                    onChange={() => toggle(perm.key)}
                    disabled={disabled}
                    className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-sm text-text-primary">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
