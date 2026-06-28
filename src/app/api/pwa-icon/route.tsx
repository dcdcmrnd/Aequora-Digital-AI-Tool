import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const size = Number(new URL(req.url).searchParams.get("size")) || 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "#0A2540",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size * 0.2,
        }}
      >
        {/* Teal inner square */}
        <div
          style={{
            width: size * 0.7,
            height: size * 0.7,
            background: "#0F7B8A",
            borderRadius: size * 0.14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Wave icon */}
          <svg
            width={size * 0.44}
            height={size * 0.44}
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
    { width: size, height: size }
  );
}
