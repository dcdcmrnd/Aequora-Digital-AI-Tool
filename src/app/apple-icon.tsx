import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#0A2540",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 126,
            height: 126,
            background: "#0F7B8A",
            borderRadius: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={80}
            height={80}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <path d="M3 10c1.5-3 3-4.5 4.5-4.5S10.5 7 12 7s3-1.5 4.5-1.5S19.5 7 21 10" />
            <path d="M3 15c1.5-3 3-4.5 4.5-4.5S10.5 12.5 12 12.5s3-1.5 4.5-1.5S19.5 12.5 21 15" />
          </svg>
        </div>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
