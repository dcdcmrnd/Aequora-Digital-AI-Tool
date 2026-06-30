"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

interface Signature {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  user: { id: string; name: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  mode?: "compose" | "reply";
}

export function ComposeModal({
  open,
  onClose,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  threadId,
  inReplyTo,
  references,
  mode = "compose",
}: Props) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [selectedSigId, setSelectedSigId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/signatures")
      .then((r) => r.json())
      .then((d) => {
        const sigs: Signature[] = d.signatures ?? [];
        setSignatures(sigs);
        const def = sigs.find((s) => s.isDefault);
        if (def) setSelectedSigId(def.id);
      })
      .catch(() => {});
  }, [open]);

  const selectedSig = signatures.find((s) => s.id === selectedSigId);

  const buildFullBody = () => {
    const sigBlock = selectedSig
      ? `\n\n--\n${selectedSig.content}`
      : "";
    return (body + sigBlock).replace(/\n/g, "<br>");
  };

  const handleSend = async () => {
    if (!to.trim()) { toast.error("Recipient is required."); return; }
    if (!subject.trim()) { toast.error("Subject is required."); return; }
    if (!body.trim()) { toast.error("Message body is required."); return; }

    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          body: buildFullBody(),
          threadId,
          inReplyTo,
          references,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success(mode === "reply" ? "Reply sent." : "Email sent.");
      onClose();
    } catch {
      toast.error("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === "reply" ? "Reply" : "New Message"} size="lg">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full border border-border rounded-btn px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full border border-border rounded-btn px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write your message..."
            className="w-full border border-border rounded-btn px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
          />
        </div>

        {/* Signature selector */}
        <div className="border border-border rounded-btn overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-surface-secondary/50 border-b border-border">
            <span className="text-xs font-medium text-text-secondary">Signature</span>
            <select
              value={selectedSigId}
              onChange={(e) => setSelectedSigId(e.target.value)}
              className="text-xs border-0 bg-transparent text-text-primary focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="">— No signature —</option>
              {signatures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
          {selectedSig ? (
            <div className="px-3 py-2 text-xs text-text-muted whitespace-pre-wrap font-sans leading-relaxed">
              {selectedSig.content}
            </div>
          ) : (
            <div className="px-3 py-2 text-xs text-text-muted italic">No signature selected</div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} loading={sending}>
            <SendIcon />
            {mode === "reply" ? "Send Reply" : "Send"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
