"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types";
import { EVENT_TYPE_COLORS } from "@/types";
import { EventModal } from "./EventModal";

interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Props {
  initialEvents: CalendarEvent[];
  teamMembers: TeamMember[];
  currentUserId: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function CalendarView({ initialEvents, teamMembers, currentUserId }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{
    open: boolean;
    mode: "create" | "edit" | "view";
    event?: CalendarEvent;
    defaultDate?: Date;
  }>({ open: false, mode: "create" });

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/events?month=${y}-${String(m + 1).padStart(2, "0")}`);
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const navigate = (dir: -1 | 1) => {
    const newDate = new Date(year, month + dir, 1);
    setYear(newDate.getFullYear());
    setMonth(newDate.getMonth());
    fetchEvents(newDate.getFullYear(), newDate.getMonth());
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    fetchEvents(today.getFullYear(), today.getMonth());
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (i < firstDay) {
      cells.push({ date: new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1), isCurrentMonth: false });
    } else if (i < firstDay + daysInMonth) {
      cells.push({ date: new Date(year, month, i - firstDay + 1), isCurrentMonth: true });
    } else {
      cells.push({ date: new Date(year, month + 1, i - firstDay - daysInMonth + 1), isCurrentMonth: false });
    }
  }

  const eventsForDay = (date: Date) =>
    events.filter((e) => isSameDay(new Date(e.startDate), date));

  const openCreate = (date: Date) => {
    setModal({ open: true, mode: "create", defaultDate: date });
  };

  const openView = (e: CalendarEvent) => {
    setModal({ open: true, mode: "view", event: e });
  };

  const handleSaved = (saved: CalendarEvent, isNew: boolean) => {
    setEvents((prev) => isNew ? [...prev, saved] : prev.map((e) => e.id === saved.id ? saved : e));
    setModal({ open: false, mode: "create" });
  };

  const handleDeleted = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setModal({ open: false, mode: "create" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {MONTHS[month]} {year}
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">Team calendar — shared events and meetings</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 mr-4">
            {(["meeting", "event", "deadline"] as const).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: EVENT_TYPE_COLORS[t] }} />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            ))}
          </div>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm border border-border rounded-btn hover:bg-surface-secondary transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-btn hover:bg-surface-secondary transition-colors"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-btn hover:bg-surface-secondary transition-colors"
          >
            <ChevronRight />
          </button>
          <button
            onClick={() => setModal({ open: true, mode: "create", defaultDate: today })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-sm font-medium rounded-btn hover:bg-brand-primary/90 transition-colors"
          >
            <span className="text-base leading-none">+</span> New Event
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className={cn("flex-1 bg-white border border-border rounded-card overflow-hidden", loading && "opacity-60 pointer-events-none")}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-text-muted uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        <div className="grid grid-cols-7 h-[calc(100%-36px)]">
          {cells.map(({ date, isCurrentMonth }, i) => {
            const dayEvents = eventsForDay(date);
            const isToday = isSameDay(date, today);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <div
                key={i}
                suppressHydrationWarning
                onClick={() => isCurrentMonth && openCreate(date)}
                className={cn(
                  "border-r border-b border-border p-1.5 min-h-[100px] cursor-pointer group transition-colors",
                  !isCurrentMonth && "bg-surface-secondary/40",
                  isCurrentMonth && !isToday && "hover:bg-blue-50/30",
                  isWeekend && isCurrentMonth && "bg-slate-50/50",
                  (i + 1) % 7 === 0 && "border-r-0"
                )}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    suppressHydrationWarning
                    className={cn(
                      "w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full",
                      isToday ? "bg-brand-primary text-white" : isCurrentMonth ? "text-text-primary" : "text-text-muted"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {isCurrentMonth && (
                    <span className="opacity-0 group-hover:opacity-100 text-text-muted text-xs leading-none transition-opacity">+</span>
                  )}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); openView(ev); }}
                      className="w-full text-left truncate text-[11px] font-medium px-1.5 py-0.5 rounded text-white leading-tight"
                      style={{ backgroundColor: EVENT_TYPE_COLORS[ev.type as keyof typeof EVENT_TYPE_COLORS] ?? "#0F7B8A" }}
                    >
                      {!ev.allDay && <span className="opacity-80">{formatTime(ev.startDate)} </span>}
                      {ev.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openView(dayEvents[3]); }}
                      className="text-[11px] text-text-muted pl-1 hover:text-brand-primary"
                    >
                      +{dayEvents.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal.open && (
        <EventModal
          mode={modal.mode}
          event={modal.event}
          defaultDate={modal.defaultDate}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onClose={() => setModal({ open: false, mode: "create" })}
          onEdit={(ev) => setModal({ open: true, mode: "edit", event: ev })}
        />
      )}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
