import ImageConverter from "@/components/ImageConverter";
import DarkModeToggle from "@/components/DarkModeToggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-neutral-900 leading-tight dark:text-neutral-100">Image Converter</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">PNG, JPG, WebP, AVIF, GIF, TIFF &mdash; all formats, all directions</p>
          </div>
          <DarkModeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <ImageConverter />
      </main>
    </div>
  );
}
