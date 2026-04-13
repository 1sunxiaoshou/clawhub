import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { ImportGitHub } from "../routes/import";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: unknown }) => config,
  Link: (props: { children: ReactNode }) => <a href="/">{props.children}</a>,
  useNavigate: () => vi.fn(),
}));

const previewImport = vi.fn();
const importSkill = vi.fn();
const useQueryMock = vi.fn();
const useAuthStatusMock = vi.fn();
let useActionCallCount = 0;

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useAction: () => {
    const action = [previewImport, importSkill][useActionCallCount % 2];
    useActionCallCount += 1;
    return action;
  },
}));

vi.mock("../lib/useAuthStatus", () => ({
  useAuthStatus: () => useAuthStatusMock(),
}));

describe("Import route", () => {
  beforeEach(() => {
    previewImport.mockReset();
    importSkill.mockReset();
    useQueryMock.mockReset();
    useAuthStatusMock.mockReset();
    useActionCallCount = 0;

    useAuthStatusMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { _id: "users:1", handle: "me" },
    });

    useQueryMock.mockImplementation((_fn: unknown, args: unknown) => {
      if (args === "skip") return undefined;
      return null;
    });

    previewImport.mockResolvedValue({
      repoUrl: "https://github.com/octo/repo",
      commitHash: "abcdef1234567890abcdef1234567890abcdef12",
      skills: [
        {
          path: "skill",
          slug: "taken-skill",
          displayName: "Taken Skill",
          version: "1.0.0",
          files: [
            {
              path: "skill/SKILL.md",
              size: 120,
            },
          ],
        },
      ],
    });
  });

  it("renders the sign-in prompt when logged out", () => {
    useAuthStatusMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      me: null,
    });

    render(<ImportGitHub />);

    expect(screen.getByText(/sign in/i)).toBeTruthy();
  });

  it("loads the skill preview and fills the defaults", async () => {
    render(<ImportGitHub />);
    fireEvent.change(screen.getByPlaceholderText("repo, dir path, or file"), {
      target: { value: "https://github.com/octo/repo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /detect/i }));

    await waitFor(() => {
      expect(previewImport).toHaveBeenCalled();
    });

    expect(await screen.findByDisplayValue("taken-skill")).toBeTruthy();
    expect(screen.getByText(/Ready to import/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /import & publish/i })).toBeTruthy();
  });

  it("shows the files for a root-level skill", async () => {
    previewImport.mockResolvedValueOnce({
      repoUrl: "https://clawhub.ai/pskoett/self-improving-agent",
      commitHash: "abcdef1234567890abcdef1234567890abcdef12",
      skills: [
        {
          path: "",
          slug: "self-improving",
          displayName: "self-improving",
          version: "1.0.0",
          files: [
            {
              path: "SKILL.md",
              size: 120,
            },
          ],
        },
      ],
    });

    render(<ImportGitHub />);
    fireEvent.change(screen.getByPlaceholderText("repo, dir path, or file"), {
      target: { value: "https://clawhub.ai/pskoett/self-improving-agent" },
    });
    fireEvent.click(screen.getByRole("button", { name: /detect/i }));

    await waitFor(() => {
      expect(previewImport).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Ready to import/i)).toBeTruthy();
    expect(screen.getAllByText(/SKILL\.md/).length).toBeGreaterThan(0);
  });
});
