import Script from "next/script";

/**
 * Widget markup/attributes are DesignRush's own embed snippet -- reproduce verbatim (aria-label
 * text included). Script is deduped by next/script across the app, so mounting this section more
 * than once on a page would still only inject the tag once.
 */
export function VerifiedReviewsSection() {
  return (
    <section aria-labelledby="verified-reviews-heading" className="bg-slate-50 py-16 sm:py-20 lg:py-24">
      <div className="mb-10 sm:mb-14">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <span aria-hidden="true" className="h-px w-6 bg-blue-600" />
          Verified Reviews
        </div>
        {/* `.site-content h2` (globals.css) sets a fixed 30px/700 that out-specifies a bare
            utility class on the same element -- see HowItWorksSection.tsx for the same fix. */}
        <h2
          id="verified-reviews-heading"
          className="!text-3xl !font-extrabold tracking-tight text-slate-900 sm:!text-4xl lg:!text-5xl"
        >
          Reviewed by clients. <em className="font-semibold italic text-blue-600">Verified by DesignRush.</em>
        </h2>
      </div>

      <Script src="https://www.designrush.com/topbest/js/widgets/agency-reviews.js" strategy="afterInteractive" defer />

      <div
        data-designrush-widget
        data-agency-id="122039"
        data-style="light"
        aria-label="DesignRush agency reviews section"
        className="min-h-[420px]"
      />
      <noscript>
        <a
          href="https://www.designrush.com/agency/profile/aequora-digital#reviews"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit Aequora Digital reviews on DesignRush"
          className="text-sm font-medium text-blue-600 underline underline-offset-2"
        >
          REVIEW US ON DESIGNRUSH
        </a>
      </noscript>
    </section>
  );
}
