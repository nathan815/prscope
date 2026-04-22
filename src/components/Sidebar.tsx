import { NavLink } from "react-router-dom";
import {
  GitPullRequest,
  Star,
  Rss,
  Settings,
  Telescope,
  User,
  Users,
  Github,
} from "lucide-react";
import { useSettingsStore } from "../store/settings";
import { useFavoritesStore } from "../store/favorites";
import { useIdentityStore } from "../store/identities";

export function Sidebar() {
  const displayName = useSettingsStore((s) => s.userDisplayName);
  const organization = useSettingsStore((s) => s.organization);
  const userId = useSettingsStore((s) => s.userId);
  const favoriteCount = useFavoritesStore((s) => s.repos.length);
  const userIdentity = useIdentityStore((s) => s.records[userId]);

  const navItems = [
    { to: "/", icon: GitPullRequest, label: "My PRs" },
    { to: `/profile/${userId}`, icon: User, label: "My Profile" },
    { to: "/feed", icon: Rss, label: "Feed" },
    { to: "/people", icon: Users, label: "People" },
    { to: "/repos", icon: Star, label: "Repos" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <aside className="w-56 flex-shrink-0 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Telescope className="w-6 h-6 text-ado-blue" />
          <span className="font-bold text-lg tracking-tight">PRScope</span>
        </div>
        {organization && (
          <p className="text-[11px] text-zinc-400 mt-1 truncate">
            {organization}
          </p>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-ado-blue/10 text-ado-blue dark:bg-ado-blue/20"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
            {label === "Repos" && favoriteCount > 0 && (
              <span className="ml-auto text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
                {favoriteCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
        {displayName && (
          <div className="flex items-center gap-2">
            {userIdentity?.imageUrl ? (
              <img
                src={userIdentity.imageUrl}
                alt=""
                className="w-5 h-5 rounded-full flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] font-medium flex-shrink-0">
                {displayName.charAt(0)}
              </div>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {displayName}
            </p>
          </div>
        )}
        <a
          href="https://github.com/nathan815/prscope"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          GitHub
        </a>
      </div>
    </aside>
  );
}
