// 본 프로젝트는 next.config.ts 의 `output: "export"` 정적 export — Vercel edge
// cache HIT 이슈가 없어 force-dynamic을 사용할 수 없다(빌드 실패).
// callback page는 client-side에서 fragment를 파싱하므로 static HTML로도 동작.
// 외부 Vercel 배포 시에는 force-dynamic + revalidate=0 추가 필요.
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
