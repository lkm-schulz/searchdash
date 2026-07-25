// The ONLY module that talks to the network. Swapping the data source (e.g. to
// static files or a different backend) means rewriting this file alone; the rest
// of the app depends only on the domain types and these function signatures.

import type { BrowseEntry, ClientConfig, Iteration, RunMeta, ValidateResult } from "./types";

const API_BASE = "/api";

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetch(`${API_BASE}${path}${query}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return (await response.json()) as T;
}

export function fetchConfig(): Promise<ClientConfig> {
  return getJson<ClientConfig>("/config");
}

export function fetchBrowse(path: string): Promise<BrowseEntry[]> {
  return getJson<BrowseEntry[]>("/browse", { path });
}

export function validateDatadir(datadir: string): Promise<ValidateResult> {
  return getJson<ValidateResult>("/validate", { datadir });
}

export function fetchRun(datadir: string): Promise<RunMeta> {
  return getJson<RunMeta>("/run", { datadir });
}

export function fetchIterations(datadir: string): Promise<Iteration[]> {
  return getJson<Iteration[]>("/iterations", { datadir });
}

export function fetchIteration(id: string, datadir: string): Promise<Iteration> {
  return getJson<Iteration>(`/iterations/${encodeURIComponent(id)}`, { datadir });
}

export function artifactUrl(id: string, path: string, datadir: string): string {
  const query = new URLSearchParams({ path, datadir }).toString();
  return `${API_BASE}/iterations/${encodeURIComponent(id)}/artifact?${query}`;
}

export async function fetchArtifactText(id: string, path: string, datadir: string): Promise<string> {
  const response = await fetch(artifactUrl(id, path, datadir));
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for artifact ${path}`);
  }
  return await response.text();
}
