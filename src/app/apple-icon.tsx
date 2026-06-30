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
          background: "#0F7B8A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
        }}
      >
        <span
          style={{
            color: "#F5F0EA",
            fontSize: 100,
            fontWeight: 800,
            letterSpacing: "-5px",
            lineHeight: 1,
          }}
        >
          Ae
        </span>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
