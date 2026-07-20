const machineState = {
  filter: "all",
  workouts: [],
};

const machines = [
  {
    id: "leg-press",
    category: "legs",
    part: "하체",
    name: "레그프레스",
    target: "대퇴사두, 둔근, 햄스트링",
    appearance: "뒤로 기울어진 큰 의자와 정면의 넓은 발판이 있는 기구.",
    setup: ["등과 엉덩이를 패드에 붙인다.", "발은 어깨너비로 발판 중앙에 둔다.", "무릎과 발끝 방향을 맞춘다."],
    cues: ["무릎을 잠그지 않고 밀기.", "내릴 때 허리가 말리지 않게 하기.", "발바닥 전체로 발판을 민다."],
    caution: "무릎 통증이 있으면 가동범위를 줄이고 중량을 낮춘다.",
  },
  {
    id: "leg-curl",
    category: "legs",
    part: "하체",
    name: "레그컬",
    target: "햄스트링",
    appearance: "발목이나 정강이를 거는 원통형 패드가 있는 기구.",
    setup: ["기구 회전축과 무릎 관절축을 맞춘다.", "발목 패드는 발목 바로 위에 둔다.", "상체와 골반을 패드에 고정한다."],
    cues: ["발뒤꿈치를 엉덩이 쪽으로 천천히 당긴다.", "반동 없이 접고 편다.", "허리가 뜨지 않게 한다."],
    caution: "무릎 뒤 통증이나 두둑 소리가 반복되면 중단한다.",
  },
  {
    id: "chest-press",
    category: "chest",
    part: "가슴",
    name: "체스트프레스",
    target: "대흉근, 전면 삼각근, 삼두",
    appearance: "등받이 양옆에 가슴 높이 손잡이가 있는 앉아서 미는 기구.",
    setup: ["손잡이가 가슴 중간 높이에 오게 좌석을 맞춘다.", "견갑을 등받이에 붙인다.", "발은 바닥에 단단히 둔다."],
    cues: ["어깨를 으쓱하지 않는다.", "팔꿈치를 완전히 잠그지 않는다.", "손보다 가슴으로 민다는 느낌을 잡는다."],
    caution: "어깨 앞쪽 통증이 있으면 좌석 높이와 팔꿈치 각도를 낮춘다.",
  },
  {
    id: "lat-pulldown",
    category: "back",
    part: "등",
    name: "랫풀다운",
    target: "광배근, 대원근, 이두",
    appearance: "위쪽 케이블에 긴 바가 달리고 아래에 허벅지 고정 패드가 있는 기구.",
    setup: ["허벅지 패드로 몸을 고정한다.", "가슴을 살짝 들고 어깨를 귀에서 멀리 둔다.", "바는 어깨보다 약간 넓게 잡는다."],
    cues: ["먼저 어깨를 아래로 내린다.", "팔꿈치를 엉덩이 주머니 방향으로 당긴다.", "바는 윗가슴 쪽으로 내린다."],
    caution: "승모나 삼두 개입이 크면 중량을 낮추고 팔꿈치 경로를 다시 잡는다.",
  },
  {
    id: "seated-row",
    category: "back",
    part: "등",
    name: "시티드로우",
    target: "중부 등, 광배, 후면 삼각근",
    appearance: "낮은 좌석 정면에 케이블 손잡이와 발판이 있는 당기는 기구.",
    setup: ["가슴을 들고 허리를 중립으로 둔다.", "발판에 발을 안정적으로 둔다.", "어깨는 아래로 내린다."],
    cues: ["손잡이를 배꼽 쪽으로 당긴다.", "팔꿈치를 뒤로 보낸다.", "상체를 과하게 젖히지 않는다."],
    caution: "승모 개입이 크면 손잡이 위치를 낮추고 중량을 줄인다.",
  },
  {
    id: "shoulder-press",
    category: "shoulders",
    part: "어깨",
    name: "숄더프레스",
    target: "삼각근, 삼두",
    appearance: "수직 등받이와 머리 양옆 손잡이가 있는 위로 미는 기구.",
    setup: ["손잡이가 귀보다 약간 아래에 오게 좌석을 맞춘다.", "허리를 과하게 꺾지 않는다.", "양쪽 손잡이를 같은 높이에서 시작한다."],
    cues: ["오른쪽이 약하면 오른쪽 범위에 왼쪽을 맞춘다.", "목을 길게 두고 민다.", "반동 없이 천천히 내린다."],
    caution: "어깨 찝힘이 있으면 범위를 줄이고 그날은 제외한다.",
  },
  {
    id: "crunch",
    category: "core",
    part: "코어",
    name: "복근 머신 / 크런치",
    target: "복직근",
    appearance: "가슴이나 어깨 앞 패드를 잡고 상체를 숙이는 기구 또는 매트 운동.",
    setup: ["허리를 말아 복부가 먼저 수축되게 한다.", "목에 힘을 빼고 턱을 살짝 당긴다.", "발 고정은 편한 정도만 사용한다."],
    cues: ["상체를 접는 것보다 갈비뼈를 골반 쪽으로 당긴다.", "올라갈 때 숨을 내쉰다.", "천천히 돌아온다."],
    caution: "목이나 허리가 먼저 아프면 범위를 줄인다.",
  },
  {
    id: "treadmill",
    category: "cardio",
    part: "유산소",
    name: "러닝머신",
    target: "심폐, 하체 지구력",
    appearance: "움직이는 벨트와 속도/경사 조절 패널이 있는 기구.",
    setup: ["처음 5분은 속도 5.5~6.0으로 워밍업한다.", "어깨 힘을 빼고 시선은 정면.", "발소리가 너무 커지지 않게 착지한다."],
    cues: ["숨은 차지만 통제 가능한 강도로 유지한다.", "속도 9는 짧은 구간부터 늘린다.", "운동 후 갑자기 멈추지 말고 2~3분 낮춘다."],
    caution: "어지럼이나 메스꺼움이 오면 즉시 속도를 낮추고 중단한다.",
  },
];

async function loadMachineData() {
  machineState.workouts = await fetchJson("./data/workouts.json");
  if (!Array.isArray(machineState.workouts)) machineState.workouts = [];
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
  const visible = machines.filter((machine) => {
    return machineState.filter === "all" || machine.category === machineState.filter;
  });

  document.querySelector("#machineGrid").innerHTML = visible.map((machine) => {
    const record = records.get(machine.name);
    return `
      <article class="machine-card">
        <header>
          <div>
            <span class="chip">${machine.part}</span>
            <h2>${machine.name}</h2>
          </div>
          <strong>${record ? `${record.weightKg} kg` : "기록 대기"}</strong>
        </header>
        <p class="target">${machine.target}</p>
        <div class="machine-section">
          <h3>생김새</h3>
          <p>${machine.appearance}</p>
        </div>
        <div class="machine-section">
          <h3>세팅</h3>
          <ul>${machine.setup.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
        <div class="machine-section">
          <h3>사용 팁</h3>
          <ul>${machine.cues.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
        <p class="machine-caution">${machine.caution}</p>
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
      const current = records.get(exercise.name);
      if (!current || weight > current.weightKg) {
        records.set(exercise.name, {
          weightKg: weight,
          date: workout.date,
        });
      }
    }
  }

  return records;
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
