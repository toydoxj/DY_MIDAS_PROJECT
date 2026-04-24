import { BACKEND_URL } from "@/lib/types";

/** MIDAS GEN에서 Element 활성화 (Apps > Active). MaxTableIntegrated 체크박스에서 호출. */
export async function activateElementsInMidas(elementKeys: number[]): Promise<void> {
  await fetch(`${BACKEND_URL}/api/midas/view/ACTIVE`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Argument: {
        ACTIVE_MODE: elementKeys.length === 0 ? "All" : "Active",
        N_LIST: [] as number[],
        E_LIST: elementKeys,
      },
    }),
  });
}
