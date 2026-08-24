// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import DisclaimerModal from "./DisclaimerModal";
import FooterDisclaimer from "./FooterDisclaimer";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("DisclaimerModal", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the modal when disclaimer has not been acknowledged", () => {
    localStorageMock.getItem.mockReturnValue(null);
    render(<DisclaimerModal />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    expect(
      screen.getByText(/does not constitute professional financial/i)
    ).toBeDefined();
    expect(screen.getByText("I understand")).toBeDefined();
  });

  it("does not show the modal when disclaimer was previously acknowledged", () => {
    localStorageMock.getItem.mockReturnValue("true");
    render(<DisclaimerModal />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dismisses the modal and stores acknowledgement on button click", () => {
    localStorageMock.getItem.mockReturnValue(null);
    render(<DisclaimerModal />);

    const button = screen.getByText("I understand");
    fireEvent.click(button);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "disclaimer_acknowledged",
      "true"
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has a button with minimum 44px tap target", () => {
    localStorageMock.getItem.mockReturnValue(null);
    render(<DisclaimerModal />);

    const button = screen.getByText("I understand");
    expect(button.className).toContain("min-h-[44px]");
    expect(button.className).toContain("min-w-[44px]");
  });

  it("contains proper accessibility attributes", () => {
    localStorageMock.getItem.mockReturnValue(null);
    render(<DisclaimerModal />);

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("disclaimer-title");
    expect(dialog.getAttribute("aria-describedby")).toBe("disclaimer-body");
  });
});

describe("FooterDisclaimer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders disclaimer text", () => {
    render(<FooterDisclaimer />);

    expect(
      screen.getByText(
        /does not constitute professional financial or investment advice/i
      )
    ).toBeDefined();
  });

  it("uses text-base (16px) font size", () => {
    render(<FooterDisclaimer />);

    const paragraph = screen.getByText(
      /does not constitute professional financial or investment advice/i
    );
    expect(paragraph.className).toContain("text-base");
  });

  it("uses gray text and centered layout", () => {
    render(<FooterDisclaimer />);

    const paragraph = screen.getByText(
      /does not constitute professional financial or investment advice/i
    );
    expect(paragraph.className).toContain("text-gray-500");

    const footer = paragraph.closest("footer");
    expect(footer?.className).toContain("text-center");
  });
});
