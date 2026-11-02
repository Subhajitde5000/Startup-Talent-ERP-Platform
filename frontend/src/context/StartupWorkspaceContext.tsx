'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getInitialStartupWorkspaceData,
  hydrateStartupDataFromBrowser,
} from '@/services/startupService';
import {
  StartupDocumentItem,
  StartupStageId,
  StartupTaskItem,
  StartupTeamMember,
  StartupWorkspaceData,
} from '@/types/startup';

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
    owner: string;
    isMilestone?: boolean;
  }) => void;
  addTeamMember: (member: {
    name: string;
    role: string;
    email: string;
    permission: 'Owner' | 'Admin' | 'Member';
  }) => void;
  addDocument: (doc: {
    title: string;
    folder: StartupDocumentItem['folder'];
  }) => void;
  requestMentorSession: (topic: string, preferredDay: string) => void;
}

const StartupWorkspaceContext =
  createContext<StartupWorkspaceContextValue | null>(null);

export function StartupWorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = useState<StartupWorkspaceData>(() =>
    getInitialStartupWorkspaceData()
  );

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

  const updateStartupIdentity: StartupWorkspaceContextValue['updateStartupIdentity'] = (identity) => {
    setData((prev) => ({ ...prev, startup: { ...prev.startup, ...identity } }));
  };

  const toggleTaskStatus = (taskId: string) => {
    setData((prev) => {
      let toggledTitle = '';
      let becameCompleted = false;
      let wasMilestone = false;

      const updatedTasks: StartupTaskItem[] = prev.tasks.map((task) => {
        if (task.id !== taskId) return task;
        toggledTitle = task.title;
        wasMilestone = Boolean(task.isMilestone);
        const nextStatus =
          task.status === 'completed' ? 'pending' : 'completed';
        becameCompleted = nextStatus === 'completed';
        return {
          ...task,
          status: nextStatus,
          dueLabel:
            nextStatus === 'completed' ? 'Completed today' : 'Due this week',
        };
      });

      const delta = wasMilestone ? (becameCompleted ? 1 : -1) : 0;
      const nextCompletedMilestones = Math.max(
        0,
        Math.min(
          prev.readiness.totalMilestones,
          prev.readiness.completedMilestones + delta
        )
      );

      const nextActivity = toggledTitle
        ? [
            {
              id: `act-${Date.now()}`,
              actor: prev.startup.founderName,
              action: becameCompleted ? 'completed' : 'reopened',
              target: toggledTitle,
              timestamp: 'Just now',
              category: 'milestone' as const,
            },
            ...prev.recentActivity,
          ]
        : prev.recentActivity;

      return {
        ...prev,
        tasks: updatedTasks,
        readiness: {
          ...prev.readiness,
          completedMilestones: nextCompletedMilestones,
          rubricNote: `Derived from ${nextCompletedMilestones} of ${prev.readiness.totalMilestones} completed stage checklist items (illustrative workspace sample).`,
        },
        recentActivity: nextActivity,
      };
    });
  };

  const toggleExitCriterion = (
    stageId: StartupStageId,
    criterionId: string
  ) => {
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
        Math.min(
          prev.readiness.totalMilestones,
          prev.readiness.completedMilestones + delta
        )
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

  const addTask: StartupWorkspaceContextValue['addTask'] = (input) => {
    setData((prev) => {
      const newTask: StartupTaskItem = {
        id: `tsk-${Date.now()}`,
        title: input.title,
        moduleLabel: input.moduleLabel,
        moduleHref: input.moduleHref,
        dueLabel: input.dueLabel || 'Due next week',
        owner: input.owner || prev.startup.founderName,
        status: 'pending',
        isMilestone: input.isMilestone,
      };

      return {
        ...prev,
        tasks: [newTask, ...prev.tasks],
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            actor: prev.startup.founderName,
            action: 'created task in ' + input.moduleLabel,
            target: input.title,
            timestamp: 'Just now',
            category: 'milestone',
          },
          ...prev.recentActivity,
        ],
      };
    });
  };

  const addTeamMember: StartupWorkspaceContextValue['addTeamMember'] = (
    member
  ) => {
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
            action: 'invited team member',
            target: `${member.name} (${member.role})`,
            timestamp: 'Just now',
            category: 'team',
          },
          ...prev.recentActivity,
        ],
      };
    });
  };

  const addDocument: StartupWorkspaceContextValue['addDocument'] = (doc) => {
    setData((prev) => {
      const created: StartupDocumentItem = {
        id: `doc-${Date.now()}`,
        title: doc.title,
        folder: doc.folder,
        updatedAt: 'Today',
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
            timestamp: 'Just now',
            category: 'document',
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
          timeLabel: 'Awaiting mentor confirmation',
          status: 'Requested',
        },
      },
      recentActivity: [
        {
          id: `act-${Date.now()}`,
          actor: prev.startup.founderName,
          action: `requested office hours with ${prev.mentor.name}`,
          target: topic,
          timestamp: 'Just now',
          category: 'mentor',
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
        addTeamMember,
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
    throw new Error(
      'useStartupWorkspace must be used within StartupWorkspaceProvider'
    );
  }
  return ctx;
}
