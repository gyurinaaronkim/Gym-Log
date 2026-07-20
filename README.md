# Gym Log

Personal workout log for GitHub Pages, with a Cloudflare Worker save API.

## What this does

- Shows workout history, recent coaching notes, weekly count, total volume, and personal records.
- Adds a workout calendar, automatic PR cards, exercise weight tracking, AI feedback, volume analysis, care history, and body goal progress.
- Opens ChatGPT-generated save links through `save.html`.
- Sends accepted records to a Cloudflare Worker.
- The Worker appends the record to `data/workouts.json` and commits it to this repository.

## GitHub Pages

In GitHub:

1. Open `Settings`.
2. Open `Pages`.
3. Select `Deploy from a branch`.
4. Select branch `main`.
5. Select folder `/`.
6. Save.

Your page will be:

```text
https://gyurinaaronkim.github.io/Gym-Log/
```

## Cloudflare Worker

You already created the Worker and registered these variables:

| Name | Type | Value |
|---|---|---|
| `GITHUB_TOKEN` | Secret | GitHub fine-grained token |
| `API_SECRET` | Secret | Long random save key |
| `GITHUB_OWNER` | Text | `gyurinaaronkim` |
| `GITHUB_REPO` | Text | `Gym-Log` |
| `GITHUB_BRANCH` | Text | `main` |
| `ALLOWED_ORIGIN` | Text | `https://gyurinaaronkim.github.io` |

Paste the contents of `worker/gym-log-api.js` into the Worker editor and deploy.

## First-time save page setup

Open:

```text
https://gyurinaaronkim.github.io/Gym-Log/save.html
```

Enter:

- Worker URL: your Cloudflare Worker URL
- Save key: the same value as `API_SECRET`

Then press `Save settings`. The values are stored only in your browser.

## ChatGPT workflow

After a workout, tell ChatGPT:

```text
오늘 운동 완료

레그프레스 60kg 12회 x 3세트
...
```

ChatGPT can give you a save link in this format:

```text
https://gyurinaaronkim.github.io/Gym-Log/save.html#data=BASE64URL_JSON
```

Open the link, check the preview, and press `Save to GitHub`.
