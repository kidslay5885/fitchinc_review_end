import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "설문 응답",
  description: "핏크닉 클래스 인사이트 설문",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#EFF6FF",
  viewportFit: "cover",
};

export default function SurveyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
