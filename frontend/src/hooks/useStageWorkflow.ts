"use client";

import { useEffect, useState } from "react";
import { StartupStageId } from "@/types/startup";

export interface StageEvidence {
  id: string;
  title: string;
  value: string;
  type: "note" | "link";
  createdAt: string;
}
export interface CriterionReview {
  status: "submitted" | "approved" | "changes-requested";
  note?: string;
  updatedAt: string;
}
export interface LocalStageRequest {
  from: StartupStageId;
  to: StartupStageId;
  reason: string;
  requestedAt: string;
  status: "pending" | "declined";
  reviewerNote?: string;
}
export interface StageWorkflowState {
  evidence: Partial<Record<StartupStageId, Record<string, StageEvidence[]>>>;
  reviews: Partial<Record<StartupStageId, Record<string, CriterionReview>>>;
  request: LocalStageRequest | null;
}
const STORAGE_KEY = "meridian-startup-stage-workflow-v1";
const EMPTY: StageWorkflowState = { evidence: {}, reviews: {}, request: null };
export function useStageWorkflow() {
  const [workflow, setWorkflow] = useState<StageWorkflowState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setWorkflow({ ...EMPTY, ...(JSON.parse(raw) as Partial<StageWorkflowState>) });
    } catch {
      setWorkflow(EMPTY);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow));
    } catch {
      /* The page remains usable without browser storage. */
    }
  }, [workflow, loaded]);
  const addEvidence = (
    stageId: StartupStageId,
    criterionId: string,
    evidence: Omit<StageEvidence, "id" | "createdAt">,
  ) => {
    const created: StageEvidence = {
      ...evidence,
      id: `ev-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setWorkflow((prev) => ({
      ...prev,
      evidence: {
        ...prev.evidence,
        [stageId]: {
          ...prev.evidence[stageId],
          [criterionId]: [...(prev.evidence[stageId]?.[criterionId] || []), created],
        },
      },
    }));
  };
  const submitForReview = (stageId: StartupStageId, criterionId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      reviews: {
        ...prev.reviews,
        [stageId]: {
          ...prev.reviews[stageId],
          [criterionId]: { status: "submitted", updatedAt: new Date().toISOString() },
        },
      },
    }));
  };
  const clearCriterionReview = (stageId: StartupStageId, criterionId: string) => {
    setWorkflow((prev) => {
      const reviews = { ...prev.reviews[stageId] };
      delete reviews[criterionId];
      return { ...prev, reviews: { ...prev.reviews, [stageId]: reviews } };
    });
  };
  const requestStageChange = (from: StartupStageId, to: StartupStageId, reason: string) => {
    setWorkflow((prev) => ({
      ...prev,
      request: { from, to, reason, requestedAt: new Date().toISOString(), status: "pending" },
    }));
  };
  const cancelStageChange = () => setWorkflow((prev) => ({ ...prev, request: null }));
  return {
    workflow,
    loaded,
    addEvidence,
    submitForReview,
    clearCriterionReview,
    requestStageChange,
    cancelStageChange,
  };
}
