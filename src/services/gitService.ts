import { invoke } from '@tauri-apps/api/core';

export interface GitRepoStatus {
  git_installed: boolean;
  is_repo: boolean;
  remote_url: string | null;
  current_branch: string | null;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Checks Git installation and repository status for a given directory path.
 */
export async function getGitStatus(path: string): Promise<GitRepoStatus> {
  if (isTauri()) {
    try {
      return await invoke<GitRepoStatus>('git_get_status', { path });
    } catch (err) {
      console.warn('Failed to get git status:', err);
      return {
        git_installed: false,
        is_repo: false,
        remote_url: null,
        current_branch: null,
      };
    }
  }
  return {
    git_installed: false,
    is_repo: false,
    remote_url: null,
    current_branch: null,
  };
}

/**
 * Initializes, stages, commits, and pushes changes to GitHub origin repository.
 */
export async function syncGit(
  path: string,
  remoteUrl?: string | null,
  commitMsg?: string | null,
  push = true
): Promise<string> {
  if (isTauri()) {
    return await invoke<string>('git_sync', {
      path,
      remoteUrl: remoteUrl || null,
      commitMsg: commitMsg || null,
      push,
    });
  }
  throw new Error('Git sync requires desktop application mode (Tauri)');
}

/** Files changed since the last saved version (commit). Empty when the folder is not a git repository. */
export async function getChangedFiles(path: string): Promise<string[]> {
  if (!isTauri()) return [];
  try {
    return await invoke<string[]>('git_changed_files', { path });
  } catch {
    return [];
  }
}
