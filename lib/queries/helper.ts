export const quoteIdent = (id: string) => {
  return `"${id.replace(/"/g, '""')}"`;
}