function normalizeLine(value: string) {
  return value.replace(/\r/g, "").trim();
}

export function splitPdfIntoQuestionCandidates(text: string) {
  const normalized = text
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .join("\n");

  return normalized
    .split(/(?=(?:Question\s*:?|\d+[\.)]\s))/gi)
    .map((block) => block.trim())
    .filter((block) => block.length > 30);
}
