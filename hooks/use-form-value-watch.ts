import {
  useWatch,
  FieldPath,
  UseFormReturn,
  FieldValues,
} from "react-hook-form";

/**
 * A generic hook to watch any field value from any form type.
 * @param form - The useForm instance
 * @param name - The field name to watch
 */
export function useCustomFormWatch<
  TFormData extends FieldValues,
  TFieldName extends FieldPath<TFormData>
>(form: UseFormReturn<TFormData>, name: TFieldName) {
  const value = useWatch({
    control: form.control,
    name,
  });

  return { value };
}
