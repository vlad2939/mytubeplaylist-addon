# 📺 Minimalist YouTube Playlist - viewer & editor

Un dashboard personal pentru vizionarea clipurilor YouTube organizate în playlist-uri, construit cu tehnologii web pure. Elimină complet algoritmii de recomandare, reclamele vizuale și distracțiile platformei originale — rămâne doar conținutul tău.

![Versiune](https://img.shields.io/badge/versiune-1.0.2-blue.svg)
![Tema Dark/Light](https://img.shields.io/badge/Tema-Dark%20%2F%20Light-orange?style=flat-square)
![Vanilla JS](https://img.shields.io/badge/JS-Vanilla%20ES6%2B-yellow?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/CSS-Tailwind%20CDN-38bdf8?style=flat-square)
![Zero Build Tools](https://img.shields.io/badge/Build-Zero%20Tools-green?style=flat-square)
![JSON Builder](https://img.shields.io/badge/Tool-JSON%20Builder-f97316?style=flat-square)

---

## Cuprins

1. [Descriere generală](#1-descriere-generală)
2. [Funcționalități](#2-funcționalități)
3. [Structura proiectului](#3-structura-proiectului)
4. [JSON Builder — generare automată `data.json`](#4-json-builder--generare-automată-datajson)
5. [Cum se editează manual `data.json`](#5-cum-se-editează-manual-datajson)
6. [Instalare și rulare](#6-instalare-și-rulare)
7. [Deployment](#7-deployment)
8. [Personalizare vizuală](#8-personalizare-vizuală)
9. [Compatibilitate](#9-compatibilitate)

---

## 1. Descriere generală

Minimalist YouTube Dashboard este o aplicație web **100% statică** — nu are backend, nu face apeluri la API-uri externe, nu colectează date. Funcționează direct în browser, citind un singur fișier de configurare (`data.json`) pe care tu îl controlezi complet.

**Design:** Stil Glassmorphism premium cu fundal animat (blob-uri cu blur), sidebar flotant, carduri cu efecte hover și tranziții fluide. Suportă temă Dark și Light, detectată automat din preferințele sistemului și salvată în `localStorage`.

**Filosofie:** Mai puțin = mai bine. Niciun algoritm de recomandare, nicio reclamă vizuală, nicio distracție. Doar playlist-urile tale, exact cum le-ai organizat.

---

## 2. Funcționalități

### Navigare
- **Ecranul principal (Home)** — afișează toate playlist-urile ca un grid de carduri, fiecare cu preview 2×2 din primele 4 thumbnail-uri, numărul de clipuri și durata totală calculată automat.
- **Vizualizare playlist** — grid responsiv de clipuri (1 → 2 → 3 → 4 coloane în funcție de lățimea ecranului), cu thumbnail-uri încărcate lazy și skeleton loader animat.
- **Player video** — înlocuiește grid-ul cu un iframe YouTube embed (`autoplay`, fără reclame vizuale de interfață, fără sidebar YouTube), însoțit de o coadă „Urmează" cu până la 7 clipuri din același playlist.
- **Navigare Anterior / Următor** — butoane dedicate în player pentru a merge secvențial prin playlist.

### Căutare normalizată
- Caută în timp real în **titlurile tuturor clipurilor** și în **numele playlist-urilor** simultan.
- Căutarea este insensibilă la **majuscule**, **diacritice** și **semne de punctuație** — `"stiinta"` găsește `"Știință"`, `"gatit"` găsește `"Gătit & Gastronomie"`.
- Un match pe numele unui playlist întoarce **toate clipurile** din acel playlist, grupate sub un header dedicat.
- Rezultatele sunt **grupate pe playlist-uri**, fiecare grup cu header, număr de clipuri găsite și badge `📁 playlist` dacă match-ul a venit de pe numele colecției.
- Se activează la minim 2 caractere introduse. Ștergerea textului revine automat la Home.

### Gestionare date
- **Load Data** — buton în sidebar care permite încărcarea unui fișier `data.json` local din calculator, înlocuind datele curente fără a reîncărca pagina. Suportă și **drag & drop** al fișierului direct pe sidebar.
- **JSON Builder** — unealtă separată (`builder.html`) pentru generarea automată a fișierelor `data.json` din link-uri de playlist-uri YouTube, folosind YouTube Data API v3. Detalii în [secțiunea 4](#4-json-builder--generare-automată-datajson).

### UI / UX
- **Sidebar** fix pe desktop (260px), slide-in cu overlay pe mobile.
- **Temă Dark / Light** — toggle în sidebar (desktop) și în topbar (mobile). Preferința este salvată în `localStorage` și reîncărcată la fiecare vizită. La prima vizită, tema este detectată din `prefers-color-scheme` al sistemului de operare.
- **Animații:** blob-uri de fundal animate lent, carduri cu intrare staggered (delay crescător per poziție), thumbnail-uri cu fade-in la încărcare.
- **Ecran de loading** la pornire, cu fade-out după ce `data.json` este procesat.
- **Ecran de eroare** prietenos dacă `data.json` nu poate fi încărcat.

---

## 3. Structura proiectului

```
minimalist-yt-dashboard/
│
├── index.html      # Dashboard principal: structură HTML, Tailwind config, fonturi
├── style.css       # Stiluri custom: animații, skeleton, nav buttons, scrollbar
├── app.js          # Logica dashboard-ului (Vanilla JS, ~600 linii comentate)
├── builder.html    # Unealtă JSON Builder (standalone, YouTube Data API v3)
└── data.json       # Sursa de date: playlist-urile și clipurile tale
```

Atât. Niciun `node_modules`, niciun `package.json`, niciun pas de build.

### Rolul fiecărui fișier

**`index.html`**
Conține structura semantică completă: sidebar cu butoanele Load Data, JSON Builder și theme toggle, topbar mobile, zona de conținut principal, overlay-ul de loading și blob-urile de fundal. Tailwind CSS este încărcat prin CDN cu o configurare extinsă (animații custom, fonturi, culori). Fonturile sunt încărcate din Google Fonts: **Syne** (display/titluri) și **DM Sans** (body), plus **Material Icons Round** pentru iconițe.

**`style.css`**
Stiluri care nu pot fi exprimate eficient prin clase Tailwind utilitare: animația `slideUpCard` cu delay staggered per card, skeleton loader cu undă animată (`skeleton-wave`), comportamentul butonului de navigare din sidebar (`nav-btn`), scrollbar custom, și tranziții fine pe `thumb-img`.

**`app.js`**
Organizat în secțiuni clare, comentate:
- `STATE` — obiect centralizat cu starea curentă a aplicației
- `UTILITY HELPERS` — funcții pure: `extractVideoId()`, `thumbUrl()`, `totalMinutes()`, `formatDuration()`, `esc()`, `normalize()` (insensibilitate la diacritice)
- `TEMA` — `initTheme()`, `applyTheme()`, `toggleTheme()`
- `LOAD DATA` — `loadDataFile()`, `showLoadError()`, `flashLoadBtn()`
- `SIDEBAR` — `renderSidebar()`, `createNavBtn()`
- `NAVIGARE` — `navigateHome()`, `navigatePlaylist()`, `navigateVideo()`
- `RENDER` — `renderHome()`, `createPlaylistCard()`, `renderPlaylist()`, `createVideoCard()`, `renderPlayer()`
- `SEARCH` — `performSearch()` — caută în titluri și nume playlist-uri, grupează rezultatele
- `EVENT LISTENERS` — `bindEvents()` — include și drag & drop pentru Load Data
- `INIT` — `init()` — punctul de intrare, încarcă `data.json` asincron

**`builder.html`**
Aplicație standalone pentru generarea fișierelor `data.json`. Nu depinde de celelalte fișiere — poate fi folosit și independent. Conține întreaga logică în același fișier (HTML + CSS + JS inline). Detalii complete în [secțiunea 4](#4-json-builder--generare-automată-datajson).

**`data.json`**
Singura sursă de configurare a conținutului. Detaliat în [secțiunea 5](#5-cum-se-editează-manual-datajson).

---

## 4. JSON Builder — generare automată `data.json`

`builder.html` este o unealtă vizuală pentru a construi fișiere `data.json` direct din link-uri de playlist-uri YouTube, fără a introduce manual niciun titlu sau durată. Folosește **YouTube Data API v3** pentru a extrage automat toate datele.

### Cum se accesează

Din dashboard, click pe butonul **JSON Builder** (cu iconița 🔧) din partea de jos a sidebar-ului. Alternativ, deschide direct `builder.html` în browser.

### Workflow pas cu pas

**Pasul 1 — Introdu API Key-ul**

În câmpul `YouTube Data API v3 Key` din partea de sus, introdu cheia ta. Butonul 👁 din dreapta permite afișarea/ascunderea valorii. Key-ul nu este salvat nicăieri — rămâne doar în memorie pe durata sesiunii.

Alternativ, hardcodează key-ul direct în fișier: deschide `builder.html` într-un editor de text și înlocuiește valoarea constantei `DEFAULT_API_KEY` (prima linie din blocul `<script>`):

```js
const DEFAULT_API_KEY = 'AIzaSy...cheia_ta_aici';
```

**Pasul 2 — Adaugă un link de playlist**

Lipește URL-ul unui playlist YouTube în câmpul de input și apasă **Fetch** sau tasta `Enter`. Sunt acceptate toate formatele:

```
https://www.youtube.com/playlist?list=PLxxxxxx           ✅ format direct
https://www.youtube.com/watch?v=xxxxx&list=PLxxxxxx      ✅ din watch cu list
https://youtu.be/xxxxx?list=PLxxxxxx                     ✅ format scurt
```

Aplicația va parcurge automat toate paginile playlist-ului (câte 50 clipuri per request) și va extrage pentru fiecare clip: titlul, URL-ul și durata exactă. Un **progress bar animat** indică faza curentă (metadate → clipuri → durate).

**Pasul 3 — Repetă pentru oricâte playlist-uri**

Fiecare playlist adăugat apare ca un card colapsabil în queue. Poți:
- **Expanda** cardul pentru a vedea lista completă de clipuri cu duratele lor
- **Redenumi** playlist-ul cu butonul ✎ (titlul original YouTube poate fi lung sau nesugestiv)
- **Elimina** un playlist din queue cu butonul ✕

Nu există limită de playlist-uri pe sesiune.

**Pasul 4 — Generează și descarcă**

Setează numele dorit în câmpul din stânga jos (default: `data.json`) și apasă **Generează & Descarcă JSON**. Fișierul se descarcă imediat, gata de folosit în dashboard.

### Preview JSON live

Panoul din dreapta afișează în timp real conținutul JSON care va fi generat, cu syntax highlighting (chei portocalii, valori verzi). Butonul **Copiază** din header copiază tot conținutul în clipboard.

### Limitări tehnice

Aplicația funcționează doar cu playlist-uri **publice** sau **nelistate** (unlisted). Playlist-urile private nu sunt accesibile prin API fără autentificare OAuth, care depășește scopul acestui tool.

Clipurile **șterse** sau **private** din interiorul unui playlist public sunt filtrate automat și nu apar în JSON-ul generat.

Limita gratuită a YouTube Data API v3 este de **10.000 unități/zi**. Un playlist de 100 clipuri consumă aproximativ 3-5 unități. În practică, limita gratuită este mai mult decât suficientă pentru uz personal.

### Cum obții un API Key gratuit

1. Mergi la [console.cloud.google.com](https://console.cloud.google.com) și autentifică-te cu contul Google
2. Creează un proiect nou (butonul din header → **New Project**)
3. Din meniul stânga: **APIs & Services → Library**
4. Caută **YouTube Data API v3** și apasă **Enable**
5. Din meniul stânga: **APIs & Services → Credentials → Create Credentials → API Key**
6. Copiază key-ul generat și pune-l în aplicație

> **Opțional dar recomandat:** Restricționează key-ul la HTTP referrers (domeniul sau IP-ul tău local) din **Edit API Key → Application restrictions**, pentru a preveni folosirea lui neautorizată.

---

## 5. Cum se editează manual `data.json`

Acesta este **singurul fișier pe care trebuie să îl modifici manual** dacă nu folosești JSON Builder. Nu există panou de administrare — editezi direct JSON-ul.

### Schema completă

```json
{
  "playlists": [
    {
      "title": "Numele Playlist-ului",
      "videos": [
        {
          "title": "Titlul clipului",
          "url": "https://www.youtube.com/watch?v=VIDEO_ID",
          "duration": "MM:SS"
        }
      ]
    }
  ]
}
```

### Câmpuri obligatorii

| Câmp | Tip | Descriere |
|---|---|---|
| `playlists` | Array | Lista tuturor playlist-urilor. Poate conține oricâte intrări. |
| `playlists[].title` | String | Numele afișat al playlist-ului în sidebar și pe cardul de overview. |
| `playlists[].videos` | Array | Lista clipurilor din playlist. |
| `videos[].title` | String | Titlul clipului, afișat sub thumbnail și în player. |
| `videos[].url` | String | URL-ul YouTube. Vezi formatele acceptate mai jos. |
| `videos[].duration` | String | Durata în format `"MM:SS"` sau `"H:MM:SS"`. Folosită pentru badge și pentru calculul duratei totale a playlist-ului. |

### Formate URL acceptate

Aplicația extrage automat Video ID-ul din toate formatele standard YouTube:

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ   ✅ format standard
https://youtu.be/dQw4w9WgXcQ                  ✅ format scurt
https://www.youtube.com/embed/dQw4w9WgXcQ     ✅ format embed
```

### Cum obții URL-ul unui clip

1. Deschide clipul pe YouTube
2. Click pe butonul **Distribuie** (Share) → **Copiază linkul**
3. Sau copiază direct URL-ul din bara de adrese a browserului

### Cum obții durata unui clip

Durata este vizibilă direct pe thumbnail-ul YouTube, în dreapta jos. Introdu-o exact în formatul afișat: `"8:45"`, `"1:23:07"` etc.

> **Notă:** Câmpul `duration` este opțional din punct de vedere tehnic — dacă îl omit, badge-ul va fi gol, dar aplicația funcționează normal.

### Exemplu complet `data.json`

```json
{
  "playlists": [
    {
      "title": "Tutoriale JavaScript",
      "videos": [
        {
          "title": "JavaScript pentru începători - Complet",
          "url": "https://www.youtube.com/watch?v=W6NZfCO5SIk",
          "duration": "48:17"
        },
        {
          "title": "Async / Await explicat simplu",
          "url": "https://www.youtube.com/watch?v=V_Kr9OSfDeU",
          "duration": "11:34"
        }
      ]
    },
    {
      "title": "Muzică pentru lucrat",
      "videos": [
        {
          "title": "Lofi Hip Hop Radio - Study Beats",
          "url": "https://www.youtube.com/watch?v=jfKfPfyJRdk",
          "duration": "2:32:00"
        }
      ]
    }
  ]
}
```

### Sfaturi practice

- **Ordinea contează:** Clipurile sunt redate în ordinea din JSON. Pune-le în ordinea dorită.
- **Fără limită:** Poți adăuga oricâte playlist-uri și oricâte clipuri per playlist.
- **Validează JSON-ul:** Înainte de salvare, verifică sintaxa pe [jsonlint.com](https://jsonlint.com) pentru a evita erori de parsare.
- **Clipuri private/șterse:** Thumbnail-ul va apărea gri (imaginea returnează eroare), dar cardul și player-ul funcționează în continuare.

---

---

## 6. Instalare și rulare

> ⚠️ **Important:** Aplicația nu poate fi deschisă direct ca fișier local (`file://`) din cauza politicilor CORS ale browserului pentru `fetch()`. Este nevoie de un server HTTP, oricât de simplu.

### Opțiunea 1 — `npx serve` (recomandat — zero instalare)

Dacă ai Node.js instalat (versiunea 14+), aceasta este cea mai rapidă metodă — nu necesită instalarea globală a niciunui pachet:

```bash
cd minimalist-yt-dashboard
npx serve -l 3000
```

`npx` descarcă și rulează `serve` temporar, fără a-l instala permanent. La prima rulare va cere confirmare pentru download (`Need to install the following packages: serve` → apasă `y`). La rulările ulterioare pornește instant.

Deschide browserul la: **http://localhost:3000**

Oprire server: `Ctrl + C` în terminal.

### Opțiunea 2 — Python

Dacă ai Python instalat (versiunea 3.x):

```bash
cd minimalist-yt-dashboard
python3 -m http.server 8080
```

Deschide browserul la: **http://localhost:8080**

Pentru Python 2.x (mai vechi):
```bash
python -m SimpleHTTPServer 8080
```

### Opțiunea 3 — Node.js `serve` (instalat global)

Dacă preferi să ai `serve` disponibil permanent în sistem:

```bash
# Instalează o singură dată
npm install -g serve

# Pornește din directorul proiectului
cd minimalist-yt-dashboard
serve -l 3000
```

Deschide browserul la: **http://localhost:3000**

### Opțiunea 4 — VS Code Live Server

Dacă folosești Visual Studio Code:

1. Instalează extensia **Live Server** (Ritwick Dey) din Marketplace
2. Click dreapta pe `index.html` → **Open with Live Server**
3. Browserul se deschide automat și se reîncarcă la orice modificare în fișiere

### Opțiunea 5 — PHP (dacă este instalat)

```bash
cd minimalist-yt-dashboard
php -S localhost:8080
```

---

## 7. Deployment

### NGINX (server dedicat sau VPS)

Copiază toate cele 5 fișiere (`index.html`, `style.css`, `app.js`, `builder.html`, `data.json`) în directorul servit de NGINX:

```bash
cp -r minimalist-yt-dashboard/* /var/www/html/yt-dashboard/
```

Configurație minimă NGINX (`/etc/nginx/sites-available/yt-dashboard`):

```nginx
server {
    listen 80;
    server_name yt.local;          # sau IP-ul tău local / domeniu

    root /var/www/html/yt-dashboard;
    index index.html;

    # Servire fișiere statice cu cache
    location ~* \.(css|js|json)$ {
        expires 1h;
        add_header Cache-Control "public";
    }

    # Fallback pentru single-page
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Activare și restart
sudo ln -s /etc/nginx/sites-available/yt-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Home Assistant Add-on (nginx sau file editor)

1. Copiază fișierele în directorul accesibil al add-on-ului tău de server static (ex: `/config/www/yt-dashboard/`)
2. Accesează din rețeaua locală la `http://homeassistant.local:8123/local/yt-dashboard/`

> **Notă:** Home Assistant servește `/config/www/` la `/local/` prin interfața sa web.

### Docker (container NGINX simplu)

Creează un `Dockerfile` în directorul proiectului:

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
```

```bash
# Build și rulare
docker build -t yt-dashboard .
docker run -d -p 8080:80 --name yt-dashboard yt-dashboard
```

Accesează la **http://localhost:8080**

Pentru a actualiza `data.json` fără a reconstrui imaginea, montează-l ca volum:

```bash
docker run -d -p 8080:80 \
  -v /calea/ta/data.json:/usr/share/nginx/html/data.json:ro \
  --name yt-dashboard yt-dashboard
```

### GitHub Pages / Netlify / Vercel

Simplu: fă push la un repository public și activează hosting-ul static.

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/utilizator/yt-dashboard.git
git push -u origin main
```

Apoi în GitHub: **Settings → Pages → Branch: main → Save**

> ⚠️ Pe GitHub Pages, `data.json` devine public. Nu include URL-uri pe care nu vrei să le faci publice.

---

## 8. Personalizare vizuală

### Schimbarea culorilor accent

Culoarea principală de accent este **orange-500** (`#f97316`). Pentru a o schimba, modifică în `index.html` secțiunea `tailwind.config`:

```js
colors: {
  accent: '#8b5cf6', // violet, de exemplu
},
```

Apoi înlocuiește toate aparițiile de `orange-` cu noua culoare în `index.html`, `style.css` și `app.js`.

### Schimbarea fonturilor

În `index.html`, înlocuiește linkul Google Fonts și actualizează `tailwind.config`:

```js
fontFamily: {
  display: ['Playfair Display', 'serif'],
  body: ['Source Sans 3', 'sans-serif'],
},
```

### Modificarea animației blob-urilor

Viteza și forma blob-urilor se controlează în `tailwind.config` (secțiunea `animation`) și în HTML (clasele `animate-blob`, `animate-blob-slow`, `animate-blob-fast`):

```js
animation: {
  'blob':      'blob 18s ease-in-out infinite', // schimbă durata
  'blob-slow': 'blob 26s ease-in-out infinite',
  'blob-fast': 'blob 13s ease-in-out infinite',
},
```

### Adăugarea unui al 4-lea blob

```html
<div class="blob animate-blob absolute w-[380px] h-[380px] rounded-full
            bg-indigo-400/20 dark:bg-purple-500/10
            top-1/4 left-1/2 blur-[100px]"></div>
```

---

## 9. Compatibilitate

| Browser | Versiune minimă | Status |
|---|---|---|
| Chrome / Edge | 88+ | ✅ Complet |
| Firefox | 85+ | ✅ Complet |
| Safari | 14+ | ✅ Complet |
| Opera | 74+ | ✅ Complet |
| IE 11 | — | ❌ Nesuportat |

Funcționalități folosite care necesită browsere moderne: `CSS backdrop-filter`, `CSS Grid`, `async/await`, `fetch()`, `CSS custom properties`.

---

## Licență

Proiect personal, fără licență specifică. Folosește, modifică și distribuie liber.
