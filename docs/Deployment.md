# Deploying to Railway

This guide covers deploying Squarehead to [Railway](https://railway.com). The app runs as one service: a Docker image that builds the React frontend and serves it together with the PHP API. Railway provides the URL, port, and (optionally) a MySQL database.

---

## Prerequisites

- A [Railway](https://railway.app) account (GitHub login is fine).
- This repository connected to GitHub (or another Git host Railway supports).

---

## 1. Create a Railway project and deploy from repo

1. Go to **[railway.app](https://railway.app)** and sign in.
2. Click **New Project**.
3. Choose **Deploy from GitHub repo** (or **Deploy from GitHub** and select the repo).
4. Select the **squarehead** repository and the branch you want to deploy (e.g. `main`).
5. Railway will create a **service** and start a build using the **Dockerfile** in the repo root. No need to choose a different builder—Railway detects the Dockerfile.
6. Wait for the first build to finish. The app will not work correctly until you add a database and set variables (steps 2 and 3).

---

## 2. Add a MySQL database (Railway MySQL plugin)

1. In your **Railway project**, click **+ New**.
2. Select **Database** → **MySQL**.
3. Railway adds a new **MySQL service** and assigns it a private URL and credentials.
4. Click the **MySQL service** and open the **Variables** (or **Connect**) tab. You will see variables such as:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`
5. You will **reference** these from your app service in the next step so the app can connect to this database.

---

## 3. Configure your app service (Variables)

1. In the same project, click your **app service** (the one that deploys from the repo).
2. Open **Variables** (or **Settings** → **Variables**).
3. **Reference the MySQL variables** so the app receives them at runtime:
   - Click **+ New Variable** or **Add variable reference**.
   - Railway lets you reference another service's variables, e.g. from the MySQL service. Add references so your app gets:
     - `MYSQLHOST` → from MySQL service  
     - `MYSQLPORT` → from MySQL service  
     - `MYSQLUSER` → from MySQL service  
     - `MYSQLPASSWORD` → from MySQL service  
     - `MYSQLDATABASE` → from MySQL service  
   - (Exact UI may be "Reference variable" and then choosing the MySQL service and variable name. The app code maps these to `DB_*` internally when `DB_HOST` is not set.)
4. **Add required app variables** (these are not provided by Railway; you set them yourself):

   | Variable      | Value |
   |---------------|--------|
   | `JWT_SECRET`  | A long random string (e.g. generate with `openssl rand -hex 32`) |
   | `APP_ENV`     | `production` |
   | `APP_DEBUG`   | `false` |
   | `APP_URL`     | Your app's public URL, e.g. `https://your-app-name.up.railway.app` (see **Settings** → **Networking** / **Generate domain** on the app service) |

5. **Optional – email (e.g. for login links):**  
   If you use SMTP, add: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_FROM_NAME`.

**Note:** Railway sets `PORT` automatically. Do **not** set `PORT` yourself.

---

## 4. Apply the database schema (one-time)

Railway's MySQL is empty until you run the schema.

1. Get the **MySQL connection details** from the Railway MySQL service (Variables or "Connect" tab). You can use the **MySQL URL** or host, port, user, password, and database name.
2. From your machine (or any MySQL client), connect to that database and run the SQL in **`backend/database/schema.sql`** (import the file or paste its contents and execute).
3. After the import, the app can use the database. Redeploy or restart the app if it was already running.

---

## 5. Get your app URL and redeploy

1. In the **app service**, go to **Settings** → **Networking** (or **Deployments**).
2. Under **Public Networking**, click **Generate domain** (or use an existing one). Railway will give you a URL like `https://squarehead-production.up.railway.app`.
3. Set **`APP_URL`** in the app's Variables to this exact URL (including `https://`).
4. Trigger a **redeploy** so the new variable is used (e.g. **Deployments** → **Redeploy** or push a new commit).

After the deploy, open the generated URL in a browser. You should see the Squarehead app; the frontend talks to the API on the same origin (no extra CORS or API URL config needed).

---

## Environment variable reference

| Variable        | Who sets it | Description |
|-----------------|-------------|-------------|
| `PORT`          | **Railway** | Port the app must listen on. Do not override. |
| `MYSQLHOST`     | **Railway** (MySQL service) | MySQL host. Reference from MySQL service. |
| `MYSQLPORT`     | **Railway** (MySQL service) | MySQL port (usually 3306). |
| `MYSQLUSER`     | **Railway** (MySQL service) | MySQL user. |
| `MYSQLPASSWORD` | **Railway** (MySQL service) | MySQL password. |
| `MYSQLDATABASE` | **Railway** (MySQL service) | MySQL database name. |
| `JWT_SECRET`    | **You**      | Secret for JWT signing. Required in production. |
| `APP_ENV`       | **You**      | Set to `production` on Railway. |
| `APP_DEBUG`     | **You**      | Set to `false` on Railway. |
| `APP_URL`       | **You**      | Full app URL (e.g. `https://your-app.up.railway.app`). |

The app automatically uses `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, and `MYSQLPORT` from Railway when you reference the MySQL service variables; you do **not** need to set `DB_HOST`, `DB_USER`, etc. unless you are using a non-Railway database.

---

## Health checks

Railway is configured (via **`railway.json`** in the repo) to call **`/api/health`** to decide when a deployment is ready. The app exposes this endpoint; no extra setup is required.

---

## Troubleshooting

- **Build fails:** Check the **Build logs** in the Railway dashboard. Common causes: missing `package-lock.json` or Composer dependencies.
- **App won't start / 503:** Check **Deploy logs**. Ensure the app listens on `0.0.0.0:PORT` (the Dockerfile does this).
- **Database connection errors:** Confirm the app service has the MySQL variables (references) set and that you ran **`backend/database/schema.sql`** against the Railway MySQL database.
- **Login or emails don't work:** Set the `MAIL_*` variables and ensure `APP_URL` is correct so links in emails point to your Railway URL.
