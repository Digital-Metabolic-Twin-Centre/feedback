import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
           <h1>DMTC Feedback API is running</h1>
      <p>See /api/v1/docs for documentation</p>
      </body>
    </html>
  );
}
