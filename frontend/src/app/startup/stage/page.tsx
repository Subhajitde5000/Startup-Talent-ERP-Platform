"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  MessageSquare,
  MoveRight,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { STAGE_TOOLKITS } from "@/config/stageToolkits";
import { StartupStageId } from "@/types/startup";
import { useStageWorkflow } from "@/hooks/useStageWorkflow";
import {
  ExitCriteriaCard,
  MentorPanel,
  ReadinessPanel,
  ResourcesCard,
  StageRequestDialog,
  StageStepper,
  ToolGrid,
} from "./StageComponents";
import styles from "./StagePages.module.css";

export default function StageOverviewPage() {
  const { data, toggleExitCriterion, setCurrentStage } = useStartupWorkspace();
  const {
    workflow,
    addEvidence,
    submitForReview,
    clearCriterionReview,
    requestStageChange,
    cancelStageChange,
  } = useStageWorkflow();
  const [requestOpen, setRequestOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const activeIndex = Math.max(
    0,
    data.stages.findIndex((stage) => stage.id === data.startup.currentStage),
  );
  const currentStage = data.stages[activeIndex] || data.stages[0];
  const nextStage = data.stages[activeIndex + 1];
  const kit = STAGE_TOOLKITS[currentStage.id];
  const reviewer = data.team.find((member) => member.name === data.startup.founderName);
  const canManage = !reviewer || reviewer.permission === "Owner" || reviewer.permission === "Admin";
  const canWork = reviewer?.permission !== "Viewer";
  const completed = currentStage.exitCriteria.filter((criterion) => criterion.completed).length;
  const approved = currentStage.exitCriteria.every(
    (criterion) => workflow.reviews[currentStage.id]?.[criterion.id]?.status === "approved",
  );
  const pendingRequest =
    workflow.request?.status === "pending" && workflow.request.from === currentStage.id
      ? workflow.request
      : null;
  const rejectedRequest =
    workflow.request?.status === "declined" && workflow.request.from === currentStage.id
      ? workflow.request
      : null;
  const linkedToolsCount = kit.tools.filter((tool) =>
    tool.progressKind === "tasks"
      ? data.tasks.some((task) => task.moduleHref === tool.moduleHref)
      : tool.progressKind === "documents"
        ? data.documents.length > 0
        : tool.progressKind === "team"
          ? data.team.length > 0
          : false,
  ).length;
  const evidenceSubmit = (criterionId: string) => {
    submitForReview(currentStage.id, criterionId);
    setNotice("Sent for review. Mentor review isn’t connected in this demo.");
    window.setTimeout(() => setNotice(""), 3500);
  };

  return (
    <div className={styles.stagePage}>
      <a className={styles.skipLink} href="#stage-overview">
        Skip to stage overview
      </a>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Startup workspace · Stage toolkit</span>
          <h1>Your stage</h1>
          <p>Where you are and what it takes to move up.</p>
        </div>
        <div className={styles.headerActions}>
          {nextStage ? (
            <button
              type="button"
              title={
                !canManage
                  ? "Only an Owner or Admin can request a stage change."
                  : !approved
                    ? "Complete and receive approval for all exit criteria first."
                    : undefined
              }
              disabled={!canManage || Boolean(pendingRequest)}
              className={styles.primaryButton}
              onClick={() => setRequestOpen(true)}
            >
              <MoveRight size={15} /> Request stage change
            </button>
          ) : (
            <span className={styles.finalStageLabel}>
              <ShieldCheck size={15} /> Final stage · keep the health checklist current
            </span>
          )}
        </div>
      </header>

      {pendingRequest && (
        <div className={styles.requestBanner}>
          <Clock3 size={17} />
          <span>
            <strong>
              Your request to move to{" "}
              {data.stages.find((stage) => stage.id === pendingRequest.to)?.label} is under review.
            </strong>
            <small>
              Submitted {new Date(pendingRequest.requestedAt).toLocaleDateString("en-IN")} ·{" "}
              {pendingRequest.reason || "All criteria submitted for review"}
            </small>
          </span>
          <button
            type="button"
            onClick={() => {
              cancelStageChange();
              setNotice("Stage request cancelled.");
            }}
          >
            Cancel request
          </button>
        </div>
      )}
      {rejectedRequest && (
        <div className={`${styles.requestBanner} ${styles.declinedBanner}`}>
          <CircleHelpIcon />
          <span>
            <strong>Stage request declined.</strong>
            <small>{rejectedRequest.reviewerNote || "Review note was not provided."}</small>
          </span>
          <button type="button" onClick={() => cancelStageChange()}>
            Dismiss
          </button>
        </div>
      )}
      {completed === currentStage.exitCriteria.length && !approved && (
        <div className={styles.completeBanner}>
          <CheckCircle2 size={18} />
          <span>
            <strong>Team checklist complete for {currentStage.label}.</strong>
            <small>Mentor approval is still required before this stage is marked approved.</small>
          </span>
        </div>
      )}

      <section className={styles.stepperCard}>
        <div className={styles.stepperHeading}>
          <div>
            <h2>Four-stage journey</h2>
            <p>Select a stage to open its toolkit or preview.</p>
          </div>
          <span className={styles.stageCount}>
            Stage {activeIndex + 1} of {data.stages.length}
          </span>
        </div>
        <StageStepper stages={data.stages} currentStage={currentStage.id} />
        <div className={styles.activeStageMeta}>
          <span>
            <strong>{currentStage.label}</strong> · since start date not recorded
          </span>
          <span className={styles.currentPill}>
            <Sparkles size={12} /> Current stage
          </span>
        </div>
      </section>

      <div className={styles.overviewGrid} id="stage-overview">
        <main className={styles.stageMainColumn}>
          <section className={styles.stageHero}>
            <div className={styles.heroEyebrow}>CURRENT FOCUS</div>
            <div className={styles.heroHeader}>
              <div>
                <h2>{currentStage.label}</h2>
                <p>{kit.focus}</p>
              </div>
              <span className={styles.heroBadge}>
                <CheckCircle2 size={14} /> {completed}/{currentStage.exitCriteria.length} criteria
                met
              </span>
            </div>
            <div className={styles.heroStats}>
              <div>
                <strong>
                  {completed} <small>/ {currentStage.exitCriteria.length}</small>
                </strong>
                <span>Criteria marked met</span>
              </div>
              <div>
                <strong>{linkedToolsCount}</strong>
                <span>Tools with linked workspace data</span>
              </div>
              <div>
                <strong>—</strong>
                <span>Days in stage · start date not recorded</span>
              </div>
            </div>
            <div className={styles.heroActions}>
              <Link href={`/startup/stage/${currentStage.id}`} className={styles.primaryButton}>
                Open {currentStage.label} toolkit <ArrowRight size={15} />
              </Link>
              <span>Next stage goal: {kit.nextStageGoal}</span>
            </div>
          </section>

          <ExitCriteriaCard
            stage={currentStage}
            workflow={workflow}
            canWork={canWork}
            reviewerName={data.mentor.name}
            onToggle={(stageId, criterionId) => {
              toggleExitCriterion(stageId, criterionId);
              clearCriterionReview(stageId, criterionId);
            }}
            onAddEvidence={(criterionId, evidence) =>
              addEvidence(currentStage.id, criterionId, evidence)
            }
            onSubmit={evidenceSubmit}
          />

          <section className={styles.toolsPreview}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Tools for this stage</h2>
                <p>Open a workspace tool without losing the stage context.</p>
              </div>
              <Link href={`/startup/stage/${currentStage.id}`}>
                Open toolkit <ArrowRight size={14} />
              </Link>
            </div>
            <ToolGrid
              definition={{ ...kit, tools: kit.tools.slice(0, 4) }}
              tasks={data.tasks}
              documents={data.documents}
              teamCount={data.team.length}
              compact
            />
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Journey roadmap</h2>
                <p>Past records remain viewable; future toolkits unlock as your stage changes.</p>
              </div>
            </div>
            <div className={styles.roadmapGrid}>
              {data.stages.map((stage, index) => {
                const status =
                  index < activeIndex
                    ? "Past stage"
                    : index === activeIndex
                      ? "Current"
                      : "Locked preview";
                const definition = STAGE_TOOLKITS[stage.id];
                const allMet =
                  stage.exitCriteria.length > 0 &&
                  stage.exitCriteria.every((item) => item.completed);
                return (
                  <article
                    key={stage.id}
                    className={`${styles.roadmapCard} ${index === activeIndex ? styles.roadmapCurrent : index > activeIndex ? styles.roadmapLocked : ""}`}
                  >
                    <div className={styles.roadmapTop}>
                      <span>{stage.stepNumber}</span>
                      <span className={styles.roadmapStatus}>
                        {index > activeIndex && <LockKeyhole size={11} />}
                        {status}
                      </span>
                    </div>
                    <h3>{stage.label}</h3>
                    <p>{definition.focus}</p>
                    <div className={styles.roadmapMeta}>
                      <strong>Key tools</strong>
                      <span>
                        {definition.tools
                          .slice(0, 3)
                          .map((tool) => tool.title)
                          .join(" · ")}
                      </span>
                    </div>
                    <div className={styles.roadmapMeta}>
                      <strong>Exit criteria</strong>
                      <span>
                        {allMet
                          ? "All checklist items marked met"
                          : `${stage.exitCriteria.filter((item) => item.completed).length} of ${stage.exitCriteria.length} marked met`}
                      </span>
                    </div>
                    <Link href={`/startup/stage/${stage.id}`} className={styles.roadmapLink}>
                      {index > activeIndex
                        ? "Preview stage"
                        : index < activeIndex
                          ? "View record"
                          : "Current toolkit"}{" "}
                      <ArrowRight size={13} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Stage history</h2>
                <p>Stage start dates and approval events</p>
              </div>
            </div>
            <div className={styles.historyEmpty}>
              <span className={styles.historyTimeline} />
              <span className={styles.historyEmptyIcon}>
                <Clock3 size={17} />
              </span>
              <div>
                <strong>No stage history recorded</strong>
                <p>
                  History will appear here when stage changes and mentor approvals are connected.
                </p>
              </div>
            </div>
          </section>
        </main>
        <aside className={styles.stageSideColumn} aria-label="Stage support">
          <MentorPanel
            mentor={data.mentor}
            pendingCount={
              Object.values(workflow.reviews[currentStage.id] || {}).filter(
                (item) => item.status === "submitted",
              ).length
            }
            onMessage={() => setNotice("Mentor messaging isn’t connected in this demo.")}
          />
          <ReadinessPanel />
          <ResourcesCard definition={kit} />
        </aside>
      </div>
      {requestOpen && nextStage && (
        <StageRequestDialog
          nextStage={nextStage.label}
          adminRequest={canManage && !approved}
          onClose={() => setRequestOpen(false)}
          onSubmit={(reason) => {
            requestStageChange(currentStage.id, nextStage.id, reason);
            setRequestOpen(false);
            setNotice("Stage change request saved locally for review.");
            window.setTimeout(() => setNotice(""), 3500);
          }}
        />
      )}
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
function CircleHelpIcon() {
  return <MessageSquare size={16} aria-hidden="true" />;
}
