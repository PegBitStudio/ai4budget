const KEY_PREFIX = "kobopilot:qa-history:";

/** Long enough to feel like a real conversation, short enough to stay small. */
const MAX_STORED_MESSAGES = 60;

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * The assistant's conversation, kept across a reload or a trip to another
 * page.
 *
 * Scoped by user id rather than one flat key: the demo account is one browser
 * session after another, and without the id in the key, whichever visitor
 * used it last would hand their conversation to the next one who opens the
 * assistant on the same device. A signed-out visitor writes nothing and reads
 * nothing — there is no account to scope the key to yet.
 *
 * This is browser storage, not a table — the trade already made for read
 * notifications and the theme choice elsewhere in the app. A conversation
 * with the assistant is a convenience for picking up where you left off, not
 * a financial record, so it does not need to survive a new device or a
 * schema migration two days before a deadline.
 */
export function loadQAHistory(userId: string): StoredChatMessage[] | null {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter(
      (m): m is StoredChatMessage =>
        m &&
        typeof m.id === "string" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        typeof m.timestamp === "string"
    );
  } catch {
    // Corrupt or blocked storage is the same as no history.
    return null;
  }
}

export function saveQAHistory(
  userId: string,
  messages: StoredChatMessage[]
): void {
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(trimmed));
  } catch {
    // A full or disabled store should not break the conversation on screen —
    // it just stops being remembered for next time.
  }
}

export function clearQAHistory(userId: string): void {
  try {
    window.localStorage.removeItem(KEY_PREFIX + userId);
  } catch {
    // Nothing to undo if storage was never reachable.
  }
}
