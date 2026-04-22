const DEFAULT_SAMPLE_URL =
  "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250312001148";

const form = document.getElementById("export-form");
const reportUrlInput = document.getElementById("report-url");
const apiEndpointInput = document.getElementById("api-endpoint");
const sampleButton = document.getElementById("sample-button");
const submitButton = document.getElementById("submit-button");
const statusCard = document.getElementById("status-card");

hydrateSavedEndpoint();
hydrateEndpointFromQuery();

sampleButton.addEventListener("click", () => {
  reportUrlInput.value = DEFAULT_SAMPLE_URL;
  reportUrlInput.focus();
  setStatus(
    "ready",
    "샘플 링크를 넣었습니다.",
    "필요하면 API 주소를 바꾸고 바로 내려받기를 실행하세요."
  );
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const reportUrl = reportUrlInput.value.trim();
  const apiEndpoint = resolveApiEndpoint(apiEndpointInput.value.trim());

  if (!reportUrl) {
    setStatus("error", "보고서 URL이 비어 있습니다.", "DART 링크를 먼저 넣어주세요.");
    reportUrlInput.focus();
    return;
  }

  if (!looksLikeDartReportUrl(reportUrl)) {
    setStatus(
      "error",
      "DART 사업보고서 링크 형식이 아닙니다.",
      "`main.do?rcpNo=...` 형식의 URL인지 확인해주세요."
    );
    reportUrlInput.focus();
    return;
  }

  if (!apiEndpoint) {
    setStatus(
      "error",
      "API 엔드포인트를 확인할 수 없습니다.",
      "GitHub Pages에서는 Worker URL을 넣는 방식으로 사용하는 것을 권장합니다."
    );
    apiEndpointInput.focus();
    return;
  }

  submitButton.disabled = true;
  persistEndpoint(apiEndpointInput.value.trim());
  setStatus(
    "busy",
    "엑셀 파일을 만드는 중입니다.",
    "Worker가 DART 본문과 상세표를 읽고 있으니 잠시만 기다려주세요."
  );

  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ reportUrl }),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message);
    }

    const blob = await response.blob();
    const filename =
      readFileNameFromDisposition(response.headers.get("content-disposition")) ||
      buildFallbackFilename(reportUrl);

    triggerDownload(blob, filename);
    setStatus(
      "success",
      "엑셀 파일 다운로드가 시작되었습니다.",
      `파일명: ${filename}`
    );
  } catch (error) {
    setStatus(
      "error",
      "엑셀 생성에 실패했습니다.",
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    );
  } finally {
    submitButton.disabled = false;
  }
});

function hydrateSavedEndpoint() {
  const saved = window.localStorage.getItem("dartcrawl_api_endpoint");
  if (saved && !apiEndpointInput.value) {
    apiEndpointInput.value = saved;
  }
}

function hydrateEndpointFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const api = params.get("api");
  if (api) {
    apiEndpointInput.value = api;
  }
}

function persistEndpoint(value) {
  if (value) {
    window.localStorage.setItem("dartcrawl_api_endpoint", value);
  }
}

function resolveApiEndpoint(rawValue) {
  if (rawValue) {
    return rawValue;
  }

  if (window.location.origin.startsWith("http")) {
    return `${window.location.origin}/api/export`;
  }

  return "";
}

function looksLikeDartReportUrl(url) {
  return /^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d+/.test(url);
}

function readFileNameFromDisposition(headerValue) {
  if (!headerValue) {
    return "";
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = headerValue.match(/filename="?([^"]+)"?/i);
  return plainMatch ? plainMatch[1] : "";
}

function buildFallbackFilename(reportUrl) {
  const url = new URL(reportUrl);
  const rcpNo = url.searchParams.get("rcpNo") || "dart-report";
  return `dart-detail-tables-${rcpNo}.xls`;
}

async function readErrorMessage(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (data && typeof data.error === "string") {
      return data.error;
    }
  }

  const text = await response.text();
  return text || `요청 실패: ${response.status}`;
}

function triggerDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function setStatus(kind, title, body) {
  statusCard.className = "status-card";

  if (kind === "busy") {
    statusCard.classList.add("is-busy");
  } else if (kind === "success") {
    statusCard.classList.add("is-success");
  } else if (kind === "error") {
    statusCard.classList.add("is-error");
  }

  statusCard.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
