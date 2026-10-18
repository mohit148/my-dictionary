import { Download } from "lucide-react";
import { ImportPanel } from "@/components/import-panel";

export const metadata = { title: "Import / Export · My Dictionary" };

export default function ImportExportPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Import / Export</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        Upload your existing vocabulary JSON as-is. Files are checked and previewed first, and nothing is saved until you confirm.
        Entries are never silently overwritten or dropped.
      </p>
      <ImportPanel />

      <section className="mt-12 max-w-2xl rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="mt-1 text-sm text-muted">
          Download your whole dictionary as one JSON file: words, definitions, examples, notes, categories, favorites and
          differences. The file uses the same format as the import, so you can re-import it anywhere without losing anything.
        </p>
        <a
          href="/api/export"
          download
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-accent-strong px-4 text-sm font-medium text-on-accent hover:brightness-110"
        >
          <Download className="size-4" /> Download JSON
        </a>
      </section>
    </div>
  );
}
