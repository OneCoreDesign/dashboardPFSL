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
   - `DB_FILE`: `./backend/data/crm_prod.sqlite`
   - `FRONTEND_URL`: `*`

---

## 🔑 Key Accounts & Login Credentials
| Role | Username | Password | Department |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | IT |
| **Director** | `SS` | *(Existing password)* | Director |
| **Employee** | `ganesh` | `ganesh123` | IT |
| **Employee** | `komal` | `komal123` | HR |
| **Employee** | `sapna` | `sapna123` | MSPA |
| **Employee** | `sheetal` | `sheetal123` | SSPA |
| **Employee** | `rohan` | `rohan123` | Recordkeeping |
| **Employee** | `soham` | `soham123` | BDBP |
| **Employee** | `aangi` | `aangi123` | BDBP |
| **Employee** | `wilson` | `wilson123` | OfficeAdmin |
| **Employee** | `ankit` | `ankit123` | Account |
| **Employee** | `sahil` | `sahil123` | Account |
| **Employee** | `rajendra` | `rajendra123` | Account |
| **Employee** | `abhinav` | `abhinav123` | BD |
| **Employee** | `pankaj` | `pankaj123` | Sales Manager |
| **Employee** | `sandeep` | `sandeep123` | Manager |
| **Employee** | `legal` | `legal123` | Legal |
| **Employee** | `reception` | *(Existing password)* | Reception |

---

## 💾 Database Management
- **Database Engine:** SQLite (stored at `./backend/data/crm_prod.sqlite`)
- **Re-import Backup:**
  ```bash
  npm run db:import
  ```

