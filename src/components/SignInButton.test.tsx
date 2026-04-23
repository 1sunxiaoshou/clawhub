/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInButton } from "./SignInButton";

const signInMock = vi.fn();
const clearAuthErrorMock = vi.fn();
const setAuthErrorMock = vi.fn();
const getUserFacingAuthErrorMock = vi.fn();
const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: signInMock,
  }),
}));

vi.mock("../lib/useAuthError", () => ({
  clearAuthError: () => clearAuthErrorMock(),
  setAuthError: (message: string) => setAuthErrorMock(message),
}));

vi.mock("../lib/authErrorMessage", () => ({
  getUserFacingAuthError: (error: unknown, fallback: string) =>
    getUserFacingAuthErrorMock(error, fallback),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (message: string) => toastErrorMock(message),
  },
}));

describe("SignInButton", () => {
  beforeEach(() => {
    signInMock.mockReset();
    clearAuthErrorMock.mockReset();
    setAuthErrorMock.mockReset();
    getUserFacingAuthErrorMock.mockReset();
    toastErrorMock.mockReset();
    getUserFacingAuthErrorMock.mockImplementation((_, fallback) => fallback);
    window.history.replaceState(null, "", "/skills?q=test#top");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts provider sign-in with the current relative URL", async () => {
    signInMock.mockResolvedValue({ signingIn: true });

    render(<SignInButton provider="github">Sign in with GitHub</SignInButton>);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith("github", {
        redirectTo: "/skills?q=test#top",
      });
    });
    expect(clearAuthErrorMock).toHaveBeenCalledTimes(1);
    expect(setAuthErrorMock).not.toHaveBeenCalled();
  });

  it("routes to the login page when no provider is specified", () => {
    const assignMock = vi.fn();
    vi.stubGlobal("location", {
      assign: assignMock,
      origin: "http://localhost",
      pathname: "/skills",
      search: "?q=test",
      hash: "#top",
    });
    render(<SignInButton>Sign in</SignInButton>);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(assignMock).toHaveBeenCalledWith("http://localhost/login?redirectTo=%2Fskills%3Fq%3Dtest%23top");
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("does not surface an error when sign-in resolves without redirecting", async () => {
    signInMock.mockResolvedValue({ signingIn: false });

    render(<SignInButton provider="github">Sign in with GitHub</SignInButton>);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith("github", {
        redirectTo: "/skills?q=test#top",
      });
    });
    expect(setAuthErrorMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("surfaces user-facing auth errors as toast when sign-in rejects outside cli auth", async () => {
    const failure = new Error("oauth failed");
    signInMock.mockRejectedValue(failure);
    getUserFacingAuthErrorMock.mockReturnValue("GitHub auth unavailable");

    render(<SignInButton provider="github">Sign in with GitHub</SignInButton>);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));

    await waitFor(() => {
      expect(getUserFacingAuthErrorMock).toHaveBeenCalledWith(
        failure,
        "Sign in failed. Please try again.",
      );
      expect(toastErrorMock).toHaveBeenCalledWith("GitHub auth unavailable");
    });
    expect(setAuthErrorMock).not.toHaveBeenCalled();
  });

  it("keeps auth errors inline on the cli auth route", async () => {
    const failure = new Error("oauth failed");
    signInMock.mockRejectedValue(failure);
    getUserFacingAuthErrorMock.mockReturnValue("GitHub auth unavailable");
    window.history.replaceState(null, "", "/cli/auth?state=123");

    render(<SignInButton provider="github">Sign in with GitHub</SignInButton>);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));

    await waitFor(() => {
      expect(setAuthErrorMock).toHaveBeenCalledWith("GitHub auth unavailable");
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
