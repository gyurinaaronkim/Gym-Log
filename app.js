const state = {
  workouts: [],
  body: [],
  sort: "desc",
  selectedExercise: "",
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

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
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

document.querySelector("#sortSelect").addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

document.querySelector("#exerciseSelect").addEventListener("change", (event) => {
  state.selectedExercise = event.target.value;
  renderExerciseTrend();
});

loadData();
