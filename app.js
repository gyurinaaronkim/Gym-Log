const state = {
  workouts: [],
  body: [],
  sort: "desc",
  selectedExercise: "",
  generatedRoutine: null,
};

const FAT_LOSS_GOAL_KG = 8;
const numberFormat = new Intl.NumberFormat("ko-KR");
const compactFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
});
const monthFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
});

async function loadData() {
  const [workouts, body] = await Promise.all([
    fetchJson("./data/workouts.json"),
    fetchJson("./data/body.json"),
  ]);

  state.workouts = Array.isArray(workouts) ? workouts : [];
  state.body = Array.isArray(body) ? body : [];
  render();
}

async function fetchJson(path) {
  try {
    const response = await fetch(`${path}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} unavailable`);
    return response.json();
  } catch (error) {
    return [];
  }
}

function render() {
  const workouts = getSortedWorkouts();
  const records = getRecords(state.workouts);
  const volumes = getWorkoutVolumes(state.workouts);

  renderHero(workouts);
  renderBodyGoal();
  renderMetrics(workouts, records, volumes);
  renderCalendar(state.workouts);
  renderCoachNotes(workouts);
  renderExerciseSelect();
  renderExerciseTrend();
  renderVolumeChart(volumes);
  renderRecords(records);
  renderPainHistory(workouts);
  renderWorkoutList(workouts);
  renderRoutineBasis(workouts);
}

function getSortedWorkouts() {
  return [...state.workouts].sort((a, b) => {
    return state.sort === "desc"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date);
  });
}

function renderHero(workouts) {
  const latest = workouts[0];
  const title = document.querySelector("#heroTitle");
  const text = document.querySelector("#heroText");

  if (!latest) {
    title.textContent = "첫 운동 기록을 기다리는 중";
    text.textContent = "운동을 마치면 저장 링크로 기록을 추가할 수 있어.";
    return;
  }

  const date = dateFormat.format(parseDate(latest.date));
  const nextCare = getCareItems(workouts)[0]?.text;
  title.textContent = `${date} 운동 완료`;
  text.textContent = nextCare
    ? `${latest.summary || "최근 운동이 저장됐어"} 다음 운동 전에는 "${nextCare}"를 먼저 확인하자.`
    : latest.summary || "최근 운동 기록이 저장되어 있어.";
}

function renderBodyGoal() {
  const sorted = [...state.body].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];

  if (!latest) return;

  setText("#currentWeight", `${compactFormat.format(latest.weightKg)} kg`);
  setText("#muscleMass", compactFormat.format(latest.skeletalMuscleKg));
  setText("#bodyFat", compactFormat.format(latest.bodyFatPercent));

  const firstFatMass = getFatMass(first);
  const latestFatMass = getFatMass(latest);
  const lostFat = Math.max(0, firstFatMass - latestFatMass);
  const progress = Math.min(100, Math.round((lostFat / FAT_LOSS_GOAL_KG) * 100));
  const remaining = Math.max(0, FAT_LOSS_GOAL_KG - lostFat);

  setText("#goalPercent", `${progress}%`);
  document.querySelector("#goalBar").style.width = `${progress}%`;
  setText("#goalText", `목표까지 체지방 약 ${compactFormat.format(remaining)} kg 남음`);
}

function renderMetrics(workouts, records, volumes) {
  const weekWorkouts = state.workouts.filter(isThisWeek);
  const weekVolume = weekWorkouts.reduce((sum, workout) => sum + calculateVolume(workout), 0);
  const latestVolume = volumes.at(-1)?.volume || 0;
  const previousVolume = volumes.at(-2)?.volume || 0;
  const delta = previousVolume ? Math.round(((latestVolume - previousVolume) / previousVolume) * 100) : 0;

  setText("#weekCount", `${weekWorkouts.length}회`);
  setText("#weekVolume", `${numberFormat.format(weekVolume)} kg`);
  setText("#streak", `${calculateStreak(state.workouts)}일`);
  setText("#recordCount", `${records.length}개`);
  setText("#weekHint", weekWorkouts.length >= 3 ? "좋은 페이스" : "이번 주 3회가 1차 목표");
  setText("#volumeHint", previousVolume ? `직전 대비 ${delta >= 0 ? "+" : ""}${delta}%` : "기록이 쌓이면 비교돼");
}

function renderCalendar(workouts) {
  const doneDates = new Set(workouts.map((workout) => workout.date));
  const container = document.querySelector("#calendarGrid");
  const today = new Date();
  const cells = [];

  setText("#monthLabel", monthFormat.format(today));

  for (let index = 34; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const key = toDateKey(date);
    const workout = workouts.find((item) => item.date === key);
    cells.push(`
      <span class="day-cell ${doneDates.has(key) ? "done" : ""}" title="${key}">
        <small>${date.getDate()}</small>
        ${workout ? `<b>${(workout.exercises || []).length}</b>` : ""}
      </span>
    `);
  }

  container.innerHTML = cells.join("");
}

function renderCoachNotes(workouts) {
  const notes = workouts
    .flatMap((workout) => (workout.coachNotes || []).map((note) => ({
      date: workout.date,
      text: note,
    })))
    .slice(0, 7);
  const container = document.querySelector("#coachNotes");

  if (!notes.length) {
    container.innerHTML = `<p class="empty">AI 피드백이 쌓이면 여기에 보여줄게.</p>`;
    return;
  }

  container.innerHTML = notes.map((note) => `
    <article class="timeline-item">
      <time>${shortDate(note.date)}</time>
      <p>${escapeHtml(note.text)}</p>
    </article>
  `).join("");
}

function renderExerciseSelect() {
  const select = document.querySelector("#exerciseSelect");
  const exercises = [...new Set(state.workouts.flatMap((workout) => (
    workout.exercises || []
  ).map((exercise) => exercise.name)))].sort((a, b) => a.localeCompare(b, "ko"));

  if (!state.selectedExercise || !exercises.includes(state.selectedExercise)) {
    state.selectedExercise = exercises[0] || "";
  }

  select.innerHTML = exercises
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  select.value = state.selectedExercise;
}

function renderExerciseTrend() {
  const container = document.querySelector("#exerciseTrend");
  const name = state.selectedExercise;

  if (!name) {
    container.innerHTML = `<p class="empty">운동 기록이 생기면 머신별 변화가 표시돼.</p>`;
    return;
  }

  const rows = state.workouts
    .filter((workout) => (workout.exercises || []).some((exercise) => exercise.name === name))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((workout) => {
      const matches = workout.exercises.filter((exercise) => exercise.name === name);
      const best = matches.reduce((max, exercise) => Math.max(max, Number(exercise.weightKg || 0)), 0);
      const volume = matches.reduce((sum, exercise) => {
        return sum + Number(exercise.weightKg || 0) * Number(exercise.reps || 0) * Number(exercise.sets || 0);
      }, 0);
      return { date: workout.date, best, volume };
    });

  const maxWeight = Math.max(...rows.map((row) => row.best), 1);
  const latest = rows.at(-1);
  const first = rows[0];
  const change = latest && first ? latest.best - first.best : 0;

  container.innerHTML = `
    <div class="tracker-summary">
      <div><span>현재 최고</span><strong>${latest?.best || 0} kg</strong></div>
      <div><span>변화</span><strong>${change >= 0 ? "+" : ""}${change} kg</strong></div>
      <div><span>최근 볼륨</span><strong>${numberFormat.format(latest?.volume || 0)} kg</strong></div>
    </div>
    <div class="trend-bars">
      ${rows.map((row) => `
        <div class="trend-row">
          <time>${shortDate(row.date)}</time>
          <span class="trend-track"><b style="width:${Math.max(8, (row.best / maxWeight) * 100)}%"></b></span>
          <strong>${row.best} kg</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderVolumeChart(volumes) {
  const container = document.querySelector("#volumeChart");
  const latest = volumes.slice(-8);

  if (!latest.length) {
    container.innerHTML = `<p class="empty">운동량 기록이 아직 없어.</p>`;
    return;
  }

  const maxVolume = Math.max(...latest.map((item) => item.volume), 1);
  container.innerHTML = latest.map((item) => `
    <div class="bar-row">
      <time>${shortDate(item.date)}</time>
      <span class="bar-track"><b style="width:${Math.max(6, (item.volume / maxVolume) * 100)}%"></b></span>
      <strong>${numberFormat.format(item.volume)}</strong>
    </div>
  `).join("");
}

function renderRecords(records) {
  const container = document.querySelector("#recordsList");

  if (!records.length) {
    container.innerHTML = `<p class="empty">중량 기록이 아직 없어.</p>`;
    return;
  }

  container.innerHTML = records.slice(0, 8).map((record) => `
    <article class="record-card">
      <span>${escapeHtml(record.name)}</span>
      <strong>${record.weightKg} kg</strong>
      <small>${shortDate(record.date)} · ${record.reps || "-"}회 x ${record.sets || "-"}세트</small>
    </article>
  `).join("");
}

function renderPainHistory(workouts) {
  const items = getCareItems(workouts).slice(0, 8);
  const container = document.querySelector("#painHistory");

  if (!items.length) {
    container.innerHTML = `<p class="empty">통증이나 주의 이력이 기록되면 여기에 모아둘게.</p>`;
    return;
  }

  container.innerHTML = items.map((item) => `
    <article class="care-item">
      <span>${shortDate(item.date)}</span>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("");
}

function renderWorkoutList(workouts) {
  const container = document.querySelector("#workoutList");

  if (!workouts.length) {
    container.innerHTML = `<p class="empty">저장된 운동 기록이 아직 없어.</p>`;
    return;
  }

  container.innerHTML = workouts.slice(0, 10).map((workout) => {
    const volume = calculateVolume(workout);
    const exercises = (workout.exercises || []).map((exercise) => {
      const weight = exercise.weightKg ? `${exercise.weightKg}kg` : "맨몸";
      const detail = [weight, exercise.reps ? `${exercise.reps}회` : "", exercise.sets ? `${exercise.sets}세트` : ""]
        .filter(Boolean)
        .join(" · ");
      return `
        <div class="exercise">
          <strong>${escapeHtml(exercise.name)}</strong>
          <span>${detail}</span>
          ${exercise.notes ? `<small>${escapeHtml(exercise.notes)}</small>` : ""}
        </div>
      `;
    }).join("");

    return `
      <article class="workout-card">
        <header>
          <div>
            <h3>${dateFormat.format(parseDate(workout.date))}</h3>
            <p>${escapeHtml(workout.focus || "운동")} · ${workout.durationMinutes || 60}분</p>
          </div>
          <span class="chip">${numberFormat.format(volume)} kg</span>
        </header>
        <div class="exercise-grid">${exercises}</div>
        ${workout.summary ? `<p class="summary">${escapeHtml(workout.summary)}</p>` : ""}
      </article>
    `;
  }).join("");
}

function renderRoutineBasis(workouts) {
  const latest = workouts[0];
  const body = getLatestBodyRecord();
  const label = latest && body
    ? `${shortDate(latest.date)} 운동 · ${shortDate(body.date)} 인바디`
    : "기록 기반";
  setText("#routineBasis", label);
}

function generatePersonalRoutine() {
  const workouts = getSortedWorkouts();
  const body = getLatestBodyRecord();
  const records = getRecords(state.workouts);
  const careItems = getCareItems(workouts);
  const latest = workouts[0];
  const container = document.querySelector("#routineOutput");

  if (!container) return;

  container.innerHTML = `<p class="empty">최근 기록을 확인해서 루틴을 만드는 중이야...</p>`;

  const plan = buildRoutinePlan({ workouts, body, records, careItems });
  state.generatedRoutine = plan;

  if (!plan) {
    container.innerHTML = `<p class="empty">운동 기록을 아직 불러오지 못했어. 페이지를 새로고침한 뒤 다시 눌러줘.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="routine-summary">
      <article>
        <span>추천 방향</span>
        <strong>${escapeHtml(plan.focus)}</strong>
        <small>${escapeHtml(plan.reason)}</small>
      </article>
      <article>
        <span>예상 시간</span>
        <strong>${plan.durationMinutes}분</strong>
        <small>워밍업과 마무리 포함</small>
      </article>
      <article>
        <span>강도</span>
        <strong>${escapeHtml(plan.intensity)}</strong>
        <small>실패지점까지 가지 않기</small>
      </article>
    </div>
    <div class="routine-block">
      <h3>워밍업</h3>
      <div class="routine-card">
        <strong>러닝머신</strong>
        <span>속도 5.5~6.0 km/h · 5~7분</span>
        <small>어깨 돌리기, 맨몸 스쿼트 10회씩 추가</small>
      </div>
    </div>
    <div class="routine-block">
      <h3>근력 운동</h3>
      <div class="routine-exercises">
        ${plan.exercises.map((exercise) => `
          <article class="routine-card ${exercise.caution ? "caution" : ""}">
            <strong>${escapeHtml(exercise.name)}</strong>
            <span>${exercise.weightKg ? `${exercise.weightKg}kg` : "맨몸"} · ${exercise.reps}회 x ${exercise.sets}세트</span>
            <small>${escapeHtml(exercise.note)}</small>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="routine-block">
      <h3>유산소</h3>
      <div class="routine-card">
        <strong>${escapeHtml(plan.cardio.name)}</strong>
        <span>${escapeHtml(plan.cardio.detail)}</span>
        <small>${escapeHtml(plan.cardio.note)}</small>
      </div>
    </div>
    <div class="routine-notes">
      ${plan.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
      ${latest ? `<p>최근 기준: ${shortDate(latest.date)} ${escapeHtml(latest.focus || "운동")} 이후 루틴.</p>` : ""}
    </div>
  `;

  container.insertAdjacentHTML("beforeend", routineActionsMarkup());
}

function buildRoutinePlan({ workouts, body, records, careItems }) {
  if (!workouts.length) return null;

  const latest = workouts[0];
  const latestNames = new Set((latest.exercises || []).map((exercise) => exercise.name));
  const careText = careItems.map((item) => item.text).join(" ");
  const kneeConcern = careText.includes("무릎") || careText.includes("레그컬");
  const shoulderConcern = careText.includes("어깨") || careText.includes("숄더");
  const bodyFatPercent = Number(body?.bodyFatPercent || 0);
  const fatLossMode = bodyFatPercent >= 20;
  const fullBodyStreak = workouts.slice(0, 3).filter((workout) => (workout.focus || "").includes("전신")).length;

  const focus = fullBodyStreak >= 2
    ? "상체 자세 교정 + 하체 가벼운 유지"
    : "전신 균형 루틴";
  const reason = fatLossMode
    ? "체지방 감량 목표가 있으므로 근력은 자세 중심, 유산소는 러닝 위주로 구성."
    : "최근 수행 부위와 PR을 기준으로 무리 없는 증량 후보만 반영.";

  const exercises = [
    {
      name: "레그프레스",
      weightKg: suggestWeight("레그프레스", records, 60, latestNames.has("레그프레스") ? 10 : 0, 70),
      reps: 12,
      sets: 3,
      note: "60kg를 반복 완료했으니 컨디션 좋으면 70kg 테스트. 무릎이 불편하면 60kg 유지.",
    },
    {
      name: "체스트프레스",
      weightKg: suggestWeight("체스트프레스", records, 20, 5, 25),
      reps: 10,
      sets: 3,
      note: "어깨 개입이 없을 때만 25kg. 어깨가 먼저 느껴지면 20kg로 자세 우선.",
    },
    {
      name: "랫풀다운",
      weightKg: suggestWeight("랫풀다운", records, 25, 0, 25),
      reps: 10,
      sets: 3,
      note: "손보다 팔꿈치로 당기기. 삼두나 승모가 강하면 중량 올리지 않기.",
    },
    {
      name: "시티드로우",
      weightKg: suggestWeight("시티드로우", records, 30, 0, 30),
      reps: 12,
      sets: 2,
      note: "최근 3세트까지 했으니 오늘은 2세트로 등 자극 확인 중심.",
    },
    {
      name: "숄더프레스",
      weightKg: suggestWeight("숄더프레스", records, 10, 0, 15),
      reps: 10,
      sets: 2,
      note: shoulderConcern
        ? "오른쪽 안정성이 기준. 흔들리면 10kg로 낮추기."
        : "15kg는 새 기준 후보. 좌우 속도가 같을 때만 유지.",
      caution: shoulderConcern,
    },
    {
      name: "레그컬",
      weightKg: kneeConcern ? 20 : suggestWeight("레그컬", records, 20, 0, 25),
      reps: 12,
      sets: 2,
      note: kneeConcern
        ? "무릎 뒤쪽 이력이 있으니 20kg 확인용. 통증이나 소리 반복 시 제외."
        : "무릎 뒤쪽 느낌이 깨끗할 때만 25kg까지.",
      caution: kneeConcern,
    },
    {
      name: "크런치",
      weightKg: 0,
      reps: 15,
      sets: 2,
      note: "목보다 복부를 말아 올리는 느낌으로 천천히.",
    },
  ];

  return {
    focus,
    reason,
    durationMinutes: 60,
    intensity: "RPE 7",
    exercises,
    cardio: {
      name: "러닝머신",
      detail: fatLossMode ? "속도 6.0~8.5 km/h · 12~15분" : "속도 6.0~8.0 km/h · 10~12분",
      note: "자전거보다 러닝 적응이 좋았으므로 러닝 중심. 메스꺼움이 오면 즉시 속도를 낮추기.",
    },
    notes: [
      "오늘 목표는 PR 욕심보다 자세 재현성 확인.",
      "레그컬과 숄더프레스는 통증/좌우 균형 체크 항목.",
      "모든 세트는 2회 정도 여유를 남기고 끝내기.",
    ],
  };
}

function routineActionsMarkup() {
  return `
    <div class="routine-actions">
      <button class="primary-button" id="completeRoutine" type="button">오늘 운동 완료</button>
      <a class="secondary-button" href="./save.html">저장 설정 확인</a>
      <p class="status" id="routineSaveStatus"></p>
    </div>
  `;
}

async function completeGeneratedRoutine() {
  const status = document.querySelector("#routineSaveStatus");
  const plan = state.generatedRoutine;

  if (!status) return;

  if (!plan) {
    status.textContent = "먼저 맞춤 루틴을 생성해줘.";
    return;
  }

  const workerUrl = localStorage.getItem("gymLogWorkerUrl");
  const apiSecret = localStorage.getItem("gymLogApiSecret");

  if (!workerUrl || !apiSecret) {
    status.textContent = "먼저 저장 설정을 해줘. save.html에서 Worker URL과 Save key를 저장하면 돼.";
    return;
  }

  const record = buildWorkoutRecordFromRoutine(plan);
  status.textContent = "오늘 운동 기록을 GitHub에 저장하는 중...";

  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/workouts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-secret": apiSecret,
      },
      body: JSON.stringify({ record }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(buildRoutineSaveError(response.status, result.error));

    mergeWorkoutIntoState(record);
    status.textContent = `저장 완료. Commit: ${result.commit || "created"}`;
  } catch (error) {
    status.textContent = explainRoutineSaveError(error);
  }
}

function buildWorkoutRecordFromRoutine(plan) {
  const date = todayKey();
  return {
    id: `workout-${date}`,
    date,
    durationMinutes: plan.durationMinutes || 60,
    focus: plan.focus || "맞춤 루틴",
    summary: `홈페이지 맞춤 루틴으로 운동 완료. ${plan.reason || ""}`.trim(),
    exercises: (plan.exercises || []).map((exercise) => ({
      name: exercise.name,
      weightKg: Number(exercise.weightKg || 0),
      reps: Number(exercise.reps || 0),
      sets: Number(exercise.sets || 0),
      notes: exercise.note || "",
    })),
    cardio: [
      {
        name: plan.cardio?.name || "러닝머신",
        minutes: 15,
        notes: plan.cardio?.detail || "맞춤 루틴 유산소",
      },
    ],
    coachNotes: [
      ...(plan.notes || []),
      "홈페이지 맞춤 루틴 생성 후 오늘 운동 완료 버튼으로 저장됨.",
    ],
    notes: "홈페이지 추천 루틴 완료 기록.",
  };
}

function mergeWorkoutIntoState(record) {
  const index = state.workouts.findIndex((workout) => workout.id === record.id || workout.date === record.date);
  if (index >= 0) {
    state.workouts[index] = record;
  } else {
    state.workouts.push(record);
  }
}

function buildRoutineSaveError(status, detail) {
  if (status === 401) return "Save key가 API_SECRET과 달라. 저장 설정을 다시 확인해줘.";
  if (status === 404) return "Worker에 /workouts 저장 API가 없어. Cloudflare Worker 코드가 최신인지 확인해줘.";
  return detail || "저장에 실패했어.";
}

function explainRoutineSaveError(error) {
  const message = error.message || String(error);
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Worker에 연결하지 못했어. Worker URL과 Cloudflare 배포 상태를 확인해줘.";
  }
  return message;
}

function suggestWeight(name, records, fallback, increment, cap) {
  const record = records.find((item) => item.name === name);
  const base = Number(record?.weightKg || fallback);
  return Math.min(base + increment, cap);
}

function getRecords(workouts) {
  const records = new Map();

  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      const weight = Number(exercise.weightKg || 0);
      if (!weight) continue;
      const current = records.get(exercise.name);
      if (!current || weight > current.weightKg) {
        records.set(exercise.name, {
          name: exercise.name,
          weightKg: weight,
          reps: exercise.reps,
          sets: exercise.sets,
          date: workout.date,
        });
      }
    }
  }

  return [...records.values()].sort((a, b) => b.weightKg - a.weightKg);
}

function getWorkoutVolumes(workouts) {
  return [...workouts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((workout) => ({
      date: workout.date,
      volume: calculateVolume(workout),
    }));
}

function getCareItems(workouts) {
  const keywords = ["통증", "무릎", "메스꺼움", "불편", "승모", "삼두", "어깨", "소리", "주의"];
  const items = [];

  for (const workout of workouts) {
    for (const note of workout.coachNotes || []) {
      if (keywords.some((keyword) => note.includes(keyword))) {
        items.push({ date: workout.date, text: note });
      }
    }
    if (workout.notes && keywords.some((keyword) => workout.notes.includes(keyword))) {
      items.push({ date: workout.date, text: workout.notes });
    }
    for (const exercise of workout.exercises || []) {
      if (exercise.notes && keywords.some((keyword) => exercise.notes.includes(keyword))) {
        items.push({ date: workout.date, text: `${exercise.name}: ${exercise.notes}` });
      }
    }
  }

  return items;
}

function calculateVolume(workout) {
  if (!workout) return 0;
  return (workout.exercises || []).reduce((total, exercise) => {
    return total
      + Number(exercise.weightKg || 0)
      * Number(exercise.reps || 0)
      * Number(exercise.sets || 0);
  }, 0);
}

function calculateStreak(workouts) {
  const dates = new Set(workouts.map((workout) => workout.date));
  let streak = 0;
  const cursor = new Date();

  while (dates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function isThisWeek(workout) {
  const now = new Date();
  const date = parseDate(workout.date);
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
}

function getFatMass(record) {
  if (!record) return 0;
  return Number(record.weightKg || 0) * Number(record.bodyFatPercent || 0) / 100;
}

function getLatestBodyRecord() {
  return [...state.body].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(value) {
  const date = parseDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
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

const sortSelect = document.querySelector("#sortSelect");
if (sortSelect) {
  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
}

const exerciseSelect = document.querySelector("#exerciseSelect");
if (exerciseSelect) {
  exerciseSelect.addEventListener("change", (event) => {
    state.selectedExercise = event.target.value;
    renderExerciseTrend();
  });
}

const generateRoutineButton = document.querySelector("#generateRoutine");
if (generateRoutineButton) {
  generateRoutineButton.addEventListener("click", generatePersonalRoutine);
}

const routineOutput = document.querySelector("#routineOutput");
if (routineOutput) {
  routineOutput.addEventListener("click", (event) => {
    if (event.target.closest("#completeRoutine")) {
      completeGeneratedRoutine();
    }
  });
}

loadData();
