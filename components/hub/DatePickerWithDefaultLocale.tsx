"use client";

import DatePicker, { type ReactDatePickerProps } from "react-datepicker";
import { enGB } from "date-fns/locale/en-GB";
import "react-datepicker/dist/react-datepicker.css";

export default function DatePickerWithDefaults(props: ReactDatePickerProps) {
  return (
    <DatePicker
      locale={enGB}
      dateFormat="dd/MM/yyyy"
      {...props}
    />
  );
}
