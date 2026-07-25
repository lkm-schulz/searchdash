import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { validateDatadir } from "../api/client";
import { dashboardPath } from "../util";
import { useRecentDatadirs } from "./useRecentDatadirs";
import { useToast } from "./useToast";

/**
 * The one action that opens a datadir: validate it, record it in history, then
 * navigate to its dashboard. Shared by the home picker, the header editor, and
 * recent-list clicks so the open flow lives in a single place.
 *
 * Failures surface as a floating toast (not inline), so the message survives the
 * caller collapsing — e.g. the header editor closing on blur.
 */
export function useOpenDatadir(): {
  open: (path: string) => Promise<void>;
  opening: boolean;
} {
  const navigate = useNavigate();
  const { remember } = useRecentDatadirs();
  const { push } = useToast();
  const [opening, setOpening] = useState(false);

  const open = useCallback(
    async (path: string) => {
      const trimmed = path.trim();
      if (!trimmed) return;
      setOpening(true);
      try {
        const result = await validateDatadir(trimmed);
        if (!result.valid) {
          push(`Not a directory under the served root: ${trimmed}`);
          return;
        }
        if (!result.isDatadir) {
          push(`No iterations/ found — not a datadir: ${trimmed}`);
          return;
        }
        remember(trimmed);
        navigate(dashboardPath(trimmed));
      } catch (err) {
        push(err instanceof Error ? err.message : String(err));
      } finally {
        setOpening(false);
      }
    },
    [navigate, remember, push],
  );

  return { open, opening };
}
