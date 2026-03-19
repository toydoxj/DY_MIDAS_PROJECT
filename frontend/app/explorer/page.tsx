import EndpointForm from "@/components/EndpointForm";

export default function ExplorerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">엔드포인트 탐색기</h1>
        <p className="text-gray-400 mt-1">
          MIDAS GEN NX API 엔드포인트를 직접 호출합니다
        </p>
      </div>
      <EndpointForm />
    </div>
  );
}
