# AGACIRO DRIVERS – MVP

Self-contained MVP for a Kigali night safety ride service (Vite + React + Tailwind).

## Run locally
```bash
npm install
npm run dev
```
Open the shown localhost URL.

## Features
- Rider: select pickup & destination (preset POIs), see distance and **RWF** price, request ride.
- Driver: go Online/Offline, **Accept/Reject** requests.
- Simulation: driver moves to pickup, then to dropoff.
- Dispatcher: monitor rides, force-assign, view fleet & revenue.

## Production TODO
- Replace MapStub with Google Maps SDK (Places + Distance Matrix).
- Realtime backend (Supabase/Firebase) for Ride/Driver models.
- MTN MoMo / Airtel Money integration and phone masking.
