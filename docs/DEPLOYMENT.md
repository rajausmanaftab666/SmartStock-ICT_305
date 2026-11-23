# Deploying SmartStock to staging

Follow this top to bottom. Every value you need to paste is given in a code block.

**Time:** about 30 minutes, most of it waiting for the first build.
**Cost:** nothing. Render's free web service and Supabase's free database are enough.

---

## What you are building

Two services, nothing else:

```
                 ┌─────────────────────────────┐
  browser  ───►  │  Render web service         │
                 │  Express serves BOTH the    │
                 │  API and the built React    │  ───►  Supabase
                 │  app, on one address        │        PostgreSQL 17
                 └─────────────────────────────┘
```

Because one address serves both the site and the API, there is no CORS to configure and the
login cookie just works. There is **no separate front-end host** — don't create one.

---

## Before you start

- [ ] `main` is green and has all four MVP pull requests merged
- [ ] You can sign in to GitHub with the account that owns the repository
- [ ] Docker Desktop is running on your laptop (needed at the end, to switch back to local work)

You will create two accounts if you don't have them: **supabase.com** and **render.com**. Sign
up for both with GitHub — it saves linking the repository later.

---

# Part 1 · The database (Supabase)

### 1.1 Create the project

1. Go to **https://supabase.com/dashboard** and sign in.
2. Click **New project**.
3. Fill it in:
   - **Name:** `smartstock-ict305`
   - **Database Password:** click **Generate a password**, then **copy it somewhere safe right now**. You cannot see it again, and you need it in step 1.2.
   - **Region:** `Southeast Asia (Singapore)` or `Oceania (Sydney)` — pick **Sydney** if it is offered.
4. Click **Create new project** and wait. It takes two or three minutes.

> **Write the password down before moving on.** If you lose it you have to reset it under
> *Project Settings → Database → Reset database password*, which is annoying but not fatal.

### 1.2 Get the connection string

1. In your project, click **Connect** at the top of the page.
2. You will see several tabs. Choose **Session pooler**.
3. Copy the string. It looks like this:

   ```
   postgresql://postgres.abcdefghijklm:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
   ```

4. Replace `[YOUR-PASSWORD]` with the password from step 1.1. Keep the whole thing handy — this
   is your `DATABASE_URL`.

> **It must be the Session pooler, port 5432 — not the Transaction pooler on 6543.**
> Receiving stock uses `SELECT … FOR UPDATE` row locks that are held open across a transaction.
> The transaction pooler can hand your statements to different connections, which breaks those
> locks and lets two people take the last item at the same time. This one choice is the
> difference between a correct ledger and a corrupt one, so check the port says **5432**.

---

# Part 2 · Load the demo data

The database is empty. You load the schema and demo data once, from your laptop.

### 2.1 Point your local `.env` at Supabase, temporarily

Open `server/.env` in your editor. Find these three lines under *Option A: PostgreSQL in Docker*
and put a `#` in front of each:

```ini
DATABASE_URL=postgresql://smartstock:smartstock_dev@localhost:5433/smartstock
DATABASE_SSL=false
DATABASE_MAX_CONNECTIONS=10
```

Then add these three underneath, pasting your own connection string:

```ini
DATABASE_URL=postgresql://postgres.xxxx:YOUR-PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
DATABASE_SSL=no-verify
DATABASE_MAX_CONNECTIONS=5
```

Leave everything else in the file alone — `SEED_PASSWORD=demo1234` is already there and is what
gives the demo accounts their password.

### 2.2 Build the schema and load the data

From the repository root:

```bash
npm run db:setup --prefix server
```

This takes about a minute against a remote database. You should see it finish with:

```
[seed] done. Every account uses the password "demo1234".
```

### 2.3 Lock down the tables

Supabase automatically publishes every table in the `public` schema through a REST API reachable
with its `anon` key — a key that is public by design. SmartStock does not use that API, but
leaving it open means anyone with the key could read your users table, every price and the whole
order history, straight from the internet.

1. In Supabase, go to **SQL Editor → New query**.
2. Open `server/src/db/supabase-hardening.sql` from this repository, copy **all** of it, paste it
   into the editor.
3. Click **Run**. It should report success with no rows.

> **Re-run this file every time you re-seed the database.** Dropping and recreating the tables
> also drops these protections. The file explains what it does and is safe to run repeatedly.

### 2.4 Put your `.env` back

Undo step 2.1: remove the Supabase lines and uncomment the local Docker ones, so you are back to

```ini
DATABASE_URL=postgresql://smartstock:smartstock_dev@localhost:5433/smartstock
DATABASE_SSL=false
DATABASE_MAX_CONNECTIONS=10
```

> `server/.env` is in `.gitignore` and must **never** be committed. Check with
> `git status` — it should not appear.

---

# Part 3 · The web service (Render)

### 3.1 Create the service

1. Go to **https://dashboard.render.com** and sign in with GitHub.
2. Click **New → Web Service**.
3. Choose **Build and deploy from a Git repository**, then **Next**.
4. Find `SmartStock-ICT_305` and click **Connect**. If you can't see it, click
   *Configure account* and give Render access to the repository.

### 3.2 Fill in the settings

| Field | Value |
|---|---|
| **Name** | `smartstock-ict305` |
| **Language** / Runtime | `Node` |
| **Branch** | `main` |
| **Region** | `Singapore` |
| **Root Directory** | *leave empty* |
| **Instance Type** | `Free` |

**Build Command** — delete what is there and paste this exactly, all on one line:

```bash
npm ci --include=dev && npm ci --include=dev --prefix server && npm ci --include=dev --prefix client && npm run build --prefix client
```

**Start Command:**

```bash
npm start --prefix server
```

> **Why `--include=dev` matters.** You are about to set `NODE_ENV=production`, and that makes npm
> skip devDependencies. But the client build needs Vite and the server is started by tsx, and both
> are devDependencies. Without this flag the build fails with `vite: not found` or the service
> crashes on boot with `tsx: not found`. This is the single most likely thing to go wrong.

### 3.3 Add the environment variables

Scroll to **Environment Variables** and add these seven. Use **Add Environment Variable** for
each one.

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | your Session pooler string from step 1.2, password filled in |
| `DATABASE_SSL` | `no-verify` |
| `DATABASE_MAX_CONNECTIONS` | `5` |
| `SESSION_SECRET` | a long random string — see below |
| `CLIENT_ORIGIN` | `https://smartstock-ict305.onrender.com` |

For `SESSION_SECRET`, run this on your laptop and paste the output:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For `CLIENT_ORIGIN`, use the URL Render shows near the top of this page. It is normally
`https://<your service name>.onrender.com`. If your service name differs, use yours. You can
correct it afterwards — see step 4.3.

Do **not** add `PORT`. Render sets it and the server reads it automatically.

> These values exist only in Render. Nothing here goes into the repository.

### 3.4 Deploy

Click **Deploy Web Service**. The first build takes five to ten minutes.

Watch the log. You are waiting for these two lines at the end:

```
[api] database: postgres at aws-0-ap-southeast-2.pooler.supabase.com:5432 (TLS no-verify)
[api] SmartStock API listening on http://localhost:10000 (production)
```

Two things that look wrong but are not. The database is called `postgres`, because that is what
Supabase names it — your tables live inside it. And `localhost:10000` is the port inside Render's
container; your public URL is the one at the top of the page.

Check that line says **`:5432`**. If it says `:6543` you took the transaction pooler by mistake —
go back to step 1.2.

---

# Part 4 · Check that it works

### 4.1 Open the site

Visit your Render URL. You should get the SmartStock login page, not a blank screen and not JSON.

### 4.2 Walk the demo journey

Every account uses the password `demo1234`.

| Step | Sign in as | Do this | Expect |
|---|---|---|---|
| 1 | `admin@smartstock.io` | Products → Add product, set a minimum level of 10 and opening stock of 12 | Product saved, stock shows 12 |
| 2 | `staff@smartstock.io` | Record stock → pick that product, OUT, quantity 5 | Stock drops to 7 |
| 3 | still staff | Open Alerts | The product is listed, shortfall 3 |
| 4 | still staff | Look at the bell, top right | The count has gone up and includes it |

If all four work, staging is live and the MVP is demonstrable.

### 4.3 Fix `CLIENT_ORIGIN` if the URL surprised you

If Render gave you a different URL than you guessed, go to **Environment** in the left sidebar,
edit `CLIENT_ORIGIN` to the real URL, and click **Save, rebuild, and deploy**.

### 4.4 Record the URL

Edit `README.md` and replace both `<set after the first deploy>` placeholders — the one in the
table at the top and the one in the Staging section — with your real URL. Commit that on a small
branch and merge it, so the README matches reality.

---

## Before the demo — read this

**The free tier sleeps.** After 15 minutes with no traffic, Render shuts the service down. The
next request wakes it, and that first request takes **about 50 seconds** while it boots.

> **Open the site two or three minutes before you present and leave the tab open.** A sleeping
> service in front of the marker looks exactly like a broken one.

Deploys are automatic: anything merged to `main` rebuilds and redeploys within a few minutes.

---

## If something goes wrong

| What you see | Why | Fix |
|---|---|---|
| Build fails, `vite: not found` or `tsc: not found` | `NODE_ENV=production` made npm skip devDependencies | The build command is missing `--include=dev`. Re-read step 3.2. |
| Service crashes at boot, `tsx: not found` | Same cause, same fix | As above |
| `SESSION_SECRET must be at least 16 characters` | The variable is missing or too short | Add a proper one — step 3.3 |
| `self-signed certificate in certificate chain` | Supabase signs with its own authority, which Node does not trust | `DATABASE_SSL` must be `no-verify`, not `true` |
| `password authentication failed` | Wrong password, or `[YOUR-PASSWORD]` left as-is in the string | Re-paste `DATABASE_URL` with the real password |
| Login page loads, signing in does nothing | The session cookie is `secure` in production and needs `trust proxy` | Already handled in `server/src/app.ts`. If it still fails, confirm you are on **https**, not http |
| `relation "users" does not exist` | The schema was never loaded | Go back and do Part 2 |
| Site works, refreshing `/products/9` gives a 404 | The SPA fallback is not running | Confirm `NODE_ENV=production` is set — the fallback only runs in production |
| Blank white page, console shows 404s for `/assets/...` | The client build did not run | Check the build log for `vite build` and for `dist/` output |
| First visit of the day takes ~50 seconds | Free tier spin-down, not a fault | Wake it up before you demo |

### Reading the logs

Render's left sidebar has **Logs** — live output from the service, and the first place to look.
**Events** shows deploy history and why a deploy failed.

Supabase's **Logs → Postgres** shows database errors, including refused connections if you
exceed the free tier's connection limit. That is why `DATABASE_MAX_CONNECTIONS` is `5`.

---

## Starting over

If staging gets into a mess, this is safe to redo:

```bash
# from your laptop, with server/.env pointed at Supabase (step 2.1)
npm run db:setup --prefix server
```

Then re-run `supabase-hardening.sql` in the Supabase SQL editor (step 2.3) and put your `.env`
back (step 2.4). This wipes staging and reloads the demo data; it does not touch Render.
