"use client";

import { useState, useRef } from "react";
import DataTable from "./DataTable";
import { flattenResponse } from "@/lib/utils";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type Method = "GET" | "POST" | "PUT" | "DELETE";
type EndpointCode = { code: string; desc: string };
type EndpointGroup = { group: string; codes: EndpointCode[] };

// ── 엔드포인트 목록 (그룹화) ───────────────────────────────────────────
const ENDPOINTS: Record<string, { label: string; groups: EndpointGroup[] }> = {
  db: {
    label: "/db/",
    groups: [
      { group: "Project", codes: [
        { code: "PJCF",  desc: "Project Information" },
        { code: "UNIT",  desc: "Unit System" },
        { code: "STYP",  desc: "Structure Type" },
        { code: "GRUP",  desc: "Structure Group" },
        { code: "BNGR",  desc: "Boundary Group" },
        { code: "LDGR",  desc: "Load Group" },
        { code: "TDGR",  desc: "Tendon Group" },
      ]},
      { group: "View", codes: [
        { code: "NPLN",  desc: "Named Plane" },
        { code: "CO_M",  desc: "Material Color" },
        { code: "CO_S",  desc: "Section Color" },
        { code: "CO_T",  desc: "Thickness Color" },
        { code: "CO_F",  desc: "Floor Load Color" },
      ]},
      { group: "Structure", codes: [
        { code: "STOR",  desc: "Story Data" },
      ]},
      { group: "Node / Element", codes: [
        { code: "NODE",  desc: "Node" },
        { code: "ELEM",  desc: "Element" },
        { code: "SKEW",  desc: "Node Local Axis" },
        { code: "MADO",  desc: "Define Domain" },
        { code: "SBDO",  desc: "Define Sub-Domain" },
        { code: "DOEL",  desc: "Domain Element" },
      ]},
      { group: "Properties", codes: [
        { code: "MATL",    desc: "Material Properties" },
        { code: "IMFM",    desc: "Inelastic Material (Fiber)" },
        { code: "TDMF",    desc: "Time Dependent Material - User Defined" },
        { code: "TDMT",    desc: "Time Dependent Material - Creep/Shrinkage" },
        { code: "TDME",    desc: "Time Dependent Material - Compressive Strength" },
        { code: "EDMP",    desc: "Change Property" },
        { code: "TMAT",    desc: "Time Dependent Material Link" },
        { code: "EPMT",    desc: "Plastic Material" },
        { code: "SECT",    desc: "Section Properties" },
        { code: "THK",     desc: "Thickness" },
        { code: "TSGR",    desc: "Tapered Group" },
        { code: "SECF",    desc: "Section Manager - Stiffness" },
        { code: "RPSC",    desc: "Section Manager - Reinforcements" },
        { code: "STRPSSM", desc: "Section Manager - Stress Points" },
        { code: "PSSF",    desc: "Section Manager - Plate Stiffness Scale Factor" },
        { code: "VBEM",    desc: "Section Manager - Virtual Beam" },
        { code: "VSEC",    desc: "Section Manager - Virtual Section" },
        { code: "EWSF",    desc: "Effective Width Scale Factor" },
        { code: "IEHC",    desc: "Inelastic Hinge Control" },
        { code: "IEHG",    desc: "Assign Inelastic Hinge Properties" },
        { code: "FIMP",    desc: "Inelastic Material Properties" },
        { code: "FIBR",    desc: "Fiber Division of Section" },
        { code: "GRDP",    desc: "Group Damping" },
        { code: "ESSF",    desc: "Element Stiffness Scale Factor" },
      ]},
      { group: "Boundary", codes: [
        { code: "CONS",  desc: "Constraint Support" },
        { code: "NSPR",  desc: "Point Spring" },
        { code: "GSTP",  desc: "Define General Spring Types" },
        { code: "GSPR",  desc: "Assign General Spring Supports" },
        { code: "SSPS",  desc: "Surface Spring" },
        { code: "ELNK",  desc: "Elastic Link" },
        { code: "RIGD",  desc: "Rigid Link" },
        { code: "NLLP",  desc: "General Link Properties" },
        { code: "NLNK",  desc: "General Link" },
        { code: "CGLP",  desc: "Change General Link Property" },
        { code: "FRLS",  desc: "Beam End Releases" },
        { code: "OFFS",  desc: "Beam End Offsets" },
        { code: "PRLS",  desc: "Plate End Release" },
        { code: "MLFC",  desc: "Force-Deformation Function" },
        { code: "SDVI",  desc: "Seismic Device - Viscous/Oil Damper" },
        { code: "SDVE",  desc: "Seismic Device - Viscoelastic Damper" },
        { code: "SDST",  desc: "Seismic Device - Steel Damper" },
        { code: "SDHY",  desc: "Seismic Device - Hysteretic Isolator/MSS" },
        { code: "SDIS",  desc: "Seismic Device - Isolator/MSS" },
        { code: "MCON",  desc: "Linear Constraints" },
        { code: "PZEF",  desc: "Panel Zone Effects" },
        { code: "CLDR",  desc: "Define Constraints Label Selection" },
        { code: "DRLS",  desc: "Diaphragm Disconnect" },
      ]},
      { group: "Static Loads", codes: [
        { code: "STLD",  desc: "Static Load Cases" },
        { code: "BODF",  desc: "Self Weight" },
        { code: "CNLD",  desc: "Nodal Loads" },
        { code: "BMLD",  desc: "Beam Loads" },
        { code: "SDSP",  desc: "Specified Displacements of Support" },
        { code: "NMAS",  desc: "Nodal Masses" },
        { code: "LTOM",  desc: "Loads to Masses" },
        { code: "NBOF",  desc: "Nodal Body Force" },
        { code: "PSLT",  desc: "Define Pressure Load Type" },
        { code: "PRES",  desc: "Assign Pressure Loads" },
        { code: "PNLD",  desc: "Define Plane Load Type" },
        { code: "PNLA",  desc: "Assign Plane Loads" },
        { code: "FBLD",  desc: "Define Floor Load Type" },
        { code: "FBLA",  desc: "Assign Floor Loads" },
        { code: "FMLD",  desc: "Finishing Material Loads" },
        { code: "POSP",  desc: "Parameter of Soil Pressure" },
        { code: "EPST",  desc: "Static Earth Pressure" },
        { code: "EPSE",  desc: "Seismic Earth Pressure" },
        { code: "POSL",  desc: "Parameter of Seismic Loads" },
      ]},
      { group: "Temperature Loads", codes: [
        { code: "ETMP",  desc: "Element Temperature" },
        { code: "GTMP",  desc: "Temperature Gradient" },
        { code: "BTTP",  desc: "Beam Section Temperature" },
        { code: "STMP",  desc: "System Temperature" },
        { code: "NPMP",  desc: "Nodal Temperature" },
      ]},
      { group: "Prestress Loads", codes: [
        { code: "TDNT",  desc: "Tendon Property" },
        { code: "TDNA",  desc: "Tendon Location" },
        { code: "TDCS",  desc: "Tendon Location for Composite Section" },
        { code: "TDPL",  desc: "Tendon Prestress" },
        { code: "PRST",  desc: "Prestress Beam Loads" },
        { code: "PTNS",  desc: "Pretension Loads" },
        { code: "EXLD",  desc: "External Type Load Data for Pretension" },
      ]},
      { group: "Moving Loads", codes: [
        { code: "MVCD",   desc: "Moving Load Code" },
        { code: "LLAN",   desc: "Traffic Line Lanes" },
        { code: "LLANtr", desc: "Traffic Line Lanes - Moving Load Optimization" },
        { code: "LLAN6",  desc: "Traffic Surface Lanes" },
        { code: "LLAH4",  desc: "Traffic Surface Lanes - China" },
        { code: "LLAP",   desc: "Traffic Surface Lanes - Moving Load Optimization" },
        { code: "MVHCL",  desc: "Vehicles - AASHTO Standard" },
        { code: "MVHCL2", desc: "Vehicles - AASHTO LRFD" },
        { code: "MVHKR",  desc: "Vehicles - Korea" },
        { code: "MVHEU",  desc: "Vehicles - Eurocode" },
        { code: "MVHBS",  desc: "Vehicles - BS" },
        { code: "MVHCA",  desc: "Vehicles - Canada" },
        { code: "MVHAU",  desc: "Vehicles - Australia" },
        { code: "MVHCN",  desc: "Vehicles - China" },
        { code: "MVHJA",  desc: "Vehicles - Japan" },
        { code: "AIMP",   desc: "Autolane/Impact Factor" },
        { code: "RFTG",   desc: "Railway Dynamic Factor" },
        { code: "DYNF",   desc: "Railway Dynamic Factor by Element" },
      ]},
      { group: "Dynamic Loads", codes: [
        { code: "SPFC",  desc: "Response Spectrum Functions" },
        { code: "SPLC",  desc: "Response Spectrum Load Cases" },
        { code: "THGC",  desc: "Time History Detail Control" },
        { code: "THIS",  desc: "Time History Load Cases" },
        { code: "THFC",  desc: "Time History Functions" },
        { code: "THGA",  desc: "Ground Acceleration" },
        { code: "THNL",  desc: "Dynamic Nodal Loads" },
        { code: "THSL",  desc: "Time Varying Static Loads" },
        { code: "THMS",  desc: "Multiple Support Functions" },
      ]},
      { group: "Construction Stage Loads", codes: [
        { code: "STAG",  desc: "Define Construction Stage" },
        { code: "CSCS",  desc: "Define Section for CS" },
        { code: "TMLD",  desc: "Time Lines for CS" },
        { code: "STBK",  desc: "Soft-Back Loads for Nonlinear CS" },
        { code: "CMCS",  desc: "Camber for CS" },
        { code: "CRPC",  desc: "Creep Coefficient for CS" },
      ]},
      { group: "Heat of Hydration Loads", codes: [
        { code: "AETC",  desc: "Ambient Temperature Functions" },
        { code: "COTC",  desc: "Convection Coefficient Functions" },
        { code: "HECB",  desc: "Cement Convolution Boundary" },
        { code: "HEPT",  desc: "Prescribed Temperature" },
        { code: "HPFC",  desc: "Heat Source Functions" },
        { code: "ABHS",  desc: "Assign Heat Source" },
        { code: "HPCE",  desc: "Pipe Cooling" },
        { code: "HPTS",  desc: "Define CS for Hydration" },
      ]},
      { group: "Settlement Loads", codes: [
        { code: "SMPT",  desc: "Settlement Group" },
        { code: "SMLC",  desc: "Settlement Load Cases" },
      ]},
      { group: "Miscellaneous Loads", codes: [
        { code: "PLCB",  desc: "Pre-composite Section" },
        { code: "LDSQ",  desc: "Load Sequence for Nonlinear" },
        { code: "WVLD",  desc: "Wave Loads" },
        { code: "IELC",  desc: "Ignore Elements for Load Cases" },
        { code: "IFGS",  desc: "Large Displacement - Initial Forces" },
        { code: "EFCT",  desc: "Small Displacement - Initial Force Control" },
        { code: "INMF",  desc: "Small Displacement - Initial Element Force" },
      ]},
      { group: "Analysis", codes: [
        { code: "ACTL",  desc: "Main Control Data" },
        { code: "PDEL",  desc: "P-Delta Analysis Control" },
        { code: "BUCK",  desc: "Buckling Analysis Control" },
        { code: "EIGV",  desc: "Eigenvalue Analysis Control" },
        { code: "HHCT",  desc: "Heat of Hydration Analysis Control" },
        { code: "MVCT",  desc: "Moving Load Analysis Control" },
        { code: "SMCT",  desc: "Settlement Analysis Control" },
        { code: "NLCT",  desc: "Nonlinear Analysis Control" },
        { code: "STCT",  desc: "Construction Stage Analysis Control" },
        { code: "BCCT",  desc: "Boundary Change Assignment" },
      ]},
      { group: "Load Combinations", codes: [
        { code: "LCOM-GEN",     desc: "Load Combinations - General" },
        { code: "LCOM-CONC",    desc: "Load Combinations - Concrete" },
        { code: "LCOM-STEEL",   desc: "Load Combinations - Steel" },
        { code: "LCOM-SRC",     desc: "Load Combinations - SRC" },
        { code: "LCOM-STLCOMP", desc: "Load Combinations - Composite Steel" },
        { code: "LCOM-SEISMIC", desc: "Load Combinations - Seismic" },
        { code: "CLUTL",        desc: "Cutting Line" },
        { code: "CLWP",         desc: "Plate Cutting Line Diagram" },
      ]},
      { group: "Pushover", codes: [
        { code: "POGD",  desc: "Pushover Analysis Control" },
        { code: "IEPI",  desc: "Ignore Elements to Pushover Initial Load" },
        { code: "PHGE",  desc: "Assign Pushover Hinge Properties" },
        { code: "POLC",  desc: "Pushover Load Cases" },
      ]},
      { group: "Design", codes: [
        { code: "DCON",  desc: "RC Design Code" },
        { code: "MATD",  desc: "Modify Concrete Materials" },
        { code: "RCHK",  desc: "Rebar Input for Checking" },
        { code: "LENG",  desc: "Unbraced Length" },
        { code: "MEMB",  desc: "Member Assignment" },
        { code: "DCTL",  desc: "Definition of Frame" },
        { code: "LTSR",  desc: "Limiting Slenderness Ratio" },
        { code: "ULCT",  desc: "Underground Load Combination Type" },
        { code: "MBTP",  desc: "Modify Member Type" },
        { code: "WMAK",  desc: "Modify Wall Mark Design" },
        { code: "DSTL",  desc: "Steel Design Code" },
      ]},
    ],
  },
  ope: {
    label: "/ope/",
    groups: [{ group: "Operation", codes: [
      { code: "PROJECTSTATUS", desc: "Project Status" },
      { code: "VIVEDLZM",      desc: "Display Elements" },
      { code: "SELVLC",        desc: "Section Properties Calculation Results" },
      { code: "SELVLC2",       desc: "Using Load Combinations" },
      { code: "BMHLD",         desc: "Line Beam Load" },
      { code: "AUTMESH",       desc: "Auto-Mesh Panel Area" },
      { code: "GSPS",          desc: "Surface Spring" },
      { code: "STOB",          desc: "Story Calculation" },
      { code: "STOB_PARAMS",   desc: "Story Check Parameters" },
      { code: "STORP_PARAM",   desc: "Story Irregularity Check Parameter" },
      { code: "STOR_PROPF",    desc: "Story Properties" },
      { code: "TORMHB",        desc: "Member Assignment" },
    ]}],
  },
  view: {
    label: "/view/",
    groups: [{ group: "View", codes: [
      { code: "SELECT",        desc: "Select" },
      { code: "CAPTURE",       desc: "Capture" },
      { code: "PICFUTRE",      desc: "Dialog Capture" },
      { code: "IMAGE",         desc: "Image" },
      { code: "ACTIVE",        desc: "Active" },
      { code: "DISPLAY",       desc: "Display" },
      { code: "RESULTDISPLAY", desc: "Type of Display (결과 표시)" },
    ]}],
  },
  post: {
    label: "/post/TABLE",
    groups: [{ group: "Design", codes: [
      { code: "PM",                    desc: "P-M Interaction Diagram" },
      { code: "STEES_CODECHECK",       desc: "Steel Code Check" },
      { code: "BEAMDESIGNFORCES",      desc: "Concrete - Beam Design Forces" },
      { code: "COLUMNDESIGNFORCES",    desc: "Concrete - Column Design Forces" },
      { code: "WALLDESIGNFORCES",      desc: "Concrete - Wall Design Forces" },
      { code: "SPCBEAMDESIGNFORCES",   desc: "SRC - Beam Design Forces" },
      { code: "SPCCOLUMNDESIGNFORCES", desc: "SRC - Column Design Forces" },
    ]}],
  },
};

// ── /post/TABLE 기본 Body 템플릿 ──────────────────────────────────────
// TABLE_TYPE별 기본 COMPONENTS 매핑
const TABLE_COMPONENTS: Record<string, string[]> = {
  BEAMDESIGNFORCES:      ["Memb", "Part", "LComName", "Type", "Fz", "Mx", "My(-)", "My(+)"],
  COLUMNDESIGNFORCES:    ["Memb", "Part", "LComName", "Type", "Fz", "Mx", "My", "Mz"],
  WALLDESIGNFORCES:      ["Memb", "Part", "LComName", "Type", "Fz", "Mx", "My"],
  SPCBEAMDESIGNFORCES:   ["Memb", "Part", "LComName", "Type", "Fz", "Mx", "My(-)", "My(+)"],
  SPCCOLUMNDESIGNFORCES: ["Memb", "Part", "LComName", "Type", "Fz", "Mx", "My", "Mz"],
};

function buildPostTableBody(tableType: string) {
  return JSON.stringify({
    Argument: {
      TABLE_TYPE: tableType,
      UNIT: { FORCE: "KN", DIST: "M" },
      STYLES: { FORMAT: "Fixed", PLACE: 3 },
      NODE_ELEMS: { KEYS: [] },
      PARTS: ["PartI", "PartJ"],
      COMPONENTS: TABLE_COMPONENTS[tableType] ?? [],
    },
  }, null, 2);
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────
export default function EndpointForm() {
  const [prefix, setPrefix] = useState<string>("db");
  const [code, setCode] = useState<string>("STOR");
  const [method, setMethod] = useState<Method>("GET");
  const [body, setBody] = useState("{}");
  const [bodyError, setBodyError] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const abortRef = useRef<AbortController | null>(null);

  const handlePrefixChange = (p: string) => {
    setPrefix(p);
    const firstCode = ENDPOINTS[p].groups[0].codes[0].code;
    setCode(firstCode);
    setResponse(null);
    setError("");
    if (p === "post") {
      setMethod("POST");
      setBody(buildPostTableBody(firstCode));
    }
  };

  const handleCodeChange = (c: string) => {
    setCode(c);
    setResponse(null);
    setError("");
    if (prefix === "post") {
      setBody(buildPostTableBody(c));
    }
  };

  const handleCancel = () => abortRef.current?.abort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResponse(null);

    const effectiveMethod = prefix === "post" ? "POST" : method;
    let parsedBody: unknown = {};
    if (effectiveMethod !== "GET" && effectiveMethod !== "DELETE") {
      try {
        parsedBody = JSON.parse(body);
        setBodyError("");
      } catch {
        setBodyError("유효하지 않은 JSON 형식입니다");
        return;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 120000);

    setLoading(true);
    try {
      const opts: RequestInit = {
        method: effectiveMethod,
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      };
      if (effectiveMethod !== "GET" && effectiveMethod !== "DELETE") {
        opts.body = JSON.stringify(parsedBody);
      }
      const apiPath = prefix === "post" ? `${prefix}/TABLE` : `${prefix}/${code}`;
      const res = await fetch(`${BACKEND_URL}/api/midas/${apiPath}`, opts);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.detail ?? `HTTP ${res.status}`);
      } else {
        setResponse(json);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("요청이 취소되었습니다 (120초 타임아웃).");
      } else {
        setError(String(err));
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const rows = response ? flattenResponse(response) : [];
  const columns = rows.length > 0 ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : [];

  const currentDesc = ENDPOINTS[prefix].groups
    .flatMap((g) => g.codes)
    .find((c) => c.code === code)?.desc ?? "";

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-4">

        <div className="flex gap-3 flex-wrap">
          {/* HTTP Method */}
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(["GET", "POST", "PUT", "DELETE"] as Method[]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Prefix */}
          <select
            value={prefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-blue-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(ENDPOINTS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>

          {/* Code (그룹화된 optgroup) */}
          <select
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="flex-1 min-w-0 rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ENDPOINTS[prefix].groups.map(({ group, codes }) => (
              <optgroup key={group} label={group}>
                {codes.map(({ code: c, desc }) => (
                  <option key={c} value={c}>{c} — {desc}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "요청 중..." : "전송"}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg bg-gray-700 border border-gray-600 px-4 py-2 text-sm font-medium text-red-400 hover:bg-gray-600 transition-colors"
            >
              취소
            </button>
          )}
        </div>

        {/* 현재 경로 표시 */}
        <p className="text-xs text-gray-500 font-mono">
          → <span className="text-gray-300">{prefix === "post" ? `/post/TABLE` : `/${prefix}/${code}`}</span>
          {currentDesc && <span className="text-gray-600 ml-2">({currentDesc})</span>}
          {prefix === "post" && <span className="text-blue-400 ml-2">[POST · TABLE_TYPE: {code}]</span>}
        </p>

        {/* Body (POST/PUT) */}
        {(method === "POST" || method === "PUT" || prefix === "post") && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Request Body (JSON)
            </label>
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setBodyError(""); }}
              rows={6}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            {bodyError && <p className="text-red-400 text-xs mt-1">{bodyError}</p>}
          </div>
        )}
      </form>

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {response !== null && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">응답</h2>
            <div className="flex gap-2">
              <button onClick={() => setViewMode("table")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}>
                테이블
              </button>
              <button onClick={() => setViewMode("json")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${viewMode === "json" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}>
                JSON
              </button>
            </div>
          </div>

          {viewMode === "json" ? (
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400 font-mono max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          ) : rows.length > 0 ? (
            <DataTable columns={columns} rows={rows} />
          ) : (
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400 font-mono max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
