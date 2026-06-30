import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0A2540",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
      >
        <span
          style={{
            color: "#0F7B8A",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-1px",
            lineHeight: 1,
          }}
        >
          Ae
        </span>
      </div>
    ),
    { width: 32, height: 32 }
  );
}
