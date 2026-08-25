"use client";

import React from "react";

/**
 * Renders the light markdown the assistant returns — bold spans and bullet
 * lists — as React nodes.
 *
 * Built by construction rather than with dangerouslySetInnerHTML: the text
 * comes back from a model that is summarising the user's own data, and none of
 * it should ever be able to inject markup.
 */
export default function FormattedAnswer({ text }: { text: string }) {
  const blocks = groupIntoBlocks(text);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) =>
        block.type === "list" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            <Inline text={block.text} />
          </p>
        )
      )}
    </div>
  );
}

// --- Block parsing ---

type Block =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

/** Matches "- item", "* item" and "1. item". */
const BULLET = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/;

function groupIntoBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  };

  for (const line of text.split("\n")) {
    const bullet = line.match(BULLET);

    if (bullet) {
      flushParagraph();
      list.push(bullet[1].trim());
      continue;
    }

    if (!line.trim()) {
      flushList();
      flushParagraph();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushList();
  flushParagraph();

  return blocks;
}

// --- Inline parsing ---

/** Matches **bold** and __bold__ runs. */
const BOLD = /(\*\*|__)(.+?)\1/g;

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // A fresh regex per call: the global flag carries lastIndex between uses.
  const pattern = new RegExp(BOLD.source, "g");

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} className="font-semibold">
        {match[2]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
