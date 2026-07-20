const workerUrlInput = document.querySelector("#workerUrl");
const apiSecretInput = document.querySelector("#apiSecret");
const payloadInput = document.querySelector("#payloadInput");
const preview = document.querySelector("#preview");
const settingsStatus = document.querySelector("#settingsStatus");
const saveStatus = document.querySelector("#saveStatus");

const STORAGE_KEYS = {
  workerUrl: "gymLogWorkerUrl",
  apiSecret: "gymLogApiSecret",
};

function init() {
  workerUrlInput.value = localStorage.getItem(STORAGE_KEYS.workerUrl) || "";
  apiSecretInput.value = localStorage.getItem(STORAGE_KEYS.apiSecret) || "";
  const payload = readPayloadFromUrl();
  payloadInput.value = payload ? JSON.stringify(payload, null, 2) : examplePayload();
  renderPreview();
}

function readPayloadFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const encoded = hashParams.get("data") || queryParams.get("data");
  if (!encoded) return null;

  try {
    return JSON.parse(base64UrlDecode(encoded));
  } catch (error) {
    try {
      return JSON.parse(decodeURIComponent(encoded));
    } catch (innerError) {
      saveStatus.textContent = "링크 데이터를 읽지 못했어. JSON을 직접 붙여넣어줘.";
      return null;
    }
  }
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function examplePayload() {
  return JSON.stringify({
    id: `manual-${new Date().toISOString()}`,
    date: new Date().toISOString().slice(0, 10),
    durationMinutes: 60,
    focus: "전신",
    summary: "운동 기록 요약",
    exercises: [
      { name: "레그프레스", weightKg: 60, reps: 12, sets: 3 },
    ],
    cardio: [
      { name: "러닝머신", speedKmh: 6, minutes: 5, notes: "워밍업" },
    ],
    coachNotes: [
      "통증이 있으면 해당 운동은 즉시 중단.",
    ],
    notes: "운동 후 메모",
  }, null, 2);
}

function getPayload() {
  const value = payloadInput.value.trim();
  if (!value) throw new Error("저장할 JSON이 비어 있어.");
  const parsed = JSON.parse(value);
  if (!parsed.date) throw new Error("date 값이 필요해.");
  if (!Array.isArray(parsed.exercises)) throw new Error("exercises 배열이 필요해.");
  return parsed;
}

function renderPreview() {
  try {
    const payload = getPayload();
    const exercises = payload.exercises
      .map((exercise) => {
        const weight = exercise.weightKg ? `${exercise.weightKg}kg` : "맨몸";
        return `- ${exercise.name}: ${weight} ${exercise.reps || ""}회 x ${exercise.sets || ""}세트`;
      })
      .join("\n");

    preview.textContent = [
      `날짜: ${payload.date}`,
      `시간: ${payload.durationMinutes || "-"}분`,
      `초점: ${payload.focus || "-"}`,
      "",
      exercises,
      "",
      payload.summary || payload.notes || "",
    ].join("\n");
  } catch (error) {
    preview.textContent = "JSON을 확인하는 중이야.";
  }
}

async function saveWorkout() {
  saveStatus.textContent = "";
  const workerUrl = workerUrlInput.value.trim().replace(/\/$/, "");
  const apiSecret = apiSecretInput.value.trim();

  if (!workerUrl || !apiSecret) {
    saveStatus.textContent = "Worker URL과 Save key를 먼저 입력해줘.";
    return;
  }

  let payload;
  try {
    payload = getPayload();
  } catch (error) {
    saveStatus.textContent = error.message;
    return;
  }

  saveStatus.textContent = "GitHub에 저장하는 중...";

  try {
    const response = await fetch(`${workerUrl}/workouts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-secret": apiSecret,
      },
      body: JSON.stringify({ record: payload }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "저장에 실패했어.");
    saveStatus.textContent = `저장 완료. Commit: ${result.commit || "created"}`;
  } catch (error) {
    saveStatus.textContent = error.message;
  }
}

document.querySelector("#saveSettings").addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEYS.workerUrl, workerUrlInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.apiSecret, apiSecretInput.value.trim());
  settingsStatus.textContent = "저장 설정을 이 브라우저에 저장했어.";
});

document.querySelector("#clearSettings").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.workerUrl);
  localStorage.removeItem(STORAGE_KEYS.apiSecret);
  workerUrlInput.value = "";
  apiSecretInput.value = "";
  settingsStatus.textContent = "저장 설정을 지웠어.";
});

document.querySelector("#formatPayload").addEventListener("click", () => {
  try {
    payloadInput.value = JSON.stringify(getPayload(), null, 2);
    renderPreview();
    saveStatus.textContent = "JSON을 정리했어.";
  } catch (error) {
    saveStatus.textContent = error.message;
  }
});

document.querySelector("#saveWorkout").addEventListener("click", saveWorkout);
payloadInput.addEventListener("input", renderPreview);

init();
