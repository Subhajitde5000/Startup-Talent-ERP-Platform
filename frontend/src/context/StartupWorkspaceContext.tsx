"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getInitialStartupWorkspaceData,
  hydrateStartupDataFromBrowser,
} from "@/services/startupService";
import {
  StartupDocumentItem,
  StartupStageId,
  StartupTaskItem,
  StartupTeamMember,
  StartupWorkspaceData,
} from "@/types/startup";

interface StartupWorkspaceContextValue {
  data: StartupWorkspaceData;
  setCurrentStage: (stage: StartupStageId) => void;
  updateStartupIdentity: (identity: { name?: string; tagline?: string }) => void;
  toggleTaskStatus: (taskId: string) => void;
  toggleExitCriterion: (stageId: StartupStageId, criterionId: string) => void;
  addTask: (task: {
    title: string;
    moduleLabel: string;
    moduleHref: string;
    dueLabel: string;
    dueDate?: string;
    owner: string;
    status?: StartupTaskItem["status"];
    priority?: StartupTaskItem["priority"];
    labels?: string[];
    description?: string;
    milestoneId?: string;
    linkedCriterionId?: string;
    mentorDeliverable?: boolean;
    mentorStatus?: StartupTaskItem["mentorStatus"];
    isMilestone?: boolean;
  }) => string;
  updateTask: (taskId: string, updates: Partial<StartupTaskItem>) => void;
  deleteTask: (taskId: string) => void;
  restoreTask: (task: StartupTaskItem) => void;
  addTeamMember: (member: {
    name: string;
    role: string;
    email: string;
    permission: "Owner" | "Admin" | "Member" | "Viewer";
  }) => void;
  updateTeamMember: (memberId: string, updates: Partial<StartupTeamMember>) => void;
  removeTeamMember: (memberId: string) => void;
  addDocument: (doc: { title: string; folder: StartupDocumentItem["folder"] }) => void;
  requestMentorSession: (topic: string, preferredDay: string) => void;
}

const StartupWorkspaceContext = createContext<StartupWorkspaceContextValue | null>(null);

export function StartupWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<StartupWorkspaceData>(() => getInitialStartupWorkspaceData());

  useEffect(() => {
    setData((prev) => hydrateStartupDataFromBrowser(prev));
  }, []);

  const setCurrentStage = (stage: StartupStageId) => {
    setData((prev) => ({
      ...prev,
      startup: {
        ...prev.startup,
        currentStage: stage,
      },
    }));
  };

  const updateStartupIdentity: StartupWorkspaceContextValue["updateStartupIdentity"] = (
    identity,
  ) => {
    setData((prev) => ({ ...prev, startup: { ...prev.startup, ...identity } }));
  };

  const toggleTaskStatus = (taskId: string) => {
    setData((prev) => {
      let toggledTitle = "";
      let becameCompleted = false;

      const updatedTasks: StartupTaskItem[] = prev.tasks.map((task) => {
        if (task.id !== taskId) return task;
        toggledTitle = task.title;
        const nextStatus = task.status === "completed" ? "pending" : "completed";
        becameCompleted = nextStatus === "completed";
        return {
          ...task,
          status: nextStatus,
          completedAt: nextStatus === "completed" ? new Date().toISOString() : undefined,
          dueLabel:
            nextStatus === "pending" && task.dueLabel.startsWith("Completed")
              ? "Due next week"
              : task.dueLabel,
        };
      });

      const nextActivity = toggledTitle
        ? [
            {
              id: `act-${Date.now()}`,
              actor: prev.startup.founderName,
              action: becameCompleted ? "completed" : "reopened",
              target: toggledTitle,
              timestamp: "Just now",
              category: "milestone" as const,
            },
            ...prev.recentActivity,
          ]
        : prev.recentActivity;

      return {
        ...prev,
        tasks: updatedTasks,
        recentActivity: nextActivity,
      };
    });
  };

  const toggleExitCriterion = (stageId: StartupStageId, criterionId: string) => {
    setData((prev) => {
      let delta = 0;
      const updatedStages = prev.stages.map((st) => {
        if (st.id !== stageId) return st;
        return {
          ...st,
          exitCriteria: st.exitCriteria.map((ec) => {
            if (ec.id !== criterionId) return ec;
            const nextCompleted = !ec.completed;
            delta = nextCompleted ? 1 : -1;
            return { ...ec, completed: nextCompleted };
          }),
        };
      });

      const nextCompleted = Math.max(
        0,
        Math.min(prev.readiness.totalMilestones, prev.readiness.completedMilestones + delta),
      );

      return {
        ...prev,
        stages: updatedStages,
        readiness: {
          ...prev.readiness,
          completedMilestones: nextCompleted,
          rubricNote: `Derived from ${nextCompleted} of ${prev.readiness.totalMilestones} completed stage checklist items (illustrative workspace sample).`,
        },
      };
    });
  };

  const addTask: StartupWorkspaceContextValue["addTask"] = (input) => {
    const id = `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setData((prev) => {
      const newTask: StartupTaskItem = {
        id,
        title: input.title,
        moduleLabel: input.moduleLabel,
        moduleHref: input.moduleHref,
        dueLabel: input.dueLabel || "No due date",
        dueDate: input.dueDate,
        owner: input.owner || prev.startup.founderName,
        status: input.status || "pending",
        priority: input.priority || "Medium",
        labels: input.labels || [],
        description: input.description || "",
        milestoneId: input.milestoneId,
        linkedCriterionId: input.linkedCriterionId,
        mentorDeliverable: input.mentorDeliverable,
        mentorStatus: input.mentorStatus || "not-requested",
        isMilestone: input.isMilestone,
        subtasks: [],
        comments: [],
      };
      return {
        ...prev,
        tasks: [newTask, ...prev.tasks],
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            actor: prev.startup.founderName,
            action: "created task in " + input.moduleLabel,
            target: input.title,
            timestamp: "Just now",
            category: "milestone",
          },
          ...prev.recentActivity,
        ],
      };
    });
    return id;
  };

  const updateTask: StartupWorkspaceContextValue["updateTask"] = (taskId, updates) => {
    setData((prev) => {
      const target = prev.tasks.find((task) => task.id === taskId);
      if (!target) return prev;
      const changed = { ...target, ...updates };
      const action = updates.status
        ? `moved a task to ${updates.status.replace("-", " ")}`
        : "updated task details";
      return {
        ...prev,
        tasks: prev.tasks.map((task) => (task.id === taskId ? changed : task)),
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            actor: prev.startup.founderName,
            action,
            target: changed.title,
            timestamp: "Just now",
            category: "milestone",
          },
          ...prev.recentActivity,
        ],
      };
    });
  };

  const deleteTask: StartupWorkspaceContextValue["deleteTask"] = (taskId) => {
    setData((prev) => {
      const target = prev.tasks.find((task) => task.id === taskId);
      if (!target) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter((task) => task.id !== taskId),
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            actor: prev.startup.founderName,
            action: "deleted task",
            target: target.title,
            timestamp: "Just now",
            category: "milestone",
          },
          ...prev.recentActivity,
        ],
      };
    });
  };

  const restoreTask: StartupWorkspaceContextValue["restoreTask"] = (task) => {
    setData((prev) =>
      prev.tasks.some((item) => item.id === task.id)
        ? prev
        : { ...prev, tasks: [task, ...prev.tasks] },
    );
  };

  const updateTeamMember: StartupWorkspaceContextValue["updateTeamMember"] = (
    memberId,
    updates,
  ) => {
    setData((prev) => {
      const target = prev.team.find((member) => member.id === memberId);
      if (
        !target ||
        Object.entries(updates).every(
          ([key, value]) => target[key as keyof StartupTeamMember] === value,
        )
      )
        return prev;
      const action = updates.permission
        ? `changed access role to ${updates.permission} for`
        : updates.status
          ? `updated access status for`
          : updates.showOnPublicProfile !== undefined
            ? `${updates.showOnPublicProfile ? "enabled" : "disabled"} public profile visibility for`
            : "updated team profile for";
      return {
        ...prev,
        team: prev.team.map((member) =>
          member.id === memberId ? { ...member, ...updates } : member,
        ),
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            actor: prev.startup.founderName,
            action,
            target: target.name,
            timestamp: "Just now",
            category: "team",
          },
          ...prev.recentActivity,
        ],
      };
    });
  };

  const removeTeamMember: StartupWorkspaceContextValue["removeTeamMember"] = (memberId) => {
    setData((prev) => {
      const removed = prev.team.find((member) => member.id === memberId);
      if (!removed) return prev;
      return {
        ...prev,
        team: prev.team.filter((member) => member.id !== memberId),
        tasks: prev.tasks.map((task) =>
          task.owner === removed.name ? { ...task, owner: "Unassigned" } : task,
        ),
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            actor: prev.startup.founderName,
            action: "removed team member",
            target: removed.name,
            timestamp: "Just now",
            category: "team",
          },
          ...prev.recentActivity,
        ],
      };
    });
  };

  const addTeamMember: StartupWorkspaceContextValue["addTeamMember"] = (member) => {
    setData((prev) => {
      const created: StartupTeamMember = {
        id: `tm-${Date.now()}`,
        ...member,
      };

      return {
        ...prev,
        team: [...prev.team, created],
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            actor: prev.startup.founderName,
            action: "invited team member",
            target: `${member.name} (${member.role})`,
            timestamp: "Just now",
            category: "team",
          },
          ...prev.recentActivity,
        ],
      };
    });
  };

  const addDocument: StartupWorkspaceContextValue["addDocument"] = (doc) => {
    setData((prev) => {
      const created: StartupDocumentItem = {
        id: `doc-${Date.now()}`,
        title: doc.title,
        folder: doc.folder,
        updatedAt: "Today",
      };

      return {
        ...prev,
        documents: [created, ...prev.documents],
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            actor: prev.startup.founderName,
            action: `added document to ${doc.folder}`,
            target: doc.title,
            timestamp: "Just now",
            category: "document",
          },
          ...prev.recentActivity,
        ],
      };
    });
  };

  const requestMentorSession = (topic: string, preferredDay: string) => {
    setData((prev) => ({
      ...prev,
      mentor: {
        ...prev.mentor,
        nextSession: {
          topic,
          dateLabel: preferredDay,
          timeLabel: "Awaiting mentor confirmation",
          status: "Requested",
        },
      },
      recentActivity: [
        {
          id: `act-${Date.now()}`,
          actor: prev.startup.founderName,
          action: `requested office hours with ${prev.mentor.name}`,
          target: topic,
          timestamp: "Just now",
          category: "mentor",
        },
        ...prev.recentActivity,
      ],
    }));
  };

  return (
    <StartupWorkspaceContext.Provider
      value={{
        data,
        setCurrentStage,
        updateStartupIdentity,
        toggleTaskStatus,
        toggleExitCriterion,
        addTask,
        updateTask,
        deleteTask,
        restoreTask,
        addTeamMember,
        updateTeamMember,
        removeTeamMember,
        addDocument,
        requestMentorSession,
      }}
    >
      {children}
    </StartupWorkspaceContext.Provider>
  );
}

export function useStartupWorkspace() {
  const ctx = useContext(StartupWorkspaceContext);
  if (!ctx) {
    throw new Error("useStartupWorkspace must be used within StartupWorkspaceProvider");
  }
  return ctx;
}
