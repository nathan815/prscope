import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectedProject {
  id: string;
  name: string;
}

interface SelectedProjectsState {
  projects: SelectedProject[];
  addProject: (project: SelectedProject) => void;
  removeProject: (projectId: string) => void;
  isSelected: (projectId: string) => boolean;
  toggleProject: (project: SelectedProject) => void;
}

export const useSelectedProjectsStore = create<SelectedProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      addProject: (project) =>
        set((s) => ({
          projects: s.projects.some((p) => p.id === project.id) ? s.projects : [...s.projects, project],
        })),
      removeProject: (projectId) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== projectId) })),
      isSelected: (projectId) => get().projects.some((p) => p.id === projectId),
      toggleProject: (project) => {
        if (get().isSelected(project.id)) {
          get().removeProject(project.id);
        } else {
          get().addProject(project);
        }
      },
    }),
    { name: 'prscope-selected-projects' }
  )
);
