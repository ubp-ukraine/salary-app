# Розгортання salary-app

Той самий підхід, що в WMS і «Оплатах»: self-hosted Supabase (CLI + Docker) на тій
самій Ubuntu VM, публічний API через Cloudflare Tunnel, фронт — статика Vite на
Cloudflare Workers.

Третій стек на одній машині, тож у нього **свій `project_id`** і **свій блок
портів 49000–49007** — усе вже прописано в [`supabase/config.toml`](../supabase/config.toml).

## Мапа портів

| Служба | WMS | Оплати | salary-app |
| --- | --- | --- | --- |
| Kong (API) | 54321 | 48000 | **49000** ← сюди веде тунель |
| PostgreSQL | 54322 | 48001 | 49001 |
| shadow | 54320 | 48002 | 49002 |
| Pooler | 54329 | 48003 | 49003 |
| Studio | 54323 | 48004 | 49004 |
| Inbucket | 54324 | 48005 | 49005 |
| Analytics | 54327 | 48006 | 49006 |
| Edge inspector | 8083 | 48007 | 49007 |

## 1. Код на VM

```bash
cd ~
git clone https://github.com/ubp-ukraine/salary-app.git
cd salary-app
```

## 2. Підняти стек

Домен у `config.toml` поки **не чіпаємо**: `supabase start` робить health-check по
`external_url`, і якщо домен ще не резолвиться — старт впаде й погасить контейнери.
Спершу піднімаємо на локальних портах, домен вписуємо після тунелю.

```bash
npx supabase start
npx supabase status        # звідси беремо anon key
```

## 3. Схема

```bash
npx supabase migration up --include-all \
  --db-url postgresql://supabase_admin:postgres@127.0.0.1:49001/postgres
```

`--db-url` з `supabase_admin` — обовʼязково: об'єкти належать йому, а CLI за
замовчуванням ходить під `postgres` і впирається в `must be owner`.

## 4. Учасники й перший користувач

Учасників заводимо руками — їх двоє й вони не змінюються:

```sql
INSERT INTO public.participants (name, share) VALUES ('Артем', 0.5), ('Колега', 0.5);
```

Користувач для входу створюється у Studio (`http://IP:49004` → Authentication →
Add user) або через `auth.admin` з service_role ключем. Реєстрації в застосунку
немає навмисно — він на двох.

## 5. Тунель

Cloudflare Zero Trust → Tunnels → новий public hostname:

- **Hostname:** `salary-api.erp-ubpukraine.com` (він же йде у `VITE_SUPABASE_URL`)
- **Service:** `http://<IP_VM>:49000` — без шляху й без слеша в кінці

Домен уже піднято, тож `external_url` і `jwt_issuer` у `config.toml` заповнені.
Після зміни конфігу стек треба перезапустити:

```bash
npx supabase stop && npx supabase start
```

## 6. Фронт

```bash
cp .env.example .env       # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npm run deploy             # vite build + wrangler deploy
```

Перед першим деплоєм — `npx wrangler login` в інтерактивному терміналі.

Після деплою додати URL воркера в `[auth].site_url` і
`additional_redirect_urls`, інакше вхід не поверне користувача назад.
