import { useState } from "react";
import PathAutocomplete from "../components/PathAutocomplete";
import ThemeToggle from "../components/ThemeToggle";
import type { Theme } from "../hooks/useTheme";
import { useOpenDatadir } from "../hooks/useOpenDatadir";
import { useRecentDatadirs } from "../hooks/useRecentDatadirs";
import { abbreviatePath } from "../util";

interface HomePageProps {
  /** Absolute root datadirs are browsed under, shown as a hint. */
  root: string | null;
  theme: Theme;
  onToggleTheme: () => void;
}

/** Landing picker: enter or browse to a datadir, or reopen a recent one. */
export default function HomePage({ root, theme, onToggleTheme }: HomePageProps) {
  const [path, setPath] = useState("");
  const { recent } = useRecentDatadirs();
  const { open } = useOpenDatadir();

  return (
    <div className="home-page">
      <div className="home-theme-toggle">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="home-card">
        <h1>searchdash</h1>
        <p className="home-subtitle">Open an experiment datadir to view its dashboard.</p>
        <PathAutocomplete
          value={path}
          onChange={setPath}
          onSubmit={open}
          recent={recent}
          placeholder={root ? `cwd=${abbreviatePath(root)}` : "datadir path"}
          autoFocus
        />
        <div className="home-recent">
          <h2>Recent</h2>
          {recent.length > 0 ? (
            <ul className="path-list">
              {recent.map((entry) => (
                <li key={entry}>
                  <button type="button" className="path-option" onClick={() => open(entry)}>
                    <span className="path-option-name">{entry}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="home-recent-empty">No recent experiments yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
