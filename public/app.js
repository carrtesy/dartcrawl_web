const keywordInput = document.getElementById("keyword-input");
const searchForm = document.getElementById("search-form");
const resultsList = document.getElementById("results-list");
const statusCard = document.getElementById("status-card");
const exportIdle = document.getElementById("export-idle");
const selectedCard = document.getElementById("selected-card");
const selectedCompany = document.getElementById("selected-company");
const selectedReportTitle = document.getElementById("selected-report-title");
const reportUrlInput = document.getElementById("report-url");
const reportUrlLink = document.getElementById("report-url-link");
const downloadButton = document.getElementById("download-button");
const downloadStatus = document.getElementById("download-status");
const fileList = document.getElementById("file-list");
const panelTabs = document.getElementById("panel-tabs");
const searchPanelEl = document.querySelector(".search-panel");
const exportPanelEl = document.querySelector(".export-panel");

let selectedItem = null;
let selectedListItem = null;
let exportEndpoint = "";
let searchTimer = null;
let searchSequence = 0;
let companyIndex = [];
let indexReady = false;

const isMobile = () => window.matchMedia("(max-width: 720px)").matches;

function switchTab(tab) {
  if (!isMobile()) return;
  const isSearch = tab === "search";
  searchPanelEl.classList.toggle("is-tab-hidden", !isSearch);
  exportPanelEl.classList.toggle("is-tab-hidden", isSearch);
  for (const btn of panelTabs.querySelectorAll(".tab-btn")) {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  }
}

for (const btn of panelTabs.querySelectorAll(".tab-btn")) {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
}

switchTab("search");

void bootstrap();

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runSearch();
});

keywordInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);

  const keyword = keywordInput.value.trim();
  if (!keyword) {
    clearResults();
    hideSelectedCard();
    setStatus("idle", "검색어를 입력하세요.", "입력할 때마다 기업 리스트를 바로 불러옵니다.");
    return;
  }

  searchTimer = window.setTimeout(() => {
    void runSearch();
  }, 120);
});

downloadButton.addEventListener("click", async () => {
  await exportSelectedReport();
});

async function bootstrap() {
  exportEndpoint = resolveExportEndpoint();
  setStatus("busy", "기업 목록을 불러오는 중입니다.", "검색 인덱스를 준비하고 있습니다.");

  try {
    companyIndex = await loadCompanyIndex();
    indexReady = true;
    setStatus("idle", "검색어를 입력하세요.", "입력할 때마다 기업 리스트를 바로 불러옵니다.");
  } catch (error) {
    setStatus(
      "error",
      "기업 목록을 불러오지 못했습니다.",
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    );
  }

  const params = new URLSearchParams(window.location.search);
  const initialKeyword = params.get("q");
  if (initialKeyword) {
    keywordInput.value = initialKeyword;
    await runSearch();
  }
}

async function loadCompanyIndex() {
  const response = await fetch("./data/company-index.csv");
  if (!response.ok) {
    throw new Error(`기업 인덱스 로드 실패: ${response.status}`);
  }

  const text = await response.text();
  const rows = parseCsv(text);
  return rows
    .filter((row) => row.company_name)
    .map((row) => ({
      id: row.id || "",
      group: row.group || "",
      companyName: row.company_name || "",
      reportTitle: row.report_url ? "사업보고서" : "사업보고서 링크 없음",
      reportUrl: row.report_url || "",
    }));
}

async function runSearch() {
  const currentSearchId = ++searchSequence;
  const keyword = keywordInput.value.trim();

  if (!keyword) {
    setStatus("error", "검색어를 입력하세요.", "기업명을 먼저 입력해 주세요.");
    keywordInput.focus();
    return;
  }

  if (!indexReady) {
    setStatus("busy", "기업 목록을 불러오는 중입니다.", "잠시만 기다려 주세요.");
    return;
  }

  clearResults();
  hideSelectedCard();
  setStatus("busy", "검색 중입니다.", "입력한 글자가 포함된 기업을 찾고 있습니다.");

  const normalizedKeyword = normalizeSearchText(keyword);
  const items = companyIndex
    .filter((item) => normalizeSearchText(item.companyName).includes(normalizedKeyword))
    .slice(0, 100);

  if (currentSearchId !== searchSequence) {
    return;
  }

  if (items.length === 0) {
    setStatus("error", "검색 결과가 없습니다.", "다른 기업명이나 키워드로 다시 검색해 주세요.");
    return;
  }

  renderResults(items);
  setStatus("success", `${items.length}개 기업을 찾았습니다.`, "기업 카드를 클릭하면 오른쪽에 링크가 입력됩니다.");
}

async function exportSelectedReport() {
  if (!selectedItem) {
    return;
  }

  if (!selectedItem.reportUrl) {
    setDownloadStatus("error", "사업보고서 링크가 없습니다.", "이 기업은 현재 인덱스에 보고서 링크가 비어 있습니다.");
    return;
  }

  if (!exportEndpoint) {
    setDownloadStatus("error", "내보내기 API 주소를 찾을 수 없습니다.", "/api/export 경로를 확인해 주세요.");
    return;
  }

  downloadButton.disabled = true;
  fileList.innerHTML = "";
  setDownloadStatus("busy", "엑셀을 준비하는 중입니다.", `${selectedItem.companyName} 사업보고서를 분석하고 있습니다.`);

  try {
    const response = await fetch(exportEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportUrl: selectedItem.reportUrl }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    if (!Array.isArray(data.files) || data.files.length === 0) {
      throw new Error("서버에서 파일을 반환하지 않았습니다.");
    }

    renderFileList(data.files);
    setDownloadStatus("success", "엑셀 파일이 준비되었습니다.", `${data.files.length}개 파일을 다운로드할 수 있습니다.`);
  } catch (error) {
    setDownloadStatus(
      "error",
      "엑셀 생성에 실패했습니다.",
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    );
  } finally {
    downloadButton.disabled = false;
  }
}

function renderFileList(files) {
  const companyName = selectedItem ? selectedItem.companyName : "";

  const namedFiles = files.map((file) => ({
    ...file,
    downloadName: companyName ? `${companyName}_${file.name}` : file.name,
  }));

  fileList.innerHTML = namedFiles
    .map(
      (file, index) => `
    <div class="file-item">
      <span class="file-name">${escapeHtml(file.downloadName)}</span>
      <button type="button" class="file-dl-btn" data-index="${index}">다운로드</button>
    </div>
  `
    )
    .join("");

  for (const btn of fileList.querySelectorAll(".file-dl-btn")) {
    btn.addEventListener("click", () => {
      const file = namedFiles[Number(btn.dataset.index)];
      if (!file) return;
      const blob = new Blob([file.content], { type: "application/vnd.ms-excel; charset=utf-8" });
      triggerDownload(blob, file.downloadName);
    });
  }
}

function resolveExportEndpoint() {
  if (window.location.origin.startsWith("http")) {
    return `${window.location.origin}/api/export`;
  }
  return "/api/export";
}

function renderResults(items) {
  resultsList.innerHTML = items.map((item, index) => buildResultItemHtml(item, index)).join("");

  for (const li of resultsList.querySelectorAll(".result-item")) {
    li.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      const index = Number(li.dataset.index);
      selectItem(items[index], li);
    });
  }
}

function buildResultItemHtml(item, index) {
  const groupHtml = item.group
    ? `<div class="result-group">${escapeHtml(item.group)}</div>`
    : "";
  const urlHtml = item.reportUrl
    ? `<a class="result-url" href="${escapeHtml(item.reportUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(item.reportUrl)}">${escapeHtml(item.reportUrl)}</a>`
    : `<span class="result-url">링크 없음</span>`;
  return `
    <li class="result-item" data-index="${index}">
      <strong class="result-company">${escapeHtml(item.companyName)}</strong>
      ${groupHtml}
      ${urlHtml}
    </li>
  `;
}

function selectItem(item, li) {
  if (selectedListItem) {
    selectedListItem.classList.remove("is-selected");
  }
  selectedListItem = li || null;
  if (selectedListItem) {
    selectedListItem.classList.add("is-selected");
  }

  selectedItem = item;
  selectedCompany.textContent = item.companyName;
  selectedReportTitle.textContent = item.group || item.reportTitle || "사업보고서";
  reportUrlInput.value = item.reportUrl;
  reportUrlLink.href = item.reportUrl || "#";
  reportUrlLink.classList.toggle("is-hidden", !item.reportUrl);

  fileList.innerHTML = "";
  exportIdle.classList.add("is-hidden");
  selectedCard.classList.remove("is-hidden");
  downloadButton.disabled = !item.reportUrl;
  downloadStatus.className = "status-card";
  downloadStatus.innerHTML = "";

  switchTab("export");
}

function hideSelectedCard() {
  if (selectedListItem) {
    selectedListItem.classList.remove("is-selected");
    selectedListItem = null;
  }
  selectedItem = null;
  reportUrlInput.value = "";
  reportUrlLink.href = "#";
  reportUrlLink.classList.add("is-hidden");
  fileList.innerHTML = "";
  selectedCard.classList.add("is-hidden");
  exportIdle.classList.remove("is-hidden");
  downloadButton.disabled = false;
  downloadStatus.className = "status-card";
  downloadStatus.innerHTML = "";
}

function clearResults() {
  resultsList.innerHTML = "";
}

function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) {
    return rows;
  }

  const headers = splitCsvLine(lines[0]);
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || "";
    });
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeSearchText(value) {
  return String(value).replace(/\s+/g, "").toLowerCase();
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

function setDownloadStatus(kind, title, body) {
  downloadStatus.className = "status-card";

  if (kind === "busy") {
    downloadStatus.classList.add("is-busy");
  } else if (kind === "success") {
    downloadStatus.classList.add("is-success");
  } else if (kind === "error") {
    downloadStatus.classList.add("is-error");
  }

  downloadStatus.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
