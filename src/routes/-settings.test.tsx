/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Settings } from "./settings";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const useAuthActionsMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => useAuthActionsMock(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<object>("@tanstack/react-router");
  return {
    ...actual,
    Outlet: () => null,
    useNavigate: () => vi.fn(),
    useRouterState: () => "/settings",
  };
});

describe("Settings", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useAuthActionsMock.mockReset();
    useMutationMock.mockReturnValue(vi.fn());
    useAuthActionsMock.mockReturnValue({
      signIn: vi.fn(),
    });
  });

  it("shows a loading state until auth has resolved", () => {
    useQueryMock.mockImplementation(() => undefined);

    render(<Settings />);

    expect(screen.queryByText(/sign in to access settings\./i)).toBeNull();
    expect(useQueryMock.mock.calls.some(([, args]) => args === "skip")).toBe(true);
  });
});
