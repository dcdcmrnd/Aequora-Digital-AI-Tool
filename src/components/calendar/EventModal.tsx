"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventType } from "@/types";
import { EVENT_TYPE_COLORS } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
}

interface Props {
  mode: "create" | "edit" | "view";
  event?: CalendarEvent;
  defaultDate?: Date;
  teamMembers: TeamMember[];
  currentUserId: string;
  onSaved: (event: CalendarEvent, isNew: boolean) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultEndDate(start: Date) {
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return end;
}

export function EventModal({ mode, event, defaultDate, teamMembers, currentUserId, onSaved, onDeleted, onClose, onEdit }: Props) {
  const startBase = defaultDate ?? new Date();
  const endBase = defaultEndDate(startBase);

  const [type, setType] = useState<CalendarEventType>(event?.type as CalendarEventType ?? "event");
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startDate, setStartDate] = useState(
    event ? toLocalDatetimeValue(event.startDate) : toLocalDatetimeValue(startBase.toISOString())
  );
  const [endDate, setEndDate] = useState(
    event ? toLocalDatetimeValue(event.endDate) : toLocalDatetimeValue(endBase.toISOString())
  );
  const [startDateOnly, setStartDateOnly] = useState(
    event ? event.startDate.slice(0, 10) : toDateValue(startBase)
  );
  const [endDateOnly, setEndDateOnly] = useState(
    event ? event.endDate.slice(0, 10) : toDateValue(startBase)
  );
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    event?.attendees.map((a) => a.userId) ?? [currentUserId]
  );
  const [taskId, setTaskId] = useState(event?.taskId ?? "");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isView = mode === "view";
  const isOwner = event?.createdById === currentUserId;

  // Load tasks for linking
  useEffect(() => {
    if (isView) return;
    fetch("/api/tasks?status=!done&limit=50")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => {});
  }, [isView]);

  const toggleAttendee = (id: string) => {
    if (id === currentUserId) return; // creator always included
    setAttendeeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const buildPayload = () => {
    const start = allDay ? new Date(startDateOnly + "T00:00:00") : new Date(startDate);
    const end = allDay ? new Date(endDateOnly + "T23:59:59") : new Date(endDate);
    if (end < start) { toast.error("End must be after start."); return null; }
    return {
      title: title.trim(),
      description: description.trim() || null,
      type,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      allDay,
      location: location.trim() || null,
      taskId: taskId || null,
      attendeeIds,
    };
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required."); return; }
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      const url = mode === "edit" ? `/api/calendar/events/${event!.id}` : "/api/calendar/events";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to save."); return; }
      toast.success(mode === "edit" ? "Event updated." : "Event created.");
      onSaved(data.event, mode === "create");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/calendar/events/${event!.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete."); return; }
      toast.success("Event deleted.");
      onDeleted(event!.id);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setDeleting(false);
    }
  };

  const typeColor = EVENT_TYPE_COLORS[type];
  const viewColor = event ? (EVENT_TYPE_COLORS[event.type as CalendarEventType] ?? "#0F7B8A") : "#0F7B8A";

  const formatDateRange = (ev: CalendarEvent) => {
    const s = new Date(ev.startDate);
    const e = new Date(ev.endDate);
    const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
    if (ev.allDay) return `${s.toLocaleDateString([], opts)}${s.toDateString() !== e.toDateString() ? ` – ${e.toLocaleDateString([], opts)}` : ""}`;
    const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
    return `${s.toLocaleDateString([], opts)}, ${s.toLocaleTimeString([], timeOpts)} – ${e.toLocaleTimeString([], timeOpts)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Color bar by type */}
        <div className="h-1.5 rounded-t-card" style={{ backgroundColor: isView ? viewColor : typeColor }} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1 min-w-0">
              {isView ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full text-white capitalize"
                      style={{ backgroundColor: viewColor }}
                    >
                      {event?.type}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-text-primary">{event?.title}</h2>
                </>
              ) : (
                <h2 className="text-base font-semibold text-text-primary">
                  {mode === "create" ? "New Event" : "Edit Event"}
                </h2>
              )}
            </div>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary ml-3 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* VIEW mode */}
          {isView && event && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 text-sm text-text-secondary">
                <ClockIcon />
                <span>{formatDateRange(event)}</span>
              </div>

              {event.location && (
                <div className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <PinIcon />
                  <span>{event.location}</span>
                </div>
              )}

              {event.description && (
                <div className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <TextIcon />
                  <p className="whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {event.task && (
                <div className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <TaskIcon />
                  <span className="text-brand-primary">Linked task: {event.task.title}</span>
                </div>
              )}

              {event.attendees.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">Attendees ({event.attendees.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {event.attendees.map((a) => (
                      <div key={a.userId} className="flex items-center gap-1.5">
                        <Avatar name={a.user.name} avatarUrl={a.user.avatarUrl} size="xs" />
                        <span className="text-xs text-text-secondary">{a.user.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-text-muted pt-1">
                Created by {event.createdBy.name}
              </div>

              {isOwner && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="secondary" onClick={() => onEdit(event)} className="flex-1">Edit</Button>
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    loading={deleting}
                    className="flex-1"
                  >
                    {confirmDelete ? "Confirm Delete" : "Delete"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* CREATE / EDIT mode */}
          {!isView && (
            <div className="space-y-4">
              {/* Type selector */}
              <div className="flex gap-2">
                {(["event", "meeting", "deadline"] as CalendarEventType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-btn border transition-colors capitalize",
                      type === t ? "text-white border-transparent" : "border-border text-text-secondary hover:border-brand-primary"
                    )}
                    style={type === t ? { backgroundColor: EVENT_TYPE_COLORS[t] } : {}}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Title */}
              <input
                autoFocus
                placeholder="Event title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-input text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />

              {/* All day toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setAllDay((p) => !p)}
                  className={cn("w-9 h-5 rounded-full transition-colors relative", allDay ? "bg-brand-primary" : "bg-gray-200")}
                >
                  <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", allDay && "translate-x-4")} />
                </div>
                <span className="text-sm text-text-secondary">All day</span>
              </label>

              {/* Dates */}
              {allDay ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Start</label>
                    <input type="date" value={startDateOnly} onChange={(e) => setStartDateOnly(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">End</label>
                    <input type="date" value={endDateOnly} onChange={(e) => setEndDateOnly(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Start</label>
                    <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">End</label>
                    <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                  </div>
                </div>
              )}

              {/* Location */}
              <input
                placeholder="Location (optional)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />

              {/* Description */}
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              />

              {/* Link to task */}
              {tasks.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Link to task (optional)</label>
                  <select
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                  >
                    <option value="">— No task —</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Attendees */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Attendees</label>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map((m) => {
                    const selected = attendeeIds.includes(m.id);
                    const isMe = m.id === currentUserId;
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleAttendee(m.id)}
                        disabled={isMe}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs transition-colors",
                          selected ? "border-brand-primary bg-teal-50 text-brand-primary" : "border-border text-text-secondary hover:border-brand-primary/40",
                          isMe && "opacity-70 cursor-default"
                        )}
                      >
                        <Avatar name={m.name} avatarUrl={m.avatarUrl} size="xs" />
                        {m.name}{isMe && " (you)"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
                {mode === "edit" && (
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    loading={deleting}
                  >
                    {confirmDelete ? "Confirm" : "Delete"}
                  </Button>
                )}
                <Button onClick={handleSave} loading={saving} className="flex-1">
                  {mode === "edit" ? "Save Changes" : "Create Event"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function PinIcon() {
  return <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
}
function TextIcon() {
  return <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>;
}
function TaskIcon() {
  return <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
}
