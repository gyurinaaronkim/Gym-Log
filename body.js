const bodyState = {
  records: [],
};

const BODY_GOAL_FAT_LOSS_KG = 8;
const bodyNumber = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

async function loadBodyData() {
  bodyState.records = await fetchJson("./data/body.json");
  if (!Array.isArray(bodyState.records)) bodyState.records = [];
  document.querySelector("#date").value = new Date().toISOString().slice(0, 10);
  renderBodyPage();
}

async function fetchJson(path) {
  try {
    const response = await fetch(`${path}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("data unavailable");
    return response.json();
  } catch (error) {
    return [];
  }
}

function renderBodyPage() {
  const records = getSortedRecords();
  const first = records[0];
  const latest = records.at(-1);

  if (!latest) return;

  setText("#latestWeight", `${bodyNumber.format(latest.weightKg)} kg`);
  setText("#latestMuscle", `${bodyNumber.format(latest.skeletalMuscleKg)} kg`);
  setText("#latestFatPercent", `${bodyNumber.format(latest.bodyFatPercent)}%`);
  setText("#weightDelta", deltaText(latest.weightKg, first.weightKg, "kg"));
  setText("#muscleDelta", deltaText(latest.skeletalMuscleKg, first.skeletalMuscleKg, "kg"));
  setText("#fatDelta", deltaText(latest.bodyFatPercent, first.bodyFatPercent, "%"));

  const firstFat = getFatMass(first);
  const latestFat = getFatMass(latest);
  const lostFat = Math.max(0, firstFat - latestFat);
  const goalPercent = Math.min(100, Math.round((lostFat / BODY_GOAL_FAT_LOSS_KG) * 100));
  setText("#bodyGoalPercent", `${goalPercent}%`);
  setText("#bodyGoalText", `체지방 약 ${bodyNumber.format(Math.max(0, BODY_GOAL_FAT_LOSS_KG - lostFat))} kg 남음`);

  renderCharts(records);
  renderHistory(records);
}

function renderCharts(records) {
  const metrics = [
    { key: "weightKg", label: "체중", unit: "kg", color: "green" },
    { key: "skeletalMuscleKg", label: "골격근량", unit: "kg", color: "blue" },
    { key: "bodyFatPercent", label: "체지방률", unit: "%", color: "rose" },
    { key: "bodyFatMassKg", label: "체지방량", unit: "kg", color: "gold" },
  ];

  document.querySelector("#bodyCharts").innerHTML = metrics.map((metric) => {
    const values = records.map((record) => Number(record[metric.key] || 0));
    const max = Math.max(...values, 1);
    const min = Math.min(...values, max);
    const range = Math.max(max - min, 1);

    return `
      <article class="metric-chart">
        <header>
          <strong>${metric.label}</strong>
          <span>${bodyNumber.format(values.at(-1) || 0)} ${metric.unit}</span>
        </header>
        <div class="spark-bars ${metric.color}">
          ${records.map((record) => {
            const value = Number(record[metric.key] || 0);
            const height = 20 + ((value - min) / range) * 70;
            return `<span style="height:${height}%" title="${record.date}: ${bodyNumber.format(value)}${metric.unit}"></span>`;
          }).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderHistory(records) {
  document.querySelector("#bodyHistory").innerHTML = [...records].reverse().map((record) => `
    <article class="body-row">
      <time>${record.date}</time>
      <span>${bodyNumber.format(record.weightKg)} kg</span>
      <span>근육 ${bodyNumber.format(record.skeletalMuscleKg)} kg</span>
      <span>체지방 ${bodyNumber.format(record.bodyFatPercent)}%</span>
      <p>${escapeHtml(record.notes || "")}</p>
    </article>
  `).join("");
}

function getFormRecord() {
  const form = new FormData(document.querySelector("#bodyForm"));
  const heightCm = Number(form.get("heightCm") || 177);
  const weightKg = Number(form.get("weightKg"));
  const bodyFatPercent = Number(form.get("bodyFatPercent"));
  const bodyFatMassKg = Number(form.get("bodyFatMassKg")) || weightKg * bodyFatPercent / 100;

  if (!form.get("date")) throw new Error("측정일을 입력해줘.");
  if (!weightKg || !bodyFatPercent) throw new Error("체중과 체지방률을 입력해줘.");

  return {
    id: `body-${form.get("date")}`,
    date: form.get("date"),
    heightCm,
    weightKg,
    skeletalMuscleKg: Number(form.get("skeletalMuscleKg") || 0),
    bodyFatPercent,
    bodyFatMassKg: Math.round(bodyFatMassKg * 10) / 10,
    bmi: Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10,
    notes: String(form.get("notes") || "").trim(),
  };
}

async function saveBodyRecord(event) {
  event.preventDefault();
  const status = document.querySelector("#bodySaveStatus");
  const workerUrl = localStorage.getItem("gymLogWorkerUrl");
  const apiSecret = localStorage.getItem("gymLogApiSecret");

  if (!workerUrl || !apiSecret) {
    status.textContent = "먼저 save.html에서 Worker URL과 Save key를 저장해줘.";
    return;
  }

  let record;
  try {
    record = getFormRecord();
  } catch (error) {
    status.textContent = error.message;
    return;
  }

  status.textContent = "인바디 기록을 저장하는 중...";

  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/body`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-secret": apiSecret,
      },
      body: JSON.stringify({ record }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "저장에 실패했어.");
    status.textContent = "저장 완료. 잠시 뒤 새로고침하면 반영돼.";
  } catch (error) {
    status.textContent = error.message;
  }
}

function getSortedRecords() {
  return [...bodyState.records].sort((a, b) => a.date.localeCompare(b.date));
}

function getFatMass(record) {
  return Number(record.bodyFatMassKg || (record.weightKg * record.bodyFatPercent / 100) || 0);
}

function deltaText(current, start, unit) {
  const delta = Number(current || 0) - Number(start || 0);
  return `${delta >= 0 ? "+" : ""}${bodyNumber.format(delta)} ${unit} from start`;
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelector("#bodyForm").addEventListener("submit", saveBodyRecord);
document.querySelector("#fillFromForm").addEventListener("click", () => {
  const status = document.querySelector("#bodySaveStatus");
  try {
    const record = getFormRecord();
    status.textContent = `미리보기: ${record.date} / ${record.weightKg}kg / 근육 ${record.skeletalMuscleKg}kg / 체지방률 ${record.bodyFatPercent}%`;
  } catch (error) {
    status.textContent = error.message;
  }
});

loadBodyData();
