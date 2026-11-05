"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { STAGE_TOOLKITS } from "@/config/stageToolkits";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { StartupStageId } from "@/types/startup";
import { useStageWorkflow } from "@/hooks/useStageWorkflow";
import {
  ExitCriteriaCard,
  MentorPanel,
  ReadinessPanel,
  ResourcesCard,
  StageStepper,
  ToolGrid,
} from "../StageComponents";
import styles from "../StagePages.module.css";

const VALID_STAGES: StartupStageId[] = ["idea", "prototype", "early-revenue", "mature"];
export default function StageToolkitPage() {
  const params = useParams<{ stage: string }>();
  const slug = params?.stage || "";
  const valid = VALID_STAGES.includes(slug as StartupStageId);
  const stageId: StartupStageId = valid ? (slug as StartupStageId) : "idea";
  const { data, toggleExitCriterion, setCurrentStage } = useStartupWorkspace();
  const { workflow, addEvidence, submitForReview, clearCriterionReview } = useStageWorkflow();
  const [notice, setNotice] = useState("");
  if (!valid)
    return (
      <div className={styles.notFound}>
        <h1>Stage not found</h1>
        <Link href="/startup/stage">Return to stage overview</Link>
      </div>
    );

  const index = data.stages.findIndex((stage) => stage.id === stageId);
  const activeIndex = Math.max(
    0,
    data.stages.findIndex((stage) => stage.id === data.startup.currentStage),
  );
  const stage = data.stages[index];
  const definition = STAGE_TOOLKITS[stageId];
  const isCurrent = index === activeIndex;
  const isPast = index < activeIndex;
  const isLocked = index > activeIndex;
  const currentUser = data.team.find((member) => member.name === data.startup.founderName);
  const canWork = isCurrent && currentUser?.permission !== "Viewer";
  const nextStage = data.stages[index + 1];
  const allApproved = stage.exitCriteria.every(
    (criterion) => workflow.reviews[stageId]?.[criterion.id]?.status === "approved",
  );
  const allComplete = stage.exitCriteria.every((criterion) => criterion.completed);
  const submit = (criterionId: string) => {
    submitForReview(stageId, criterionId);
    setNotice("Sent for review. Mentor review isn’t connected in this demo.");
    window.setTimeout(() => setNotice(""), 3500);
  };

  return (
    <div className={styles.stagePage}>
      <a className={styles.skipLink} href="#toolkit-content">
        Skip to toolkit content
      </a>
      <header className={styles.toolkitHeader}>
        <div>
          <Link href="/startup/stage" className={styles.backLink}>
            <ArrowLeft size={14} /> All stages
          </Link>
          <span className={styles.eyebrow}>Stage toolkit · {stage.stepNumber} of 04</span>
          <h1>{stage.label} toolkit</h1>
          <p>{definition.focus}</p>
        </div>
        <div className={styles.toolStatus}>
          {isCurrent ? (
            <span className={styles.currentPill}>Current stage</span>
          ) : isPast ? (
            <span className={styles.pastPill}>
              <CheckCircle2 size={13} /> Past stage · read-only record
            </span>
          ) : (
            <span className={styles.lockedPill}>
              <LockKeyhole size={13} /> Preview · tools locked
            </span>
          )}
        </div>
      </header>
      {!isCurrent && (
        <div className={isPast ? styles.pastBanner : styles.lockedBanner}>
          {isPast ? <CheckCircle2 size={17} /> : <LockKeyhole size={17} />}
          <span>
            <strong>
              {isPast
                ? `${stage.label} is a past stage record.`
                : `${stage.label} tools are locked until your startup reaches this stage.`}
            </strong>
            <small>
              {isPast
                ? "The criteria and linked workspace activity are shown read-only."
                : `Your current stage is ${data.stages[activeIndex]?.label}. You can preview the goals and tools, but edits and shortcuts are disabled.`}
            </small>
          </span>
          <Link href="/startup/stage">
            View current stage <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <section className={styles.stepperCard}>
        <div className={styles.stepperHeading}>
          <div>
            <h2>Stage journey</h2>
            <p>{definition.nextStageGoal}</p>
          </div>
          <Link href="/startup/stage" className={styles.textLink}>
            Overview <ArrowRight size={13} />
          </Link>
        </div>
        <StageStepper stages={data.stages} currentStage={data.startup.currentStage} />
      </section>

      <div className={styles.overviewGrid} id="toolkit-content">
        <main className={styles.stageMainColumn}>
          <section className={`${styles.stageHero} ${isLocked ? styles.lockedHero : ""}`}>
            <div className={styles.heroEyebrow}>
              {isCurrent ? "CURRENT FOCUS" : isPast ? "STAGE RECORD" : "STAGE PREVIEW"}
            </div>
            <div className={styles.heroHeader}>
              <div>
                <h2>
                  {stage.label}: {definition.focus}
                </h2>
                <p>{definition.nextStageGoal}</p>
              </div>
              <span className={styles.heroBadge}>
                {stage.exitCriteria.filter((criterion) => criterion.completed).length}/
                {stage.exitCriteria.length} criteria marked met
              </span>
            </div>
            <div className={styles.heroActions}>
              {isCurrent ? (
                <span className={styles.caption}>
                  <ShieldCheck size={14} /> Stage start date isn’t recorded.
                </span>
              ) : isLocked ? (
                <span className={styles.caption}>
                  <LockKeyhole size={14} /> Stage tool access is locked.
                </span>
              ) : (
                <span className={styles.caption}>
                  <CheckCircle2 size={14} /> Past-stage checklist is read only.
                </span>
              )}
            </div>
          </section>

          {allComplete && !allApproved && isCurrent && (
            <div className={styles.completeBanner}>
              <CheckCircle2 size={18} />
              <span>
                <strong>All team checklist items are marked met.</strong>
                <small>Mentor or admin approval is still required for a stage transition.</small>
              </span>
            </div>
          )}
          {allApproved && nextStage && isCurrent && (
            <div className={styles.completeBanner}>
              <CheckCircle2 size={18} />
              <span>
                <strong>{stage.label} has been approved.</strong>
                <small>The next stage is ready to open.</small>
              </span>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setCurrentStage(nextStage.id)}
              >
                Move to {nextStage.label} <ArrowRight size={14} />
              </button>
            </div>
          )}

          <ExitCriteriaCard
            stage={stage}
            workflow={workflow}
            canWork={canWork}
            locked={isLocked}
            reviewerName={data.mentor.name}
            onToggle={(id, criterionId) => {
              toggleExitCriterion(id, criterionId);
              clearCriterionReview(id, criterionId);
            }}
            onAddEvidence={(criterionId, evidence) => addEvidence(stageId, criterionId, evidence)}
            onSubmit={submit}
          />
          {isCurrent ? (
            <ToolGrid
              definition={definition}
              tasks={data.tasks}
              documents={data.documents}
              teamCount={data.team.length}
            />
          ) : (
            <ToolGrid
              definition={definition}
              tasks={data.tasks}
              documents={data.documents}
              teamCount={data.team.length}
              locked={isLocked}
              readOnly={isPast}
            />
          )}
          {stageId === "mature" && (
            <div className={styles.healthNote}>
              <ShieldCheck size={15} />
              <span>
                Mature is the final stage. Keep this health checklist current; it is not a gate to
                another stage.
              </span>
            </div>
          )}
        </main>
        <aside className={styles.stageSideColumn} aria-label="Stage support">
          <MentorPanel
            mentor={data.mentor}
            pendingCount={
              Object.values(workflow.reviews[stageId] || {}).filter(
                (item) => item.status === "submitted",
              ).length
            }
            onMessage={() => setNotice("Mentor messaging isn’t connected in this demo.")}
          />
          <ReadinessPanel />
          <ResourcesCard definition={definition} />
        </aside>
      </div>
      {notice && (
        <div className={styles.toast} role="status">
          <CheckCircle2 size={16} />
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
