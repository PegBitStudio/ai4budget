"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "disclaimer_acknowledged";

const DISCLAIMER_TEXT =
  "This app provides general budgeting support and does not constitute professional financial, investment, tax, or legal advice. For specific financial decisions, please consult a qualified professional.";

export default function DisclaimerModal() {
  const [visible, setVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const acknowledged = localStorage.getItem(STORAGE_KEY);
    if (acknowledged !== "true") {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (visible && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [visible]);

  // Trap focus on the button when the modal is visible
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        buttonRef.current?.focus();
      }
      // Prevent Escape from dismissing — user must click "I understand"
      if (e.key === "Escape") {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible]);

  const handleAcknowledge = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      aria-describedby="disclaimer-body"
    >
      <div className="mx-4 max-w-md w-full rounded-lg bg-white p-6 shadow-xl">
        <h2
          id="disclaimer-title"
          className="text-lg font-semibold text-gray-900 mb-4"
        >
          Important Notice
        </h2>
        <p id="disclaimer-body" className="text-base text-gray-700 mb-6">
          {DISCLAIMER_TEXT}
        </p>
        <button
          ref={buttonRef}
          onClick={handleAcknowledge}
          className="w-full min-h-[44px] min-w-[44px] rounded-md bg-blue-800 px-4 py-3 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          I understand
        </button>
      </div>
    </div>
  );
}
