# Quieter

> macOS system optimizer — reclaim performance on aging Macs.

**GitHub:** [MbarkT3STO/Quieter-App](https://github.com/MbarkT3STO/Quieter-App)

---

## Repository Structure

```
Quieter-App/
├── app/          ← Electron desktop application
│   ├── src/
│   ├── build/
│   ├── package.json
│   └── README.md   ← Full app documentation
│
└── website/      ← Landing page (pure HTML/CSS/JS)
    ├── index.html
    ├── style.css
    └── script.js
```

---

## App

See [`app/README.md`](app/README.md) for full setup, architecture, and contribution guide.

```bash
cd app
npm install
npm run dev
```

## Website

Static HTML/CSS/JS — no build step needed.

```bash
# Open locally
open website/index.html

# Or serve with any static server
npx serve website
```

---

## License

MIT
