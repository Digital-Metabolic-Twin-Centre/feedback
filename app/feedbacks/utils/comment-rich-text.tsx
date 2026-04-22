import React from "react";

type FeedbackCommentContentProps = {
  value?: string | null;
  className?: string;
};

const parseInlineFormatting = (text: string) => {
  const matches = text.matchAll(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    const token = match[0];
    const start = match.index ?? 0;

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${start}-bold`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`${start}-italic`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`${start}-code`}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-700"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }

    cursor = start + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [text];
};

export function FeedbackCommentContent({
  value,
  className = "",
}: FeedbackCommentContentProps) {
  if (!value?.trim()) {
    return <span className="text-muted-foreground">N/A</span>;
  }

  const lines = value.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, "").trim());
        index += 1;
      }

      blocks.push(
        <ul key={`list-${index}`} className="list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`item-${itemIndex}`}>{parseInlineFormatting(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^\s*[-*]\s+/.test(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="leading-6">
        {paragraphLines.map((paragraphLine, lineIndex) => (
          <React.Fragment key={`line-${lineIndex}`}>
            {lineIndex > 0 && <br />}
            {parseInlineFormatting(paragraphLine)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return <div className={`space-y-2 whitespace-normal ${className}`}>{blocks}</div>;
}
