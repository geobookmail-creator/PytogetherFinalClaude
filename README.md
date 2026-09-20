# PayTogether

A Django web application for groups travelling together. One person starts a
tour, shares an eight-character join code, and everyone records what they spend.
The app keeps a running total and works out who owes what at the end.

---

## Running the project

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install Python packages
pip install -r requirements.txt

# 3. Apply migrations
python manage.py migrate

# 4. Create an admin account (optional)
python manage.py createsuperuser

# 5. Run it
python manage.py runserver
```

Then open <http://127.0.0.1:8000/login/>.

### Rebuilding the CSS

Styling is Tailwind, compiled to `static/css/app.css` so the app looks correct
without an internet connection. The compiled file is committed, so you only need
this after changing a template or a JavaScript file that contains CSS classes:

```bash
npm install          # first time only
npm run css          # rebuild once
npm run css:watch    # rebuild automatically while working
```

---

## Apps

| App | Responsibility |
| --- | --- |
| `apps.accounts` | Custom user model (email login), registration, JWT auth, profile |
| `apps.tours` | Tours, join codes, membership |
| `apps.expenses` | Individual expenses recorded against a tour |
| `apps.reports` | Settlement calculation — who owes what |
| `apps.core` | Shared pieces |

---

## API

All endpoints except register, login, and token refresh require an
`Authorization: Bearer <access token>` header.

### Accounts

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/register/` | Create an account |
| POST | `/api/login/` | Sign in, returns access and refresh tokens |
| POST | `/api/token/refresh/` | Exchange a refresh token for a new access token |
| GET | `/api/profile/` | Read the signed-in user's profile |
| PATCH | `/api/profile/` | Update name, phone, or profile image |
| POST | `/api/profile/change-password/` | Change password |

### Tours

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/tours/` | List the user's tours (paginated, searchable) |
| POST | `/api/tours/create/` | Create a tour |
| GET | `/api/tours/<id>/` | Tour detail |
| PATCH/PUT | `/api/tours/<id>/` | Edit a tour (creator only) |
| DELETE | `/api/tours/<id>/` | Delete a tour (creator only) |
| POST | `/api/tours/join/` | Join a tour using its code |
| GET | `/api/tours/dashboard/` | Created and joined tours, plus summary figures |

### Expenses

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/tours/<tour_id>/expenses/` | Every expense on a tour |
| POST | `/api/tours/<tour_id>/expenses/` | Add an expense |
| GET | `/api/expenses/<id>/` | Expense detail |
| PATCH | `/api/expenses/<id>/` | Edit an expense |
| DELETE | `/api/expenses/<id>/` | Delete an expense |

Categories: `food`, `transport`, `accommodation`, `activities`, `shopping`,
`other`.

### Reports

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/tours/<tour_id>/report/` | Settlement report for a tour |

The report returns the total spent, the number of members, each person's equal
share, and for every member: what they paid, what they owe, and the resulting
balance (`owes`, `gets back`, or `settled`). It also returns a per-category
breakdown. Each request saves a snapshot to the `reports` table.

---

## How the split is worked out

1. Add up every expense on the tour — this is the total.
2. Count the members: everyone who joined with the code, plus the creator.
3. Each person's share is the total divided by the member count.
4. For each person, balance = what they paid − their share.
   A positive balance means they are owed money; a negative balance means they
   owe money.

All money is handled with `Decimal` and rounded to two places using
`ROUND_HALF_UP`, so totals never drift the way floating point can.

---

## Permissions

- Only members of a tour (the creator, or anyone who joined with the code) can
  view its expenses or its report. Everyone else receives `403`.
- An expense can be edited or deleted by the person who recorded it, or by the
  tour creator. Nobody else.
- A tour can be edited or deleted only by its creator.

---

## Pages

| URL | Page |
| --- | --- |
| `/register/` | Create an account |
| `/login/` | Sign in |
| `/dashboard/` | Summary figures and your tours |
| `/tours/` | All your tours, searchable, with join codes |
| `/tours/create/` | Start a tour |
| `/tours/join/` | Join a tour with a code |
| `/tours/<id>/` | Tour detail: expenses and settlement |
| `/tours/edit/<id>/` | Edit a tour |
| `/profile/` | Your details and password |

---

## Notes for deployment

`DEBUG` and `SECRET_KEY` are read from `.env`; copy `.env.example` for a safe
starting point. Never commit a real `.env` file.

## Deploying to Railway

The project contains a Railway configuration that installs the Python
dependencies, collects static files, applies migrations before deployment, and
starts Gunicorn on Railway's assigned `PORT`.

1. Push this project to GitHub. The `.gitignore` deliberately excludes `.env`,
   the local SQLite database, virtual environments, generated static files, and
   local uploads.
2. In Railway, create a project and choose **Deploy from GitHub repo**.
3. Add **PostgreSQL** to the same Railway project. In the web service's
   **Variables** tab, add `DATABASE_URL` as a reference to the database:
   `${{Postgres.DATABASE_URL}}` (choose the database service from Railway's
   variable picker if its name differs).
4. Add these web-service variables:

   ```text
   SECRET_KEY=<a long, random secret>
   DEBUG=False
   ```

   Railway automatically adds `RAILWAY_PUBLIC_DOMAIN` once you generate a
   public domain, and the settings add that host and its HTTPS origin
   automatically. If you use a custom domain, set these too:

   ```text
   ALLOWED_HOSTS=your-domain.example
   CSRF_TRUSTED_ORIGINS=https://your-domain.example
   ```

   Add the optional `STRIPE_*` values only when card settlement is enabled.
   Set Stripe's webhook URL to:
   `https://your-domain/api/payments/stripe/webhook/`.
5. In the web service's **Settings → Networking**, generate a public domain.
   Railway then deploys automatically from each GitHub push.

### Uploaded images

Railway's normal filesystem is ephemeral, so attach a **Volume** to the web
service at `/data` if profile and tour images should survive redeployments. Then
add these variables:

```text
MEDIA_ROOT=/data
SERVE_MEDIA=True
```

This media option is suitable for a small, single-instance deployment. For
multiple instances or high traffic, use object storage (for example S3 or
Cloudinary) for user uploads instead.
