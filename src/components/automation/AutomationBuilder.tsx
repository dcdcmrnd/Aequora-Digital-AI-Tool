"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";
import toast from "react-hot-toast";

import { AutomationCanvas } from "@/components/automation/AutomationCanvas";
import { ExecutionLogView } from "@/components/automation/ExecutionLogView";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useAutomations } from "@/hooks/useAutomations";
import { usePipeline } from "@/hooks/usePipeline";
import { ApiError, apiFetch } from "@/lib/api-client";
import type { Automation, AutomationFlow } from "@/types";

function blankFlow(): AutomationFlow {
  return { nodes: [{ id: crypto.randomUUID(), type: "trigger", position: { x: 0, y: 0 }, data: {} }], edges: [] };
}

interface AutomationBuilderProps {
  automation?: Automation;
}

export function AutomationBuilder({ automation }: AutomationBuilderProps) {
  const router = useRouter();
  const { pipeline } = usePipeline();
  const { createAutomation, updateAutomation } = useAutomations();
  const isEditing = !!automation;

  const [name, setName] = useState(automation?.name ?? "");
  const [isActive, setIsActive] = useState(automation?.isActive ?? true);
  const [flow, setFlow] = useState<AutomationFlow>(automation?.flow ?? blankFlow());
  const [tab, setTab] = useState("builder");
  const [testOpen, setTestOpen] = useState(false);

  const isSaving = createAutomation.isPending || updateAutomation.isPending;
  const stages = pipeline?.stages ? [...pipeline.stages].sort((a, b) => a.order - b.order) : [];

  function handleSave() {
    if (!name.trim()) return;
    const input = { name: name.trim(), isActive, flow };
    const onSuccess = { onSuccess: () => router.push("/automation") };

    if (isEditing) {
      updateAutomation.mutate({ id: automation.id, ...input }, onSuccess);
    } else {
      createAutomation.mutate(input, onSuccess);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => router.push("/automation")}>
          <ArrowLeft className="size-4" />
          Back to automations
        </Button>
        <div className="flex items-center gap-3">
          {isEditing && (
            <Button variant="secondary" size="sm" onClick={() => setTestOpen(true)}>
              <UserPlus className="size-4" />
              Test with a Contact
            </Button>
          )}
          <label className="flex items-center gap-2 text-sm text-text-secondary select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
            />
            Active
          </label>
          <Button variant="secondary" onClick={() => router.push("/automation")}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={!name.trim()}>
            {isEditing ? "Save Changes" : "Create Automation"}
          </Button>
        </div>
      </div>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Automation name, e.g. Welcome new contacts"
        className="max-w-md text-base font-medium"
      />

      {isEditing ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="logs">Execution Log</TabsTrigger>
          </TabsList>
          <TabsContent value="builder">
            <AutomationCanvas flow={flow} onChange={setFlow} stages={stages} automationId={automation.id} />
          </TabsContent>
          <TabsContent value="logs">
            <ExecutionLogView automationId={automation.id} enabled={tab === "logs"} />
          </TabsContent>
        </Tabs>
      ) : (
        <AutomationCanvas flow={flow} onChange={setFlow} stages={stages} />
      )}

      {isEditing && testOpen && (
        <TestWithContactModal automationId={automation.id} onClose={() => setTestOpen(false)} />
      )}
    </div>
  );
}

function TestWithContactModal({ automationId, onClose }: { automationId: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/automations/${automationId}/enroll`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      toast.success(`Added ${email.trim()} to this workflow`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add contact");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Test with a Contact">
      <div className="space-y-4 p-6">
        <p className="text-text-secondary text-sm">
          Enter an email to run it through this workflow right now, skipping the trigger. If no contact exists with
          that email, one will be created.
        </p>
        <Input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!email.trim()}>
            Add to Workflow
          </Button>
        </div>
      </div>
    </Modal>
  );
}
