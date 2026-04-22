"use client";

import BaseForm from "./BaseForm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function BaseFormAuth(props: any) {
  // Authentication is no longer required — feedback pages are publicly accessible.
  return <BaseForm {...props} />;
}
