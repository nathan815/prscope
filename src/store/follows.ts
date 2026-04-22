import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FollowedUser } from "../types";

interface FollowsState {
  users: FollowedUser[];
  addUser: (user: FollowedUser) => void;
  removeUser: (userId: string) => void;
  isFollowing: (userId: string) => boolean;
  toggleUser: (user: FollowedUser) => void;
}

export const useFollowsStore = create<FollowsState>()(
  persist(
    (set, get) => ({
      users: [],
      addUser: (user) =>
        set((s) => ({
          users: s.users.some((u) => u.id === user.id) ? s.users : [...s.users, user],
        })),
      removeUser: (userId) => set((s) => ({ users: s.users.filter((u) => u.id !== userId) })),
      isFollowing: (userId) => get().users.some((u) => u.id === userId),
      toggleUser: (user) => {
        if (get().isFollowing(user.id)) {
          get().removeUser(user.id);
        } else {
          get().addUser(user);
        }
      },
    }),
    { name: "prscope-follows" },
  ),
);
