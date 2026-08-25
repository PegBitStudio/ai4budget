import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KoboPilot — your AI co-pilot for spending, budgeting and saving in Naira";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card WhatsApp, Instagram and every other platform show when this site's
 * link is pasted or shared. Without a file at this path there is no image at
 * all — just a bare link with no way to tell what it opens into.
 *
 * Mirrors the landing page's own hero card (same ink, same violet/emerald
 * glow) rather than a separate design, so the preview and the page it links
 * to read as the same product.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#27235b",
          backgroundImage:
            "radial-gradient(circle at 8% 10%, rgba(167,139,250,0.35), transparent 55%), radial-gradient(circle at 100% 0%, rgba(52,211,153,0.22), transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundImage: "linear-gradient(135deg, #7c3aed, #312e81)",
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 700, color: "#ffffff" }}>
              K
            </span>
          </div>
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.01em",
            }}
          >
            KoboPilot
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#c4b5fd",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            Personal finance, in Naira
          </span>
          <span
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              maxWidth: 980,
            }}
          >
            You earned well this month.
          </span>
          <span
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "#a7f3d0",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
            }}
          >
            So where did it all go?
          </span>
        </div>

        {/* Proof strip — the same figures the landing page shows.
            "NGN" rather than "₦": the default font this renderer falls back
            to has no glyph for the Naira sign, and Satori has no font-fallback
            chain — a missing glyph renders as a blank box, not a substitute
            character. That failure is invisible until you actually look at
            the rendered PNG, which is why it's worth stating here. */}
        <div style={{ display: "flex", gap: 56 }}>
          <Stat label="Earned in August" value="NGN 535,000" tone="#a7f3d0" />
          <Stat label="Actually spent" value="NGN 757,750" tone="#fecaca" />
          <Stat label="Over budget in" value="7 of 10 categories" tone="#fecaca" />
        </div>
      </div>
    ),
    { ...size }
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#ddd6fe",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 34, fontWeight: 700, color: tone }}>
        {value}
      </span>
    </div>
  );
}
