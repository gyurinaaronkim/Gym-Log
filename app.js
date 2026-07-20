const state = {
  workouts: [],
  sort: "desc",
};

const numberFormat = new Intl.NumberFormat("ko-KR");
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

async function loadWorkouts() {
  try {
    const response = await fetch(`./data/workouts.json?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("workout data unavailable");
    state.workouts = await response.json();
  } catch (error) {
    state.workouts = [];
  }
  render();
}

function render() {
  const workouts = [...state.workouts].sort((a, b) => {
    return state.sort === "desc"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date);
  });

  renderHero(workouts);
  renderMetrics(workouts);
  renderWorkoutList(workouts);
  renderCoachNotes(workouts);
  renderRecords(workouts);
  renderCalendar(workouts);
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

  const date = dateFormat.format(new Date(`${latest.date}T00:00:00`));
  title.textContent = `${date} 운동 완료`;
  text.textContent = latest.summary || latest.notes || "최근 운동 기록이 저장되어 있어.";
}

function renderMetrics(workouts) {
  const weekCount = workouts.filter(isThisWeek).length;
  const latest = workouts[0];

  setText("#weekCount", `${weekCount}회`);
  setText("#lastVolume", `${numberFormat.format(calculateVolume(latest))} kg`);
  setText("#streak", `${calculateStreak(workouts)}일`);
  setText("#totalWorkouts", `${workouts.length}회`);
}

function renderWorkoutList(workouts) {
  const container = document.querySelector("#workoutList");
  container.innerHTML = "";

  if (!workouts.length) {
    container.innerHTML = `<p class="muted">저장된 운동 기록이 아직 없어.</p>`;
    return;
  }

  for (const workout of workouts.slice(0, 8)) {
    const article = document.createElement("article");
    article.className = "workout-card";
    const volume = calculateVolume(workout);
    const exercises = (workout.exercises || [])
      .map((exercise) => {
        const sets = exercise.sets ? `${exercise.sets}세트` : "";
        const reps = exercise.reps ? `${exercise.reps}회` : "";
        const weight = exercise.weightKg ? `${exercise.weightKg}kg` : "맨몸";
        return `
          <div class="exercise">
            <strong>${escapeHtml(exercise.name)}</strong>
            <span>${[weight, reps, sets].filter(Boolean).join(" · ")}</span>
          </div>
        `;
      })
      .join("");

    article.innerHTML = `
      <header>
        <div>
          <h3>${dateFormat.format(new Date(`${workout.date}T00:00:00`))}</h3>
          <p class="muted">${escapeHtml(workout.durationMinutes || 60)}분 · ${escapeHtml(workout.focus || "전신")}</p>
        </div>
        <span class="pill">${numberFormat.format(volume)} kg</span>
      </header>
      <div class="exercise-grid">${exercises}</div>
      ${workout.notes ? `<p class="muted">${escapeHtml(workout.notes)}</p>` : ""}
    `;
    container.append(article);
  }
}

function renderCoachNotes(workouts) {
  const notes = workouts
    .flatMap((workout) => workout.coachNotes || [])
    .slice(0, 6);
  const container = document.querySelector("#coachNotes");

  if (!notes.length) {
    container.innerHTML = `<p class="muted">주의사항이 쌓이면 여기에 보여줄게.</p>`;
    return;
  }

  container.innerHTML = notes
    .map((note) => `<div class="note">${escapeHtml(note)}</div>`)
    .join("");
}

function renderRecords(workouts) {
  const records = new Map();

  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      if (!exercise.weightKg) continue;
      const current = records.get(exercise.name);
      if (!current || exercise.weightKg > current.weightKg) {
        records.set(exercise.name, {
          name: exercise.name,
          weightKg: exercise.weightKg,
          date: workout.date,
        });
      }
    }
  }

  const rows = [...records.values()]
    .sort((a, b) => b.weightKg - a.weightKg)
    .slice(0, 8);
  const container = document.querySelector("#records");

  if (!rows.length) {
    container.innerHTML = `<p class="muted">중량 기록이 아직 없어.</p>`;
    return;
  }

  container.innerHTML = rows
    .map((record) => `
      <div class="record">
        <span>${escapeHtml(record.name)}</span>
        <strong>${record.weightKg} kg</strong>
      </div>
    `)
    .join("");
}

function renderCalendar(workouts) {
  const doneDates = new Set(workouts.map((workout) => workout.date));
  const container = document.querySelector("#calendar");
  const today = new Date();
  const days = [];

  for (let index = 27; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    days.push(`<span class="day ${doneDates.has(key) ? "done" : ""}" title="${key}"></span>`);
  }

  container.innerHTML = days.join("");
}

function calculateVolume(workout) {
  if (!workout) return 0;
  return (workout.exercises || []).reduce((total, exercise) => {
    const weight = Number(exercise.weightKg || 0);
    const reps = Number(exercise.reps || 0);
    const sets = Number(exercise.sets || 0);
    return total + weight * reps * sets;
  }, 0);
}

function calculateStreak(workouts) {
  const dates = new Set(workouts.map((workout) => workout.date));
  let streak = 0;
  const cursor = new Date();

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function isThisWeek(workout) {
  const now = new Date();
  const date = new Date(`${workout.date}T00:00:00`);
  const start = new Date(now);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
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

loadWorkouts();
