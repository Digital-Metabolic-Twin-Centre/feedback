export type ForeignOption = {
  value: number | string;
  label: string;

  // optional for visit_id dropdowns
  participant_id?: number | string | null;

  // optional metadata for IEMBASE / ref tables
  alternative_names?: string | null;
  iembase_url?: string | null;
  min_group_size?: number | null;
  recruited_count?: number | null;

  // optional for ordered lists
  order?: number | string | null;
};
