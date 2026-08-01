"use client";

import { useState } from "react";
import { Plus, Settings } from "lucide-react";

import { OpportunityFormModal } from "@/components/pipeline/OpportunityFormModal";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { StageManager } from "@/components/pipeline/StageManager";
import { Button } from "@/components/ui/Button";
import { useOpportunities } from "@/hooks/useOpportunities";
import { usePermission } from "@/hooks/usePermission";
import { usePipeline } from "@/hooks/usePipeline";
import type { Opportunity } from "@/types";

export function PipelineView() {
  const { pipeline, isLoading: pipelineLoading } = usePipeline();
  const { opportunities, isLoading: opportunitiesLoading, updateOpportunity } = useOpportunities();
  const canManage = usePermission("pipeline.manage");

  const [adding, setAdding] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [managingStages, setManagingStages] = useState(false);

  async function handleStageChange(opportunityId: string, stageId: string) {
    await updateOpportunity.mutateAsync({ id: opportunityId, stageId });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-text-muted text-sm">Track opportunities as they move toward a close.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setManagingStages((v) => !v)}>
              <Settings className="size-4" />
              Manage Stages
            </Button>
            <Button onClick={() => setAdding(true)} disabled={!pipeline}>
              <Plus className="size-4" />
              Add Opportunity
            </Button>
          </div>
        )}
      </div>

      {managingStages && pipeline && <StageManager pipeline={pipeline} onClose={() => setManagingStages(false)} />}

      {pipelineLoading || opportunitiesLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : pipeline ? (
        <PipelineBoard
          stages={[...pipeline.stages].sort((a, b) => a.order - b.order)}
          opportunities={opportunities ?? []}
          canEdit={canManage}
          onStageChange={handleStageChange}
          onCardClick={(opportunity) => setEditingOpportunity(opportunity)}
        />
      ) : (
        <p className="text-text-muted text-sm">Couldn&apos;t load the pipeline.</p>
      )}

      {adding && pipeline && (
        <OpportunityFormModal open={adding} onClose={() => setAdding(false)} pipeline={pipeline} />
      )}

      {editingOpportunity && pipeline && (
        <OpportunityFormModal
          open={!!editingOpportunity}
          onClose={() => setEditingOpportunity(null)}
          pipeline={pipeline}
          opportunity={editingOpportunity}
        />
      )}
    </div>
  );
}
