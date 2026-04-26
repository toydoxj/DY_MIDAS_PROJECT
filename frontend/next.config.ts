import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // jspdf 4.x 의 node 빌드(`jspdf.node.min.js`)는 fflate 의 동적 require 를 포함해
  // Turbopack 의 SSR 컴파일에서 resolve 실패. 브라우저용 ES 빌드로 강제 매핑.
  turbopack: {
    resolveAlias: {
      jspdf: "jspdf/dist/jspdf.es.min.js",
    },
  },
};

export default nextConfig;
