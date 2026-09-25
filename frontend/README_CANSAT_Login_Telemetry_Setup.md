# CANSAT Login + Telemetry System — Complete Setup Guide

This guide is for anyone who downloads the project ZIP from GitHub and wants to run the complete local system.

## 1. What the system contains

```text
ESP8266
   ↓
Central Telemetry API (Node.js / Express)
   ↓
Redis Stream
   ↓
Telemetry Worker
   ↓
MySQL telemetry history + Redis latest state
   ↓
Telemetry Read APIs
   ↓
React dashboard

Login system:
School / Student / Admin
        ↓
Node.js / Express
        ↓
Login MySQL database

students.satellite_id connects the login system to telemetry.
```

## 2. Required software

Install:

- Windows 10/11
- Node.js LTS + npm
- MySQL 8.x + MySQL Workbench
- Docker Desktop
- WSL2 enabled for Docker Desktop
- Arduino IDE for ESP8266
- Chrome/Edge

Check:

```powershell
node -v
npm -v
docker --version
docker ps
```

## 3. Download and open the project

Download the GitHub ZIP and extract it.

Example:

```text
C:\Projects\CANSAT\
```

Expected layout:

```text
CANSAT/
├── backend/
├── frontend/
├── database/
├── firmware/        (if included)
└── README.md
```

Open the project in VS Code.

## 4. Install backend libraries

Open PowerShell in `backend`:

```powershell
cd C:\Projects\CANSAT\backend
```

Preferred:

```powershell
npm install
```

This uses the repository `package.json` / `package-lock.json`.

If `package.json` is missing:

```powershell
npm install express cors cookie-parser dotenv mysql2 argon2 redis
```

Main packages:

| Package | Purpose |
|---|---|
| express | REST/API server |
| cors | frontend ↔ backend access |
| cookie-parser | session cookie parsing |
| dotenv | `.env` configuration |
| mysql2 | MySQL connection |
| argon2 | Argon2id password hashing |
| redis | Redis Stream + latest-state cache |

## 5. Install frontend libraries

Open a second PowerShell:

```powershell
cd C:\Projects\CANSAT\frontend
npm install
```

If the project package file is incomplete:

```powershell
npm install react-router-dom lucide-react
```

## 6. Create MySQL databases

Open MySQL Workbench and run:

```sql
CREATE DATABASE IF NOT EXISTS login_system;
CREATE DATABASE IF NOT EXISTS telemetry_system;
```

Use the same telemetry database name that you put in `TELEMETRY_DB_NAME`.

### Load the login schema

Use the SQL file included in the repository, normally under:

```text
database/
```

Run it against:

```sql
USE login_system;
```

The login database contains tables such as:

- schools
- students
- school_mfa
- sessions

### Load the telemetry schema

Run the telemetry SQL file included in the repository against:

```sql
USE telemetry_system;
```

The telemetry database contains tables such as:

- satellites
- telemetry_packets

Do not invent a different schema when the repository already contains the required SQL schema.

## 7. Create backend `.env`

Inside:

```text
backend/
```

create:

```text
.env
```

Use `.env.example` from the repository when it exists.

Typical local configuration:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=login_system

TELEMETRY_DB_HOST=127.0.0.1
TELEMETRY_DB_PORT=3306
TELEMETRY_DB_USER=root
TELEMETRY_DB_PASSWORD=YOUR_MYSQL_PASSWORD
TELEMETRY_DB_NAME=telemetry_system
TELEMETRY_DB_CONNECTION_LIMIT=10

REDIS_URL=redis://127.0.0.1:6379

FLEET_API_KEY=YOUR_FLEET_API_KEY
```

Keep any additional variables already required by your project's `.env.example`.

### `.env` password warning

If a password contains characters such as `#`, spaces, single quotes or double quotes, quote the value correctly.

Example:

```env
DB_PASSWORD="My#Password 123"
```

Never commit `.env` to GitHub.

## 8. Create Redis with Docker

Redis is used for the telemetry Stream, latest telemetry state and rate limiting.

### First-time creation

```powershell
docker volume create cansat-redis-data
```

```powershell
docker run -d --name cansat-redis -p 6379:6379 -v cansat-redis-data:/data redis:7-alpine redis-server --appendonly yes
```

### If `cansat-redis` already exists

Do not run `docker run` again. Use:

```powershell
docker start cansat-redis
```

Check:

```powershell
docker ps
```

Test:

```powershell
docker exec cansat-redis redis-cli PING
```

Expected:

```text
PONG
```

## 9. Verify Redis from Windows

```powershell
Test-NetConnection localhost -Port 6379
```

Expected:

```text
TcpTestSucceeded : True
```

Use this in `.env`:

```env
REDIS_URL=redis://127.0.0.1:6379
```

Using `127.0.0.1` avoids the Windows IPv6 `::1` localhost issue seen in some setups.

## 10. Start the backend

PowerShell 1:

```powershell
cd C:\Projects\CANSAT\backend
node server.js
```

The API is normally:

```text
http://localhost:5000
```

Test:

```text
http://localhost:5000/api/health
```

Expected:

```json
{
  "success": true,
  "message": "Backend is running."
}
```

Keep this window open.

## 11. Start the telemetry worker

PowerShell 2:

```powershell
cd C:\Projects\CANSAT\backend
node telemetryWorker.js
```

Expected startup is similar to:

```text
Starting telemetry worker...
Telemetry worker is ready.
```

Keep this window open.

The worker flow is:

```text
Redis Stream
→ batch processing
→ MySQL
→ Redis latest state
→ ACK
```

## 12. Start the frontend

PowerShell 3:

```powershell
cd C:\Projects\CANSAT\frontend
npm run dev
```

Normally:

```text
http://localhost:5173
```

Open that URL in the browser.

## 13. Normal startup order

Every normal local run:

### PowerShell 1

```powershell
docker start cansat-redis
```

### PowerShell 2

```powershell
cd C:\Projects\CANSAT\backend
node server.js
```

### PowerShell 3

```powershell
cd C:\Projects\CANSAT\backend
node telemetryWorker.js
```

### PowerShell 4

```powershell
cd C:\Projects\CANSAT\frontend
npm run dev
```

Shortcut:

```text
Docker/Redis → server.js → telemetryWorker.js → frontend
```

## 14. Test login and student creation

Create/login a school from the frontend.

Create a student using:

- Student Name
- Username
- Initial Password

Do not ask the user to manually enter a Satellite ID.

The backend generates IDs such as:

```text
SAT-0001
SAT-0002
SAT-0003
```

Check:

```sql
SELECT id, student_name, username, satellite_id, is_active
FROM login_system.students
ORDER BY id DESC;
```

Then:

```sql
SELECT satellite_id, is_active
FROM telemetry_system.satellites
ORDER BY satellite_id;
```

The same `satellite_id` should appear in both databases.

## 15. Configure the ESP8266

The current firmware contract requires only:

```text
SATELLITE_ID
CENTRAL_API_URL
FLEET_API_KEY
```

Example:

```text
SATELLITE_ID     = SAT-0001
CENTRAL_API_URL  = http://192.168.1.10:5000/api/v1/telemetry
FLEET_API_KEY    = your fleet key
```

Find your PC Wi-Fi IPv4 address:

```powershell
ipconfig
```

Use the Wi-Fi adapter IPv4 address.

Do not use:

```text
localhost
127.0.0.1
```

inside the ESP for a physical-device-to-PC test.

The ESP and PC must be reachable over the same Wi-Fi/hotspot.

Open Arduino Serial Monitor at:

```text
115200 baud
```

Successful requests should show:

```text
UTC time synchronized.
Central API HTTP status: 202
```

## 16. Telemetry data flow

```text
ESP8266
→ POST /api/v1/telemetry
→ fleet authentication
→ satellite validation
→ telemetry validation
→ SHA-256 packet_hash
→ Redis Stream
→ HTTP 202
→ telemetryWorker
→ MySQL telemetry history
→ Redis latest state
→ read APIs
→ React dashboard
```

The ESP does not connect directly to MySQL or Redis.

## 17. Verify Redis latest telemetry

```powershell
docker exec cansat-redis redis-cli HGET telemetry:latest SAT-0001
```

Replace `SAT-0001` with the actual Satellite ID.

## 18. Verify MySQL telemetry

```sql
SELECT
    satellite_id,
    COUNT(*) AS total_rows,
    MAX(event_time) AS latest_event_time,
    MAX(received_at) AS latest_received_at
FROM telemetry_system.telemetry_packets
WHERE satellite_id = 'SAT-0001'
GROUP BY satellite_id;
```

Recent packets:

```sql
SELECT
    event_time,
    received_at,
    satellite_id,
    temperature,
    humidity
FROM telemetry_system.telemetry_packets
WHERE satellite_id = 'SAT-0001'
ORDER BY received_at DESC
LIMIT 20;
```

Use `LIMIT` instead of trying to inspect thousands of rows manually in MySQL Workbench.

## 19. Current telemetry APIs

```text
POST /api/v1/telemetry
GET  /api/v1/telemetry/latest
GET  /api/v1/telemetry/student
GET  /api/v1/telemetry/history/:satelliteId
```

Example:

```text
http://localhost:5000/api/v1/telemetry/latest
```

## 20. What HTTP 202 means

`202 Accepted` means the Central API accepted the packet into the Redis queue.

The worker then stores the packet in MySQL.

So:

```text
202
≠
"MySQL insert is already finished"
```

It means:

```text
packet accepted for processing
```

## 21. Redis failure and recovery

When Redis is running:

```text
ESP → API → Redis → 202
```

When Redis is unavailable:

```text
ESP → API → Redis ✕
```

The API should return a controlled `503` rather than a false successful acceptance.

Packets that never reach the durable queue are not safely stored by the backend; the ESP must retry according to its firmware behavior.

Packets already inside Redis Stream remain available to the worker.

After Redis returns:

```text
Redis
→ worker reconnects
→ pending Stream packets
→ MySQL commit
→ latest-state update
→ ACK
```

## 22. Failure test

Stop Redis:

```powershell
docker stop cansat-redis
```

Send telemetry and verify the API does not falsely return a successful `2xx` acceptance.

Start Redis:

```powershell
docker start cansat-redis
```

Check:

```powershell
docker exec cansat-redis redis-cli PING
```

Expected:

```text
PONG
```

Then watch the worker for recovery.

## 23. Important troubleshooting

### Redis error:

```text
ECONNREFUSED ::1:6379
```

Use:

```env
REDIS_URL=redis://127.0.0.1:6379
```

Restart both:

```powershell
node server.js
```

```powershell
node telemetryWorker.js
```

### ESP shows HTTP `-1`

Check:

```powershell
ipconfig
```

Then verify:

- ESP and PC are on the same network.
- ESP uses the PC Wi-Fi IPv4 address.
- Port 5000 is allowed by Windows Firewall.
- Hotspot client isolation is not blocking devices.
- Backend is running.

### ESP shows 202 but MySQL appears empty

Check:

1. Worker is running.
2. Redis gives `PONG`.
3. Worker has no MySQL errors.
4. Telemetry DB `.env` values are correct.
5. Satellite ID is correct.
6. Use `ORDER BY received_at DESC LIMIT 20`.

### Worker says processed/acknowledged

That means it processed Stream entries. If data is unexpected, inspect the worker's errors and the MySQL query result. ACK should happen after successful processing.

### MySQL Workbench does not show the full table

Use:

```sql
ORDER BY received_at DESC
LIMIT 20;
```

The Workbench grid display is not the same thing as the number of rows stored.

## 24. Student deletion

When a school/admin deletes a student:

```text
Login DB student deleted
        ↓
read satellite_id
        ↓
Telemetry DB satellite deactivated
        ↓
is_active = 0
```

This is part of the current tested student lifecycle.

## 25. GitHub safety

Commit:

```text
.env.example
```

Never commit:

```text
.env
passwords
Fleet API keys
private credentials
```

Before pushing:

```powershell
git status
```

## 26. Production / 1200+ satellite work

The current core pipeline is working, but local success does not prove production capacity.

Before production, complete:

```text
[ ] Redis failure/recovery test
[ ] MySQL failure/recovery test
[ ] Worker restart/recovery test
[ ] Invalid packet test
[ ] Duplicate packet test
[ ] Out-of-order packet test
[ ] Burst traffic test
[ ] MySQL index and connection tuning
[ ] Telemetry table partitioning when volume requires it
[ ] Redis persistence/recovery verification
[ ] Worker retry + dead-letter handling
[ ] Monitoring and alerts
[ ] Throttled realtime dashboard updates
[ ] Dashboard pagination/virtualization
[ ] Backup + restore test
[ ] HTTPS deployment
[ ] Production secrets management
[ ] Load test >=600 packets/sec for 1,200 satellites
[ ] Load test >=1,000 packets/sec for a 2,000-satellite envelope
```

The architecture is designed around 1,200+ satellites, but real capacity must be validated by load testing.

## 27. Final quick checklist

```text
[ ] MySQL running
[ ] login_system created
[ ] telemetry_system created
[ ] Login schema loaded
[ ] Telemetry schema loaded
[ ] backend .env created
[ ] .env not committed
[ ] REDIS_URL = redis://127.0.0.1:6379
[ ] Docker Desktop running
[ ] cansat-redis running
[ ] Redis PING = PONG
[ ] server.js running
[ ] telemetryWorker.js running
[ ] /api/health works
[ ] frontend running
[ ] school login works
[ ] student creation works
[ ] SAT-0001-style ID generated automatically
[ ] ESP has SATELLITE_ID
[ ] ESP has CENTRAL_API_URL
[ ] ESP has FLEET_API_KEY
[ ] ESP and PC are reachable
[ ] ESP gets 202
[ ] Worker processes packets
[ ] MySQL receives packets
[ ] Redis latest state receives packets
[ ] Student sees only assigned telemetry
[ ] School/admin deletion deactivates linked satellite
```

## 28. One-line startup memory

```text
Docker/Redis → node server.js → node telemetryWorker.js → npm run dev
```

## 29. One-line system memory

```text
ESP8266 → Central API → Redis Stream → Worker → MySQL + Redis latest → APIs → React Dashboard
```
