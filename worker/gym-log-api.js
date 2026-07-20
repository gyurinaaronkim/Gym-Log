const DATA_PATH = "data/workouts.json";

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);

      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true }, 200, corsHeaders);
      }

      if (url.pathname === "/workouts" && request.method === "POST") {
        assertAuthorized(request, env);
        const payload = await request.json();
        const record = normalizeRecord(payload.record || payload);
        const result = await saveWorkout(env, record);
        return json(result, 200, corsHeaders);
      }

      return json({ error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      return json({ error: error.message || "Unexpected error" }, error.status || 500, corsHeaders);
    }
  },
};

function buildCorsHeaders(env) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-api-secret",
    "access-control-max-age": "86400",
    "content-type": "application/json; charset=utf-8",
  };
}

function assertAuthorized(request, env) {
  const provided = request.headers.get("x-api-secret");
  if (!env.API_SECRET || provided !== env.API_SECRET) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") {
    throw badRequest("record is required");
  }
  if (!record.date || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    throw badRequest("record.date must be YYYY-MM-DD");
  }
  if (!Array.isArray(record.exercises)) {
    throw badRequest("record.exercises must be an array");
  }

  return {
    id: record.id || `workout-${record.date}-${crypto.randomUUID()}`,
    date: record.date,
    durationMinutes: Number(record.durationMinutes || 0),
    focus: cleanText(record.focus || "운동"),
    summary: cleanText(record.summary || ""),
    exercises: record.exercises.map(normalizeExercise),
    cardio: Array.isArray(record.cardio) ? record.cardio.map(normalizeCardio) : [],
    coachNotes: Array.isArray(record.coachNotes) ? record.coachNotes.map(cleanText).filter(Boolean) : [],
    notes: cleanText(record.notes || ""),
    savedAt: new Date().toISOString(),
  };
}

function normalizeExercise(exercise) {
  if (!exercise || !exercise.name) throw badRequest("exercise.name is required");
  return {
    name: cleanText(exercise.name),
    weightKg: Number(exercise.weightKg || 0),
    reps: Number(exercise.reps || 0),
    sets: Number(exercise.sets || 0),
    notes: cleanText(exercise.notes || ""),
  };
}

function normalizeCardio(cardio) {
  return {
    name: cleanText(cardio.name || "유산소"),
    minutes: Number(cardio.minutes || 0),
    speedKmh: cardio.speedKmh === undefined ? null : Number(cardio.speedKmh),
    inclinePercent: cardio.inclinePercent === undefined ? null : Number(cardio.inclinePercent),
    notes: cleanText(cardio.notes || ""),
  };
}

async function saveWorkout(env, record) {
  const existing = await readGithubFile(env, DATA_PATH);
  const workouts = existing.content ? JSON.parse(existing.content) : [];
  if (!Array.isArray(workouts)) throw new Error(`${DATA_PATH} must contain an array`);

  const nextWorkouts = upsertWorkout(workouts, record);
  const content = `${JSON.stringify(nextWorkouts, null, 2)}\n`;
  const putResult = await writeGithubFile(env, {
    path: DATA_PATH,
    content,
    sha: existing.sha,
    message: `Save workout ${record.date}`,
  });

  return {
    ok: true,
    id: record.id,
    date: record.date,
    commit: putResult.commit?.sha || null,
  };
}

function upsertWorkout(workouts, record) {
  const index = workouts.findIndex((workout) => workout.id === record.id);
  const next = [...workouts];

  if (index >= 0) {
    next[index] = record;
  } else {
    next.push(record);
  }

  return next.sort((a, b) => a.date.localeCompare(b.date));
}

async function readGithubFile(env, path) {
  const response = await githubFetch(env, `/contents/${path}?ref=${encodeURIComponent(env.GITHUB_BRANCH || "main")}`);

  if (response.status === 404) {
    return { sha: null, content: null };
  }

  if (!response.ok) {
    throw new Error(`GitHub read failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    sha: data.sha,
    content: decodeBase64(data.content || ""),
  };
}

async function writeGithubFile(env, { path, content, sha, message }) {
  const body = {
    message,
    content: encodeBase64(content),
    branch: env.GITHUB_BRANCH || "main",
  };

  if (sha) body.sha = sha;

  const response = await githubFetch(env, `/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub write failed: ${response.status} ${detail}`);
  }

  return response.json();
}

function githubFetch(env, path, options = {}) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  if (!owner || !repo) throw new Error("GITHUB_OWNER and GITHUB_REPO are required");

  return fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "content-type": "application/json",
      "user-agent": "gym-log-worker",
      "x-github-api-version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function cleanText(value) {
  return String(value || "").trim();
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
