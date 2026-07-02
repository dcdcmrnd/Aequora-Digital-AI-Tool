"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import type { ChatRoom } from "./ChatPageClient";

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl: string | null };
}

interface AudioMessage {
  type: "audio";
  url: string;
  duration: number;
}

interface ImageMessage {
  type: "image" | "gif";
  url: string;
  alt?: string;
  caption?: string;
}

function parseContent(content: string):
  | { isAudio: true; audio: AudioMessage; isImage: false }
  | { isImage: true; image: ImageMessage; isAudio: false }
  | { isAudio: false; isImage: false; text: string } {
  const trimmed = content.trim();
  if (trimmed.startsWith('{"type":"')) {
    try {
      const parsed = JSON.parse(trimmed) as AudioMessage | ImageMessage;
      if (parsed.type === "audio") {
        return { isAudio: true, audio: parsed as AudioMessage, isImage: false };
      }
      if (parsed.type === "image" || parsed.type === "gif") {
        return { isAudio: false, isImage: true, image: parsed as ImageMessage };
      }
    } catch {}
  }

  const imageUrlPattern = /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
  if (imageUrlPattern.test(content.trim())) {
    return {
      isAudio: false,
      isImage: true,
      image: { type: "image", url: content.trim() },
    };
  }

  return { isAudio: false, isImage: false, text: content };
}

interface Props {
  room: ChatRoom;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  onMessagesRead: () => void;
  onEditGroup: () => void;
}

function getRoomTitle(room: ChatRoom, currentUserId: string) {
  if (room.name) return room.name;
  const other = room.members.find((m) => m.id !== currentUserId);
  return other?.name ?? "Chat";
}

export function MessageThread({ room, currentUserId, currentUserName, isAdmin, onMessagesRead, onEditGroup }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onMessagesReadRef = useRef(onMessagesRead);
  useEffect(() => { onMessagesReadRef.current = onMessagesRead; });

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        onMessagesReadRef.current();
      }
    } catch {}
    finally { setLoading(false); }
  }, [room.id]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetchMessages();
  }, [room.id, fetchMessages]);

  useEffect(() => {
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const sendMessage = async (content: string) => {
    if (!content || sending) return;
    setSending(true);

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      content,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      sender: { id: currentUserId, name: currentUserName, avatarUrl: null },
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data.message : m)));
      }
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text && !selectedFile) return;
    setInput("");
    setSelectedFile(null);
    setPreviewUrl(null);

    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();

        const type = selectedFile.type.includes("gif") ? "gif" : "image";
        const imagePayload: ImageMessage = {
          type,
          url,
          alt: text || "Shared image",
          caption: text || undefined,
        };
        await sendMessage(JSON.stringify(imagePayload));
      } catch (error) {
        console.error("Image upload failed", error);
      }
      return;
    }

    if (text) {
      await sendMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const addEmoji = (emoji: string) => {
    setInput((current) => current + emoji);
    setShowPicker(false);
  };

  const uploadSelectedFile = async (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Only image files are supported.");
      return;
    }
    uploadSelectedFile(file);
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          uploadSelectedFile(file);
        }
        break;
      }
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Only image files are supported.");
      return;
    }
    uploadSelectedFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = recordingTime;
        setRecordingTime(0);

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 100) return; // too short / empty

        setUploadingAudio(true);
        try {
          const formData = new FormData();
          formData.append("file", blob, `voice-${Date.now()}.webm`);
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Upload failed");
          const { url } = await res.json();
          const content = JSON.stringify({ type: "audio", url, duration });
          await sendMessage(content);
        } catch {
          // toast would require importing, keep it silent or use alert
          console.error("Failed to upload audio");
        } finally {
          setUploadingAudio(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      let t = 0;
      recordingTimerRef.current = setInterval(() => {
        t += 1;
        setRecordingTime(t);
        if (t >= 120) stopRecording(); // max 2 min
      }, 1000);
    } catch {
      alert("Microphone access denied. Please allow microphone permission.");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const title = getRoomTitle(room, currentUserId);
  const otherMembers = room.members.filter((m) => m.id !== currentUserId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
          {room.isGroup ? (
            <p className="text-xs text-text-muted">{room.members.length} members</p>
          ) : (
            <p className="text-xs text-text-muted truncate">{otherMembers.map((m) => m.name).join(", ")}</p>
          )}
        </div>
        {room.isGroup && (isAdmin || currentUserId === room.createdById) && (
          <button
            onClick={onEditGroup}
            title="Edit group"
            className="flex-shrink-0 p-2 text-text-muted hover:text-text-primary hover:bg-surface-secondary rounded-btn transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isMine = msg.senderId === currentUserId;
              const prev = messages[i - 1];
              const showAvatar = !isMine && (!prev || prev.senderId !== msg.senderId);
              const parsed = parseContent(msg.content);

              return (
                <div key={msg.id} className={cn("flex items-end gap-2", isMine && "flex-row-reverse")}>
                  {!isMine ? (
                    showAvatar ? (
                      <Avatar name={msg.sender.name} avatarUrl={msg.sender.avatarUrl} size="sm" />
                    ) : (
                      <div className="w-8 flex-shrink-0" />
                    )
                  ) : null}

                  <div className={cn("max-w-[70%] flex flex-col", isMine && "items-end")}>
                    {showAvatar && !isMine && (
                      <span className="text-[11px] text-text-muted mb-1 ml-1">{msg.sender.name}</span>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl text-sm leading-relaxed overflow-hidden",
                        isMine
                          ? "bg-brand-primary text-white rounded-br-sm"
                          : "bg-surface-secondary text-text-primary rounded-bl-sm",
                        parsed.isAudio || parsed.isImage ? "min-w-[200px]" : "px-3 py-2"
                      )}
                    >
                      {parsed.isAudio ? (
                        <AudioPlayer audio={parsed.audio} isMine={isMine} />
                      ) : parsed.isImage ? (
                        <div className="max-w-[24rem] rounded-2xl overflow-hidden bg-black/5">
                          <img
                            src={parsed.image.url}
                            alt={parsed.image.alt ?? "Shared image"}
                            className="w-full h-auto object-cover"
                          />
                          {parsed.image.caption ? (
                            <div className="px-3 py-2 bg-surface-secondary text-text-primary text-sm">
                              {parsed.image.caption}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap break-words">{parsed.text}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted mt-1 mx-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-border flex-shrink-0">
        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-sm text-red-600 font-medium flex-1">Recording… {formatDuration(recordingTime)}</span>
            <button
              onClick={stopRecording}
              className="text-xs text-red-600 font-medium hover:text-red-700 border border-red-300 rounded px-2 py-0.5"
            >
              Stop
            </button>
          </div>
        )}
        {uploadingAudio && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-surface-secondary rounded-xl">
            <div className="w-3 h-3 border-2 border-brand-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-text-muted">Sending voice message…</span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowPicker((open) => !open)}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center border border-border rounded-xl text-text-muted hover:text-brand-primary hover:border-brand-primary transition-colors"
          >
            <span className="text-lg">😊</span>
          </button>

          <label className="flex-shrink-0 w-9 h-9 flex items-center justify-center border border-border rounded-xl text-text-muted hover:text-brand-primary hover:border-brand-primary transition-colors cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16.5V19a2 2 0 002 2h12a2 2 0 002-2v-2.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 13.5l-4.5 4.5L7.5 13.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            </svg>
          </label>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={uploadingAudio}
            title={isRecording ? "Stop recording" : "Record voice message"}
            className={cn(
              "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40",
              isRecording
                ? "bg-red-500 text-white hover:bg-red-600"
                : "border border-border text-text-muted hover:text-brand-primary hover:border-brand-primary"
            )}
          >
            {isRecording ? <StopIcon /> : <MicIcon />}
          </button>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex-1 rounded-xl border transition-colors",
              dragActive ? "border-brand-primary bg-brand-primary/5" : "border-border bg-surface-secondary"
            )}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder={`Message ${title}…`}
              disabled={isRecording}
              className="w-full resize-none px-3 py-2 text-sm bg-transparent border-none outline-none focus:outline-none focus:ring-0 placeholder:text-text-muted max-h-32 disabled:opacity-50"
              style={{ minHeight: "40px" }}
            />
          </div>
          <button
            onClick={send}
            disabled={(!input.trim() && !selectedFile) || sending || isRecording}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        {previewUrl && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border overflow-hidden bg-surface-secondary">
            <img src={previewUrl} alt="Preview" className="h-16 w-16 object-cover" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Image ready to send</p>
              <button
                type="button"
                onClick={removeSelectedFile}
                className="text-[11px] text-text-muted hover:text-text-primary"
              >
                Remove
              </button>
            </div>
          </div>
        )}
        {showPicker && (
          <div className="mt-3 grid grid-cols-6 gap-2 rounded-2xl border border-border bg-white p-3 shadow-sm">
            {[
              "😀",
              "😂",
              "😍",
              "😎",
              "😭",
              "👍",
              "🎉",
              "🔥",
              "💬",
              "🥳",
              "🤖",
              "❤️",
            ].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="h-10 w-10 rounded-xl text-lg hover:bg-surface-secondary transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <p className="text-[10px] text-text-muted mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ─── Audio Player ─────────────────────────────────────────────────────────────

function AudioPlayer({ audio, isMine }: { audio: AudioMessage; isMine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); } else { el.play(); }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <audio
        ref={audioRef}
        src={audio.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
      />

      <button
        onClick={toggle}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
          isMine ? "bg-white/20 hover:bg-white/30" : "bg-brand-primary/15 hover:bg-brand-primary/25"
        )}
      >
        {playing ? (
          <svg className={cn("w-3 h-3", isMine ? "text-white" : "text-brand-primary")} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className={cn("w-3 h-3 ml-0.5", isMine ? "text-white" : "text-brand-primary")} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform bars (decorative) */}
      <div className="flex items-center gap-0.5 flex-1">
        {Array.from({ length: 20 }).map((_, i) => {
          const height = [3, 5, 8, 6, 10, 7, 4, 9, 6, 8, 5, 7, 10, 6, 4, 8, 5, 7, 3, 6][i];
          const played = currentTime / (audio.duration || 1);
          const isPlayed = i / 20 < played;
          return (
            <div
              key={i}
              className={cn(
                "w-1 rounded-full transition-colors",
                isPlayed
                  ? isMine ? "bg-white/70" : "bg-brand-primary"
                  : isMine ? "bg-white/30" : "bg-brand-primary/30"
              )}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      <span className={cn("text-[10px] flex-shrink-0 tabular-nums", isMine ? "text-white/70" : "text-text-muted")}>
        {formatDuration(playing ? Math.floor(currentTime) : audio.duration)}
      </span>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
