import { useMemo } from "react";
import { useWatch, Control, FieldValues, Path } from "react-hook-form";
import { ForeignOption } from "@/types/common";
/**
 * Returns the label for a watched foreign-key field value
 *
 * @param control - React Hook Form control
 * @param foreignOptions - A map of foreign option lists
 * @param fieldName - Name of the field to watch and resolve
 * @returns string | undefined — Label of the matched option
 */
export function useForeignOptionLabel<T extends FieldValues>(
  control: Control<T>,
  foreignOptions: Record<string, ForeignOption[]>,
  fieldName: string
): string | undefined {
  const watchValue = useWatch({
    control,
    name: fieldName as Path<T>,
  });

  return useMemo(() => {
    const options = foreignOptions?.[fieldName] || [];
    return options.find((opt) => String(opt.value) === String(watchValue))?.label;
  }, [watchValue, foreignOptions, fieldName]);
}
