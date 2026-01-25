import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CSV Editor & Converter - AutelysT",
  description:
    "Edit massive CSV files, convert Excel sheets, freeze rows/columns, and download as CSV or XLSX without type conversion.",
  keywords: [
    "csv",
    "excel",
    "xlsx",
    "sheet",
    "editor",
    "converter",
    "freeze rows",
    "freeze columns",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
