// remove extra spaces and trim the string
export const normalizeSpaces = (v: string) =>
    v.replace(/\s{2,}/g, " ").trimStart();