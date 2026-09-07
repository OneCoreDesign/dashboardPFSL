# PFSL Dashboard & CRM Production

Production-ready CRM Reporting application with Node.js Express backend, SQLite database, and pre-built frontend.

---

## 🚀 Quick Local Run
Double-click `START-SERVER.bat` or run:
```bash
node server.js
```
Open: [http://localhost:5001](http://localhost:5001)

---

## 🌐 Deploy to Hostinger (Web App)

1. **GitHub Connection:**
   - In Hostinger panel, select **Deploy Your Web App**.
   - Choose **Import your Git repository** -> Click **Continue with GitHub**.
   - Select this repository: `OneCoreDesign/dashboardPFSL`.
   - Branch: `main`.

2. **Project Settings in Hostinger:**
   - **Framework / Runtime:** Node.js
   - **Node.js Version:** `22.x` (or `>= 22.0.0`)
   - **Root Directory:** `./` (Leave as root)
   - **Build Command:** (leave default or `npm run build`)
   - **Start Command:** `npm start` (or `node server.js`)

3. **Environment Variables (Optional / Recommended):**
   - `NODE_ENV`: `production`
   - `PORT`: (Hostinger will provide this automatically)
   - `JWT_SECRET`: `CHANGE_THIS_TO_A_STRONG_SECRET_KEY_IN_PRODUCTION`
   - `DB_FILE`: `./data/crm_prod.sqlite`
   - `FRONTEND_URL`: `*`

---

## 🔑 Default Login Credentials
| Role | Username | Password |
| :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` |
| **Director** | `director` | `director123` |
| **Employee** | `alice` | `alice123` |
| **Employee** | `bob` | `bob123` |
