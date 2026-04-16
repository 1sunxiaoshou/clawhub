/* @vitest-environment jsdom */
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_DENIED_SIGN_IN_MESSAGE, BANNED_SIGN_IN_MESSAGE } from "../lib/authErrorMessage";
import { getAuthErrorSnapshot, clearAuthError } from "../lib/useAuthError";
import { AuthCodeHandler, AuthErrorHandler } from "./AppProviders";

const signInMock = vi.fn();
const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuthActions: () => ({
    signIn: signInMock,
  }),
}));

vi.mock("../convex/client", () => ({
  convex: {},
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("./UserBootstrap", () => ({
  UserBootstrap: () => null,
}));

describe("AuthCodeHandler", () => {
  beforeEach(() => {
    signInMock.mockReset();
    toastErrorMock.mockReset();
    clearAuthError();
    window.history.replaceState(null, "", "/sign-in");
  });

  afterEach(() => {
    clearAuthError();
  });

  it("consumes the auth code and strips it from the URL", async () => {
    signInMock.mockResolvedValue({ signingIn: true });
    window.history.replaceState(null, "", "/sign-in?code=abc123&next=%2Fdashboard#section");

    render(<AuthCodeHandler />);

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith(undefined, { code: "abc123" });
    });

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/sign-in?next=%2Fdashboard#section",
    );
    expect(getAuthErrorSnapshot()).toBeNull();
  });

  it("surfaces user-facing sign-in errors from code verification", async () => {
    signInMock.mockRejectedValue(
      new Error("[CONVEX A] Server Error Called by client ConvexError: Account banned"),
    );
    window.history.replaceState(null, "", "/sign-in?code=abc123");

    render(<AuthCodeHandler />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(BANNED_SIGN_IN_MESSAGE);
    });
    expect(getAuthErrorSnapshot()).toBeNull();
  });

  it("shows a generic toast when code verification finishes without a session", async () => {
    signInMock.mockResolvedValue({ signingIn: false });
    window.history.replaceState(null, "", "/sign-in?code=abc123");

    render(<AuthCodeHandler />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Sign in failed. Please try again.");
    });
    expect(getAuthErrorSnapshot()).toBeNull();
  });

  it("keeps inline auth errors for the cli auth route", async () => {
    signInMock.mockRejectedValue(
      new Error("[CONVEX A] Server Error Called by client ConvexError: Account banned"),
    );
    window.history.replaceState(null, "", "/cli/auth?code=abc123");

    render(<AuthCodeHandler />);

    await waitFor(() => {
      expect(getAuthErrorSnapshot()).toBe(BANNED_SIGN_IN_MESSAGE);
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});

describe("AuthErrorHandler", () => {
  beforeEach(() => {
    signInMock.mockReset();
    toastErrorMock.mockReset();
    clearAuthError();
    window.history.replaceState(null, "", "/sign-in");
  });

  afterEach(() => {
    clearAuthError();
  });

  it("does nothing when there is no auth error in the URL", () => {
    render(<AuthErrorHandler />);

    expect(getAuthErrorSnapshot()).toBeNull();
  });

  it("surfaces provider errors from the URL and strips them", async () => {
    window.history.replaceState(
      null,
      "",
      "/sign-in?error=access_denied&error_description=Account%20banned&next=%2Fdashboard#section",
    );

    render(<AuthErrorHandler />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(BANNED_SIGN_IN_MESSAGE);
    });
    expect(getAuthErrorSnapshot()).toBeNull();

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/sign-in?next=%2Fdashboard#section",
    );
  });

  it("falls back to the provider error when there is no description", async () => {
    window.history.replaceState(null, "", "/sign-in?error=access_denied");

    render(<AuthErrorHandler />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(ACCESS_DENIED_SIGN_IN_MESSAGE);
    });
    expect(getAuthErrorSnapshot()).toBeNull();
  });

  it("falls back to the provider error when the description is blank", async () => {
    window.history.replaceState(
      null,
      "",
      "/sign-in?error=access_denied&error_description=%20%20%20",
    );

    render(<AuthErrorHandler />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(ACCESS_DENIED_SIGN_IN_MESSAGE);
    });
    expect(getAuthErrorSnapshot()).toBeNull();

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/sign-in",
    );
  });

  it("keeps provider errors inline on the cli auth route", async () => {
    window.history.replaceState(null, "", "/cli/auth?error=access_denied");

    render(<AuthErrorHandler />);

    await waitFor(() => {
      expect(getAuthErrorSnapshot()).toBe(ACCESS_DENIED_SIGN_IN_MESSAGE);
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
