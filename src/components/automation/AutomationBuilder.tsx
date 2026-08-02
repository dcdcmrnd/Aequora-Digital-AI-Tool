"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { AutomationCanvas } from "@/components/automation/AutomationCanvas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAutomations } from "@/hooks/useAutomations";
import { usePipeline } from "@/hooks/usePipeline";
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

      <AutomationCanvas flow={flow} onChange={setFlow} stages={stages} />
    </div>
  );
}
