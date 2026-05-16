const recordsKey = "lumen-drift-records";
const els = {
  report: document.querySelector("#report-list"),
  score: document.querySelector("#score-value"),
  route: document.querySelector("#route-value"),
  shards: document.querySelector("#shards-value"),
  gates: document.querySelector("#gates-value"),
  grazes: document.querySelector("#grazes-value"),
  breaks: document.querySelector("#breaks-value"),
  copy: document.querySelector("#copy-button")
};

let lastRender = "";

renderReport();

const observer = new MutationObserver(renderReport);
observer.observe(document.querySelector(".shell"), {
  attributes: true,
  childList: true,
  characterData: true,
  subtree: true
});
window.addEventListener("storage", renderReport);

function renderReport() {
  const record = readLatestRecord();
  const exactRows = isCurrentFinalRecord(record)
    ? record.scoreBreakdown.rows.filter((row) => row.value > 0)
    : [];
  const rows =
    exactRows.length > 0
      ? [
          { label: "Total", value: record.score, total: true },
          ...exactRows
        ]
      : createLiveRows();
  const nextRender = JSON.stringify(rows);

  if (nextRender === lastRender) {
    return;
  }

  els.report.innerHTML = rows
    .map((row) =>
      [
        `<li${row.total ? ' class="report-total"' : ""}>`,
        `<span>${row.label}</span>`,
        `<strong>${formatValue(row.value)}</strong>`,
        "</li>"
      ].join("")
    )
    .join("");
  lastRender = nextRender;
}

function createLiveRows() {
  return [
    { label: "Score", value: els.score.textContent },
    { label: "Shards", value: els.shards.textContent },
    { label: "Gates", value: els.gates.textContent },
    { label: "Grazes", value: els.grazes.textContent },
    { label: "Breaks", value: els.breaks.textContent }
  ];
}

function isCurrentFinalRecord(record) {
  return (
    record?.scoreBreakdown?.rows &&
    !els.copy.disabled &&
    record.routeCode === els.route.textContent &&
    Number(record.score) === parseDisplayNumber(els.score.textContent)
  );
}

function readLatestRecord() {
  try {
    const records = JSON.parse(localStorage.getItem(recordsKey) ?? "[]");
    return Array.isArray(records) ? records[0] : null;
  } catch {
    return null;
  }
}

function parseDisplayNumber(value) {
  return Number(String(value).replaceAll(",", "")) || 0;
}

function formatValue(value) {
  return Number.isFinite(Number(value))
    ? new Intl.NumberFormat("en-US").format(Number(value))
    : value;
}
