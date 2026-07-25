import { useEffect, useState } from "react";
import PathAutocomplete from "./PathAutocomplete";
import { useOpenDatadir } from "../hooks/useOpenDatadir";
import { useRecentDatadirs } from "../hooks/useRecentDatadirs";
import { cn } from "../util";

interface DatadirEditorProps {
  /** Datadir currently shown in the dashboard. */
  datadir: string;
  /** Run name shown above the path in the collapsed view. */
  runName: string;
}

/**
 * The header title block (run name + datadir path) as one click-to-edit element.
 * Collapsed, it shows the name over the path; clicking fades the whole cluster
 * out and fades a prefilled `PathAutocomplete` in over the same spot — both
 * layers share one grid cell, so the header keeps its height and vertical centre.
 * Escape or blur cancels back to the collapsed view.
 */
export default function DatadirEditor({ datadir, runName }: DatadirEditorProps) {
  const [editing, setEditing] = useState(false);
  const [path, setPath] = useState(datadir);
  const { recent } = useRecentDatadirs();
  const { open } = useOpenDatadir();

  // Once a different datadir loads (open succeeded), collapse back to the title.
  useEffect(() => {
    setEditing(false);
    setPath(datadir);
  }, [datadir]);

  const startEditing = () => {
    setPath(datadir);
    setEditing(true);
  };

  return (
    <div className={cn("app-title-switch", editing && "editing")}>
      <div
        className="app-title-collapsed"
        role="button"
        tabIndex={0}
        title="Click to switch experiment"
        onClick={startEditing}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing();
          }
        }}
      >
        <h1 className="app-run-name">{runName}</h1>
        <span className="app-datadir">{datadir}</span>
      </div>
      {editing && (
        <div
          className="app-title-editor"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setEditing(false);
          }}
        >
          <PathAutocomplete value={path} onChange={setPath} onSubmit={open} recent={recent} autoFocus />
        </div>
      )}
    </div>
  );
}
