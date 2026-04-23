const BASE_URL = "https://dart.fss.or.kr";
const MAIN_URL = `${BASE_URL}/dsaf001/main.do`;
const VIEWER_URL = `${BASE_URL}/report/viewer.do`;
const SEARCH_URL = `${BASE_URL}/dsab007/detailSearch.ax`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const TARGET_SECTIONS = [
  {
    key: "연결대상종속회사현황",
    sheetName: "연결대상 종속회사 현황",
  },
  {
    key: "계열회사현황",
    sheetName: "계열회사 현황",
  },
  {
    key: "타법인출자현황",
    sheetName: "타법인출자 현황",
  },
];

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json(
        {
          ok: true,
          service: "dartcrawl-export-worker",
          date: new Date().toISOString(),
        },
        200
      );
    }

    if (request.method === "POST" && url.pathname === "/api/search-companies") {
      try {
        const body = await request.json();
        const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

        if (!keyword) {
          return json({ error: "keyword가 비어 있습니다." }, 400);
        }

        const items = await searchCompanies(keyword);
        return json({ items }, 200);
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "기업 검색 중 오류가 발생했습니다." },
          500
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/api/export") {
      try {
        const body = await request.json();
        const reportUrl = typeof body.reportUrl === "string" ? body.reportUrl.trim() : "";

        if (!reportUrl) {
          return json({ error: "reportUrl이 비어 있습니다." }, 400);
        }

        if (!looksLikeDartReportUrl(reportUrl)) {
          return json(
            { error: "DART 사업보고서 링크 형식이 아닙니다. main.do?rcpNo=... 형식을 넣어주세요." },
            400
          );
        }

        const files = await buildFilesFromReportUrl(reportUrl);
        return json({ files }, 200);
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "엑셀 생성 중 오류가 발생했습니다." },
          500
        );
      }
    }

    return json(
      {
        ok: true,
        message: "POST /api/search-companies 또는 POST /api/export 를 사용하세요.",
      },
      200
    );
  },
};

async function searchCompanies(keyword) {
  const payload = {
    currentPage: "1",
    maxResults: "20",
    maxLinks: "10",
    sort: "",
    series: "",
    textCrpCik: "",
    lateKeyword: "",
    keyword: "",
    reportNamePopYn: "",
    textkeyword: "",
    businessCode: "all",
    autoSearch: "N",
    option: "corp",
    textCrpNm: keyword,
    textCrpNm2: keyword,
    reportName: "사업보고서",
    reportName2: "사업보고서",
    tocSrch: "",
    tocSrch2: "",
    textPresenterNm: "",
    startDate: "20240101",
    endDate: formatDateYYYYMMDD(new Date()),
    finalReport: "recent",
    corporationType: "all",
    closingAccountsMonth: "all",
    publicType: "A001",
  };

  const html = await postFormText(SEARCH_URL, payload, `${BASE_URL}/dsab007/main.do?option=corp`);
  return parseSearchResults(html);
}

async function buildFilesFromReportUrl(reportUrl) {
  const rcpNo = extractRcpNo(reportUrl);
  const mainHtml = await fetchText(MAIN_URL, { rcpNo });
  const detailNode = getDetailNode(mainHtml);
  const detailHtml = await fetchText(VIEWER_URL, detailNode);
  const sheets = extractTargetTables(detailHtml);
  return TARGET_SECTIONS.map(({ key, sheetName }) => ({
    name: `${key}.xls`,
    content: singleSheetWorkbookXml(sheetName, sheets.get(sheetName)),
  }));
}

async function fetchText(url, params) {
  const targetUrl = new URL(url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      targetUrl.searchParams.set(key, value);
    }
  }

  const response = await fetch(targetUrl.toString(), {
    headers: {
      "user-agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`DART 요청 실패: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function postFormText(url, data, referer) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    body.set(key, value);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": USER_AGENT,
      referer,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`DART 검색 요청 실패: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseSearchResults(html) {
  const tbodyMatch = html.match(/<tbody[^>]*id=['"]tbody['"][^>]*>([\s\S]*?)<\/tbody>/i);
  const tbodyHtml = tbodyMatch ? tbodyMatch[1] : html;
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const items = [];
  const seenCompanies = new Set();
  let rowMatch;

  while ((rowMatch = rowPattern.exec(tbodyHtml)) !== null) {
    const cells = extractCellHtml(rowMatch[1]);
    if (cells.length < 3) {
      continue;
    }

    const companyName = cleanInlineHtml(cells[1]);
    const reportCell = cells[2];
    const reportTitle = cleanInlineHtml(reportCell);
    const reportHrefMatch = reportCell.match(/href=['"]([^'"]*\/dsaf001\/main\.do\?rcpNo=\d+[^'"]*)['"]/i);

    if (!companyName || !reportHrefMatch) {
      continue;
    }

    if (!reportTitle.includes("사업보고서")) {
      continue;
    }

    if (reportTitle.includes("[기재정정]")) {
      continue;
    }

    if (seenCompanies.has(companyName)) {
      continue;
    }

    seenCompanies.add(companyName);
    items.push({
      companyName,
      reportTitle,
      reportUrl: new URL(reportHrefMatch[1], BASE_URL).toString(),
    });
  }

  return items;
}

function extractCellHtml(rowHtml) {
  const cells = [];
  const pattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match;

  while ((match = pattern.exec(rowHtml)) !== null) {
    cells.push(match[1]);
  }

  return cells;
}

function looksLikeDartReportUrl(reportUrl) {
  return /^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d+/.test(reportUrl);
}

function extractRcpNo(reportUrl) {
  const match = reportUrl.match(/[?&]rcpNo=(\d+)/);
  if (!match) {
    throw new Error("reportUrl에서 rcpNo를 찾지 못했습니다.");
  }
  return match[1];
}

function parseTocNodes(mainHtml) {
  const pattern =
    /node\d+\['text'\]\s*=\s*"([^"]+)";[\s\S]*?node\d+\['rcpNo'\]\s*=\s*"([^"]*)";[\s\S]*?node\d+\['dcmNo'\]\s*=\s*"([^"]*)";[\s\S]*?node\d+\['eleId'\]\s*=\s*"([^"]*)";[\s\S]*?node\d+\['offset'\]\s*=\s*"([^"]*)";[\s\S]*?node\d+\['length'\]\s*=\s*"([^"]*)";[\s\S]*?node\d+\['dtd'\]\s*=\s*"([^"]*)";/g;

  const nodes = [];
  let match;

  while ((match = pattern.exec(mainHtml)) !== null) {
    nodes.push({
      text: match[1],
      rcpNo: match[2],
      dcmNo: match[3],
      eleId: match[4],
      offset: match[5],
      length: match[6],
      dtd: match[7],
    });
  }

  return nodes;
}

function getDetailNode(mainHtml) {
  const node = parseTocNodes(mainHtml).find(
    (item) => normalizeTitle(item.text) === "XII.상세표"
  );

  if (!node) {
    throw new Error("'XII. 상세표' 목차를 찾지 못했습니다.");
  }

  return node;
}

function normalizeTitle(text) {
  return text
    .trim()
    .replace(/^\d+\.\s*/, "")
    .replace(/\(상세\)/g, "")
    .replace(/\s+/g, "");
}

function extractTargetTables(detailHtml) {
  const sectionPattern = /<p[^>]*class=['"]section-2['"][^>]*>([\s\S]*?)<\/p>/gi;
  const sections = [];
  let match;

  while ((match = sectionPattern.exec(detailHtml)) !== null) {
    sections.push({
      title: cleanInlineHtml(match[1]),
      startIndex: match.index,
      endIndex: sectionPattern.lastIndex,
    });
  }

  const extracted = new Map();

  for (let index = 0; index < sections.length; index += 1) {
    const current = sections[index];
    const next = sections[index + 1];
    const segment = detailHtml.slice(
      current.endIndex,
      next ? next.startIndex : detailHtml.length
    );
    const tableHtml = findFirstDataTable(segment);
    if (!tableHtml) {
      continue;
    }

    const normalized = normalizeTitle(current.title);
    const target = TARGET_SECTIONS.find((item) => normalized.includes(item.key));
    if (target) {
      extracted.set(target.sheetName, tableToMatrix(tableHtml));
    }
  }

  const missing = TARGET_SECTIONS.filter((item) => !extracted.has(item.sheetName)).map(
    (item) => item.sheetName
  );

  if (missing.length > 0) {
    throw new Error(`필수 상세표를 찾지 못했습니다: ${missing.join(", ")}`);
  }

  return extracted;
}

function findFirstDataTable(segment) {
  const tablePattern = /<table\b([^>]*)>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tablePattern.exec(segment)) !== null) {
    const attrs = match[1] || "";
    if (/\bclass=['"][^'"]*\bnb\b/i.test(attrs)) {
      continue;
    }
    return match[0];
  }

  return "";
}

function tableToMatrix(tableHtml) {
  const rows = [];
  const occupied = new Map();
  const trPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let rowIndex = 0;

  while ((rowMatch = trPattern.exec(tableHtml)) !== null) {
    const rowCells = [];
    let colIndex = 0;
    const cellPattern = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      while (occupied.has(pointKey(rowIndex, colIndex))) {
        rowCells.push("");
        colIndex += 1;
      }

      const attrs = cellMatch[2] || "";
      const value = cleanInlineHtml(cellMatch[3]);
      const rowspan = parseSpan(attrs, "rowspan");
      const colspan = parseSpan(attrs, "colspan");

      rowCells.push(value);
      for (let extra = 1; extra < colspan; extra += 1) {
        rowCells.push("");
      }

      for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
        for (let c = colIndex; c < colIndex + colspan; c += 1) {
          occupied.set(pointKey(r, c), true);
        }
      }

      colIndex += colspan;
    }

    while (occupied.has(pointKey(rowIndex, colIndex))) {
      rowCells.push("");
      colIndex += 1;
    }

    if (rowCells.some((value) => value !== "")) {
      rows.push(rowCells);
    }

    rowIndex += 1;
  }

  const maxWidth = rows.reduce((width, row) => Math.max(width, row.length), 0);
  return rows.map((row) => row.concat(Array(maxWidth - row.length).fill("")));
}

function parseSpan(attrs, name) {
  const match = attrs.match(new RegExp(`${name}=['"]?(\\d+)['"]?`, "i"));
  return match ? Number(match[1]) : 1;
}

function pointKey(rowIndex, colIndex) {
  return `${rowIndex}:${colIndex}`;
}

function cleanInlineHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

function decodeHtmlEntities(value) {
  const named = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return named
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function singleSheetWorkbookXml(sheetName, rows) {
  const lines = rows
    .map((row) => {
      const cells = row
        .map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
<Author>DART Crawl Worker</Author>
<Created>${new Date().toISOString()}</Created>
</DocumentProperties>
<Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${lines}</Table></Worksheet>
</Workbook>`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


function formatDateYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function json(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
