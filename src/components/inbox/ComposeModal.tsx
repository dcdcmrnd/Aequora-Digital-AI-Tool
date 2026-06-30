"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

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
          body: body.replace(/\n/g, "<br>"),
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
            rows={10}
            placeholder="Write your message..."
            className="w-full border border-border rounded-btn px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
          />
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
