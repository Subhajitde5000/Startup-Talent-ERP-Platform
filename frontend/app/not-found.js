import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D] flex items-center justify-center">
      <div className="text-center px-4 sm:px-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#F3EBDD] mb-6">
          <span className="text-[#806236] font-serif font-bold text-xl">404</span>
        </div>
        <h1 className="text-3xl font-serif font-semibold mb-2">Page not found</h1>
        <p className="text-[#4A5568] mb-6 max-w-lg mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/employer/dashboard"
            className="px-6 py-3 rounded-lg bg-[#0F1B2D] text-white text-sm font-medium hover:bg-[#1C2B42] transition"
          >
            Go to Employer Dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-lg border border-[#E5E1D8] text-[#4A5568] text-sm font-medium hover:bg-[#F3EBDD] transition"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
