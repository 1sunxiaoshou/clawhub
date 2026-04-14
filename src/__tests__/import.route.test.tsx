/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportGitHub } from '../routes/import';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component: unknown }) => config,
  Link: (props: { children: ReactNode }) => <a href="/">{props.children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({
    signIn: vi.fn(),
  }),
}));

const triggerSyncMock = vi.fn();
const pauseSyncMock = vi.fn();
const previewImportMock = vi.fn();
const previewCandidateMock = vi.fn();
const importSkillMock = vi.fn();
const useQueryMock = vi.fn();
const useAuthStatusMock = vi.fn();
let useActionCallCount = 0;

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useAction: () => {
    const actions = [previewImportMock, previewCandidateMock, importSkillMock];
    const action = actions[useActionCallCount % actions.length];
    useActionCallCount += 1;
    return action;
  },
}));

vi.mock('../lib/useAuthStatus', () => ({
  useAuthStatus: () => useAuthStatusMock(),
}));

describe('Import route', () => {
  beforeEach(() => {
    triggerSyncMock.mockReset();
    pauseSyncMock.mockReset();
    previewImportMock.mockReset();
    previewCandidateMock.mockReset();
    importSkillMock.mockReset();
    useQueryMock.mockReset();
    useAuthStatusMock.mockReset();
    useActionCallCount = 0;

    useAuthStatusMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1', handle: 'me' },
    });

    useQueryMock.mockReturnValue(null);

    previewImportMock.mockResolvedValue({
      resolved: {
        originalUrl: 'https://github.com/octo/repo',
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
      },
      candidates: [
        {
          path: 'skill',
          readmePath: 'skill/SKILL.md',
          name: 'Taken Skill',
          description: 'demo',
        },
      ],
    });

    previewCandidateMock.mockResolvedValue({
      resolved: {
        originalUrl: 'https://github.com/octo/repo',
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
      },
      candidate: {
        path: 'skill',
        readmePath: 'skill/SKILL.md',
        name: 'Taken Skill',
        description: 'demo',
      },
      defaults: {
        selectedPaths: ['skill/SKILL.md'],
        slug: 'taken-skill',
        displayName: 'Taken Skill',
        version: '1.0.0',
        tags: ['latest'],
      },
      files: [
        {
          path: 'skill/SKILL.md',
          size: 120,
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the sign-in prompt when logged out', () => {
    useAuthStatusMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      me: null,
    });

    render(<ImportGitHub />);

    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeTruthy();
  });

  it('loads the skill preview and fills the defaults', async () => {
    render(<ImportGitHub />);
    fireEvent.change(screen.getByPlaceholderText('repo, dir path, or file'), {
      target: { value: 'https://github.com/octo/repo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /detect/i }));

    await waitFor(() => {
      expect(previewImportMock).toHaveBeenCalledWith({
        url: 'https://github.com/octo/repo',
      });
    });

    await waitFor(() => {
      expect(previewCandidateMock).toHaveBeenCalledWith({
        url: 'https://github.com/octo/repo',
        candidatePath: 'skill',
      });
    });

    expect(await screen.findByDisplayValue('taken-skill')).toBeTruthy();
    expect(screen.getByText(/Ready to import/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /import & publish/i })).toBeTruthy();
  });

  it('shows the files for a root-level skill', async () => {
    previewImportMock.mockResolvedValueOnce({
      resolved: {
        originalUrl: 'https://clawhub.ai/pskoett/self-improving-agent',
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
      },
      candidates: [
        {
          path: '',
          readmePath: 'SKILL.md',
          name: 'self-improving',
          description: 'demo',
        },
      ],
    });
    previewCandidateMock.mockResolvedValueOnce({
      resolved: {
        originalUrl: 'https://clawhub.ai/pskoett/self-improving-agent',
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
      },
      candidate: {
        path: '',
        readmePath: 'SKILL.md',
        name: 'self-improving',
        description: 'demo',
      },
      defaults: {
        selectedPaths: ['SKILL.md'],
        slug: 'self-improving',
        displayName: 'self-improving',
        version: '1.0.0',
        tags: ['latest'],
      },
      files: [
        {
          path: 'SKILL.md',
          size: 120,
        },
      ],
    });

    render(<ImportGitHub />);
    fireEvent.change(screen.getByPlaceholderText('repo, dir path, or file'), {
      target: { value: 'https://clawhub.ai/pskoett/self-improving-agent' },
    });
    fireEvent.click(screen.getByRole('button', { name: /detect/i }));

    await waitFor(() => {
      expect(previewImportMock).toHaveBeenCalledWith({
        url: 'https://clawhub.ai/pskoett/self-improving-agent',
      });
    });

    expect(await screen.findByText(/Ready to import/i)).toBeTruthy();
    expect(screen.getAllByText(/SKILL\.md/).length).toBeGreaterThan(0);
  });
});
