const machineState = {
  filter: "all",
  workouts: [],
  machines: [],
};

async function loadMachineData() {
  const [workouts, machines] = await Promise.all([
    fetchJson("./data/workouts.json"),
    fetchJson("./data/machines.json"),
  ]);
  machineState.workouts = Array.isArray(workouts) ? workouts : [];
  machineState.machines = Array.isArray(machines) ? machines : [];
  renderMachines();
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

function renderMachines() {
  const records = getMachineRecords();
  const visible = machineState.machines.filter((machine) => {
    return machineState.filter === "all" || machine.category === machineState.filter;
  });

  const grid = document.querySelector("#machineGrid");
  if (!visible.length) {
    grid.innerHTML = `<p class="empty">머신 데이터베이스를 불러오지 못했어.</p>`;
    return;
  }

  grid.innerHTML = visible.map((machine) => {
    const record = records.get(normalizeName(machine.name));
    return `
      <article class="machine-card">
        <header>
          <div>
            <span class="chip">${escapeHtml(machine.part)}</span>
            <h2>${escapeHtml(machine.name)}</h2>
          </div>
          <strong>${record ? `${record.weightKg} kg` : "기록 대기"}</strong>
        </header>
        <p class="target">${escapeHtml(machine.target)}</p>
        <div class="machine-section">
          <h3>생김새</h3>
          <p>${escapeHtml(machine.appearance)}</p>
        </div>
        <div class="machine-section">
          <h3>세팅</h3>
          <ul>${(machine.setup || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div class="machine-section">
          <h3>사용 팁</h3>
          <ul>${(machine.cues || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <p class="machine-caution">${escapeHtml(machine.caution)}</p>
      </article>
    `;
  }).join("");
}

function getMachineRecords() {
  const records = new Map();

  for (const workout of machineState.workouts) {
    for (const exercise of workout.exercises || []) {
      const weight = Number(exercise.weightKg || 0);
      if (!weight) continue;
      const key = normalizeName(exercise.name);
      const current = records.get(key);
      if (!current || weight > current.weightKg) {
        records.set(key, {
          weightKg: weight,
          date: workout.date,
        });
      }
    }
  }

  return records;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    machineState.filter = button.dataset.filter;
    renderMachines();
  });
});

loadMachineData();
