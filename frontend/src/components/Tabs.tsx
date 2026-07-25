import { cn } from "../util";

/** One selectable tab. */
export interface TabDef<T extends string> {
  id: T;
  label: string;
}

/** Pill-style tab strip; the active tab is highlighted. Generic over the id union. */
export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="tabs">
      {tabs.map((tab) => (
        <button key={tab.id} className={cn("tab", active === tab.id && "active")} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
