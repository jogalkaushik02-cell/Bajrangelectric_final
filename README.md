# બજરંગ ઇલેક્ટ્રિક — Bajrang Electric

Live-price storefront for an electrical & agriculture hardware shop in Gujarat.

## Pages

- **`index.html`** — customer storefront: interactive 3D hero, live catalogue, category
  filters, search, sort, product viewer, persistent estimate list and WhatsApp checkout.
- **`admin.html`** — password-protected price & stock manager (Supabase CRUD + photo upload).
  Unchanged and fully preserved.

## Preview locally

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080/>.

To preview the new design without the database, open:

```
http://localhost:8080/?preview=1
```

Preview mode uses demo products and a separate cart key, so it never touches real estimates.

## Backend

The storefront reads products from Supabase (`products` table) and photos from the
`product-images` storage bucket. Connection details live in:

- `assets/js/store.js` → `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `admin.html` → same two constants

> ⚠️ The current Supabase host (`fabhqatewbsmzutqycsb.supabase.co`) no longer resolves
> (NXDOMAIN from Cloudflare and Google DNS), so live prices cannot load until the project
> is restored or recreated. The storefront shows a friendly fallback with call/WhatsApp
> buttons while the backend is unavailable.

Expected `products` columns: `id`, `name`, `category`, `specs`, `selling_price`, `mrp`,
`unit`, `image_url`, `in_stock`, `created_at`.

## Deploy

Static site — deploy the repository root on Vercel (or any static host). No build step.

## Structure

```
index.html
admin.html
assets/
  css/store.css
  js/store.js        # catalogue, cart, filters, WhatsApp
  js/hero3d.js       # procedural Three.js energy core (SVG fallback)
  img/               # fallback art, favicon, placeholder
  vendor/            # pinned three.js r160 (MIT)
```
