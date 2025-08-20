import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * AGACIRO DRIVERS — MVP+ Demo
 * End-to-end flow with no external SDKs.
 * Swap MapStub with Google Maps + Distance Matrix API for production.
 */

// --- Kigali POIs (approx) ---
const PLACES = [
  { name: "Kiyovu - CBD", lat: -1.9506, lng: 30.0605 },
  { name: "Remera - Amahoro", lat: -1.9622, lng: 30.1182 },
  { name: "Kimironko Market", lat: -1.9365, lng: 30.1180 },
  { name: "Nyamirambo", lat: -1.9689, lng: 30.0415 },
  { name: "Gishushu / Kigali Heights", lat: -1.9536, lng: 30.0955 },
  { name: "Kacyiru", lat: -1.9397, lng: 30.0822 },
  { name: "Kibagabaga", lat: -1.9146, lng: 30.1254 },
];

// Vehicles
const VEHICLES = [
  { id: "VEH-01", make: "Toyota", model: "Vitz", plate: "RAB 123 A", color: "Silver", seats: 4 },
  { id: "VEH-02", make: "Suzuki", model: "Swift", plate: "RAC 456 B", color: "Red", seats: 4 },
  { id: "VEH-03", make: "Toyota", model: "Corolla", plate: "RAD 789 C", color: "Blue", seats: 4 },
  { id: "VEH-04", make: "Toyota", model: "Yaris", plate: "RAE 321 D", color: "Black", seats: 4 },
];

// Drivers with approximate positions
const initialDrivers = [
  { id: "DRV-01", name: "Eric N.", phone: "+250 780 001 111", rating: 4.8, vehicleId: "VEH-01", status: "online", lat: -1.955, lng: 30.095 },
  { id: "DRV-02", name: "Aline M.", phone: "+250 720 002 222", rating: 4.7, vehicleId: "VEH-02", status: "online", lat: -1.945, lng: 30.083 },
  { id: "DRV-03", name: "Patrick K.", phone: "+250 730 003 333", rating: 4.9, vehicleId: "VEH-03", status: "offline", lat: -1.968, lng: 30.045 },
  { id: "DRV-04", name: "Keza I.", phone: "+250 790 004 444", rating: 4.6, vehicleId: "VEH-04", status: "online", lat: -1.962, lng: 30.118 },
];

// Helpers
const toFixed = (n, d = 1) => Number(n.toFixed(d));

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function pricing(distanceKm, now = new Date()) {
  const base = 1500;
  const perKm = 800;
  const isNight = now.getHours() >= 18 || now.getHours() < 5;
  const nightPct = isNight ? 0.3 : 0;
  const surge = distanceKm > 8 ? 1.1 : 1.0;
  const raw = base + perKm * distanceKm;
  const total = Math.round(raw * (1 + nightPct) * surge);
  return {
    total,
    surge,
    breakdown: { base, perKm, distanceKm: toFixed(distanceKm, 1), nightPct }
  };
}

function formatRWF(amount) {
  return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(amount) + " RWF";
}

// UI atoms
function Chip({ color = "gray", children }) {
  const map = {
    gray: "bg-gray-100 text-gray-800",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${map[color]}`}>{children}</span>;
}
function Stat({ label, value }) {
  return (
    <div className="p-4 rounded-2xl shadow bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

// Map stub
function MapStub({ pickup, dropoff, drivers }) {
  const minLat = -1.98, maxLat = -1.90, minLng = 30.04, maxLng = 30.14;
  const project = (lat, lng) => ({
    x: ((lng - minLng) / (maxLng - minLng)) * 100,
    y: (1 - (lat - minLat) / (maxLat - minLat)) * 100,
  });
  const p = pickup ? project(pickup.lat, pickup.lng) : null;
  const d = dropoff ? project(dropoff.lat, dropoff.lng) : null;
  const pts = drivers.map(dr => ({ id: dr.id, status: dr.status, ...project(dr.lat, dr.lng) }));
  return (
    <svg viewBox="0 0 100 100" className="w-full h-72 rounded-2xl bg-white shadow">
      {[...Array(10)].map((_,i)=> (
        <g key={i}>
          <line x1="0" x2="100" y1={i*10} y2={i*10} stroke="#f1f5f9" strokeWidth="0.4" />
          <line x1={i*10} x2={i*10} y1="0" y2="100" stroke="#f1f5f9" strokeWidth="0.4" />
        </g>
      ))}
      {p && (<g><circle cx={p.x} cy={p.y} r="2.2" fill="#059669" /><text x={p.x+2.8} y={p.y-1} fontSize="3" fill="#064e3b">Pickup</text></g>)}
      {d && (<g><circle cx={d.x} cy={d.y} r="2.2" fill="#f59e0b" /><text x={d.x+2.8} y={d.y-1} fontSize="3" fill="#92400e">Dropoff</text></g>)}
      {pts.map(pt => (<rect key={pt.id} x={pt.x-1.8} y={pt.y-1.8} width="3.6" height="3.6" rx="0.6" fill={pt.status==='online' ? '#0ea5e9' : '#94a3b8'} />))}
    </svg>
  );
}

// Customer
function CustomerTab({ drivers, rides, setRides, pushDriverRequest }) {
  const [pickupQuery, setPickupQuery] = useState(PLACES[0].name);
  const [dropoffQuery, setDropoffQuery] = useState(PLACES[1].name);
  const [selectedPickup, setSelectedPickup] = useState(PLACES[0]);
  const [selectedDrop, setSelectedDrop] = useState(PLACES[1]);
  const [phone, setPhone] = useState("");
  const [chooseDriver, setChooseDriver] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [method, setMethod] = useState("cash");

  const km = useMemo(() => toFixed(haversineKm(selectedPickup, selectedDrop), 1), [selectedPickup, selectedDrop]);
  const { total, breakdown, surge } = useMemo(() => pricing(km), [km]);

  const availableDrivers = drivers.filter(d => d.status === 'online');

  const create = () => {
    if (!phone) { alert("Enter phone number"); return; }
    if (chooseDriver && !driverId) { alert("Choose a driver or turn off 'Choose driver'"); return; }
    const id = `RID-${(Math.random()*100000).toFixed(0)}`;
    const ride = {
      id,
      riderPhone: phone,
      pickup: selectedPickup,
      dropoff: selectedDrop,
      kmEstimate: km,
      price: total,
      status: chooseDriver ? 'DRIVER_PENDING' : 'REQUESTED',
      driverId: chooseDriver ? driverId : null,
      payment: { method, status: 'unpaid' },
      surge,
      breakdown,
      timeline: { requestedAt: Date.now() }
    };
    setRides([ride, ...rides]);
    pushDriverRequest(ride);
  };

  const bookingsToday = rides.length;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 p-5 rounded-2xl bg-white shadow">
        <div className="text-xl font-semibold mb-4">Book a Safe Night Ride</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Pickup</label>
            <input list="pickup-list" value={pickupQuery} onChange={e=>{setPickupQuery(e.target.value); const hit = PLACES.find(p=>p.name===e.target.value); if (hit) setSelectedPickup(hit);}} className="w-full mt-1 rounded-xl border p-2" />
            <datalist id="pickup-list">{PLACES.map(p=> <option key={p.name} value={p.name} />)}</datalist>
          </div>
          <div>
            <label className="text-sm text-gray-600">Destination</label>
            <input list="drop-list" value={dropoffQuery} onChange={e=>{setDropoffQuery(e.target.value); const hit = PLACES.find(p=>p.name===e.target.value); if (hit) setSelectedDrop(hit);}} className="w-full mt-1 rounded-xl border p-2" />
            <datalist id="drop-list">{PLACES.map(p=> <option key={p.name} value={p.name} />)}</datalist>
          </div>
          <div>
            <label className="text-sm text-gray-600">Client Phone</label>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g., +2507XXXXXXX" className="w-full mt-1 rounded-xl border p-2" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Payment</label>
            <select value={method} onChange={e=>setMethod(e.target.value)} className="w-full mt-1 rounded-xl border p-2">
              {['cash','momo','card'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <MapStub pickup={selectedPickup} dropoff={selectedDrop} drivers={drivers} />
        </div>

        <div className="mt-5 grid md:grid-cols-3 gap-4">
          <div className="p-3 rounded-2xl bg-gray-50">
            <div className="text-sm text-gray-600">Distance</div>
            <div className="text-xl font-semibold">{km} km</div>
          </div>
          <div className="p-3 rounded-2xl bg-gray-50">
            <div className="text-sm text-gray-600">Estimated Price</div>
            <div className="text-xl font-semibold">{formatRWF(total)}</div>
            <div className="text-xs text-gray-500">Base {formatRWF(breakdown.base)} + {formatRWF(breakdown.perKm)} /km • Night +{Math.round(breakdown.nightPct*100)}% • Surge x{surge}</div>
          </div>
          <div className="p-3 rounded-2xl bg-gray-50">
            <div className="text-sm text-gray-600">Driver Selection</div>
            <label className="flex items-center gap-2 text-sm mt-1"><input type="checkbox" checked={chooseDriver} onChange={e=>setChooseDriver(e.target.checked)} />Choose driver manually</label>
            {chooseDriver && (
              <select value={driverId} onChange={e=>setDriverId(e.target.value)} className="w-full mt-2 rounded-xl border p-2">
                <option value="">Select available driver</option>
                {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.name} • {d.rating}★</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-5">
          <button onClick={create} className="px-5 py-3 rounded-2xl bg-gray-900 text-white font-semibold">Request Ride</button>
          <div className="text-sm text-gray-600">Bookings today: {bookingsToday}</div>
        </div>
      </div>

      <div className="space-y-3">
        <Stat label="Online drivers" value={drivers.filter(d=>d.status==='online').length} />
        <div className="p-4 rounded-2xl bg-white shadow">
          <div className="font-semibold mb-2">Recent Requests</div>
          <div className="space-y-2 max-h-80 overflow-auto">
            {rides.map(r => (
              <div key={r.id} className="p-2 rounded-xl border text-sm">
                <div className="font-medium">{r.pickup.name} → {r.dropoff.name}</div>
                <div>{r.kmEstimate} km • {formatRWF(r.price)} • <Chip color={r.status==='DRIVER_ACCEPTED'||r.status==='EN_ROUTE'||r.status==='ARRIVED'||r.status==='IN_TRIP'?'emerald':'amber'}>{r.status.replaceAll('_',' ')}</Chip></div>
                <div className="text-xs text-gray-500 mt-1">{r.driverId || 'Unassigned'}</div>
              </div>
            ))}
            {rides.length===0 && <div className="text-gray-500 text-sm">No bookings yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Driver
function DriverTab({ drivers, setDrivers, driverInbox, acceptRide, rejectRide }) {
  const toggleOnline = (id) => setDrivers(prev => prev.map(d => d.id===id ? { ...d, status: d.status==='online' ? 'offline' : 'online' } : d));
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <div className="p-4 rounded-2xl bg-white shadow">
          <div className="font-semibold mb-2">Incoming Requests</div>
          <div className="space-y-2 max-h-96 overflow-auto">
            {driverInbox.map(req => (
              <div key={req.ride.id+req.targetId} className="p-3 rounded-2xl border text-sm">
                <div className="font-medium">{req.ride.pickup.name} → {req.ride.dropoff.name}</div>
                <div className="text-gray-600">{req.ride.kmEstimate} km • {formatRWF(req.ride.price)}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={()=>acceptRide(req.ride.id, req.targetId)} className="px-3 py-1.5 rounded-xl bg-gray-900 text-white">Accept</button>
                  <button onClick={()=>rejectRide(req.ride.id, req.targetId)} className="px-3 py-1.5 rounded-xl bg-gray-100">Reject</button>
                </div>
              </div>
            ))}
            {driverInbox.length===0 && <div className="text-gray-500">No new requests.</div>}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-white shadow">
          <div className="font-semibold mb-2">My Status</div>
          {drivers.map(d => (
            <div key={d.id} className="flex items-center justify-between border rounded-xl p-2 text-sm mb-2">
              <div>
                <div className="font-medium">{d.name} <span className="text-xs text-gray-500">({d.rating}★)</span></div>
                <div className="text-gray-600">{VEHICLES.find(v=>v.id===d.vehicleId)?.model} • {VEHICLES.find(v=>v.id===d.vehicleId)?.plate}</div>
              </div>
              <div className="flex items-center gap-2">
                <Chip color={d.status==='online'?'emerald':'gray'}>{d.status}</Chip>
                <button onClick={()=>toggleOnline(d.id)} className="px-3 py-1 rounded-xl bg-gray-900 text-white">Toggle</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Dispatcher
function DispatcherTab({ drivers, setDrivers, rides, forceAssign }) {
  const revenue = useMemo(() => rides.reduce((s,r)=> s + (r.price || 0), 0), [rides]);
  const active = rides.filter(r => ["REQUESTED","DRIVER_PENDING","DRIVER_ACCEPTED","EN_ROUTE","ARRIVED","IN_TRIP"].includes(r.status)).length;
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 p-5 rounded-2xl bg-white shadow">
        <div className="text-xl font-semibold mb-4">Live Dispatch</div>
        <div className="grid md:grid-cols-2 gap-3">
          {rides.map(r => (
            <div key={r.id} className="p-3 rounded-2xl border">
              <div className="font-medium">{r.pickup.name} → {r.dropoff.name}</div>
              <div className="text-sm text-gray-600">{r.kmEstimate} km • {formatRWF(r.price)} • <Chip color={['EN_ROUTE','IN_TRIP','DRIVER_ACCEPTED'].includes(r.status)?'emerald':'amber'}>{r.status.replaceAll('_',' ')}</Chip></div>
              <div className="mt-2 text-sm text-gray-600">Driver: {r.driverId || '—'}</div>
              {(!r.driverId || r.status==='REQUESTED' || r.status==='DRIVER_PENDING') && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {drivers.filter(d=>d.status==='online').map(d => (
                    <button key={d.id} onClick={()=>forceAssign(r.id, d.id)} className="px-3 py-1 rounded-xl bg-gray-900 text-white text-sm">Assign {d.name}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {rides.length === 0 && <div className="text-gray-500 text-sm">No rides yet.</div>}
        </div>
      </div>
      <div className="space-y-3">
        <Stat label="Active rides" value={active} />
        <Stat label="Gross revenue (today)" value={formatRWF(revenue)} />
        <div className="p-4 rounded-2xl bg-white shadow">
          <div className="font-semibold mb-2">Fleet Status</div>
          <div className="space-y-2 max-h-80 overflow-auto">
            {drivers.map(d => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded-xl border text-sm">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-gray-600">{VEHICLES.find(v=>v.id===d.vehicleId)?.model} • {VEHICLES.find(v=>v.id===d.vehicleId)?.plate}</div>
                </div>
                <Chip color={d.status==='online'?'emerald':(d.status==='on_trip'?'sky':'gray')}>{d.status}</Chip>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("Customer");
  const [drivers, setDrivers] = useState(initialDrivers);
  const [rides, setRides] = useState([]);
  const [driverInbox, setDriverInbox] = useState([]); // [{ ride, targetId }]

  const pushDriverRequest = (ride) => {
    const targets = ride.driverId ? drivers.filter(d=>d.id===ride.driverId) : drivers.filter(d=>d.status==='online');
    const payloads = targets.map(t => ({ ride, targetId: t.id }));
    setDriverInbox(prev => [...payloads, ...prev]);
  };

  const acceptRide = (rideId, driverId) => {
    setDriverInbox(prev => prev.filter(r => !(r.ride.id===rideId && r.targetId===driverId)));
    setRides(prev => prev.map(r => r.id===rideId ? { ...r, driverId, status: 'DRIVER_ACCEPTED', timeline: { ...r.timeline, acceptedAt: Date.now() } } : r));
    setDrivers(prev => prev.map(d => d.id===driverId ? { ...d, status: 'on_trip' } : d));
  };
  const rejectRide = (rideId, driverId) => {
    setDriverInbox(prev => prev.filter(r => !(r.ride.id===rideId && r.targetId===driverId)));
  };

  const forceAssign = (rideId, driverId) => acceptRide(rideId, driverId);

  const tickRef = useRef(null);
  useEffect(() => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      setRides(prev => prev.map(ride => {
        if (!ride.driverId) return ride;
        const drv = drivers.find(d=>d.id===ride.driverId);
        if (!drv) return ride;
        let target = null;
        if (ride.status === 'DRIVER_ACCEPTED') { target = ride.pickup; }
        if (ride.status === 'EN_ROUTE') { target = ride.pickup; }
        if (ride.status === 'ARRIVED') { return ride; }
        if (ride.status === 'IN_TRIP') { target = ride.dropoff; }
        if (ride.status === 'COMPLETED') { return ride; }

        if (target) {
          setDrivers(curr => curr.map(d => {
            if (d.id !== ride.driverId) return d;
            const step = 0.0007;
            const dx = target.lng - d.lng;
            const dy = target.lat - d.lat;
            const dist = Math.hypot(dx, dy);
            if (dist < step) {
              if (ride.status === 'DRIVER_ACCEPTED' || ride.status === 'EN_ROUTE') {
                ride = { ...ride, status: 'ARRIVED', timeline: { ...ride.timeline, arrivedAt: Date.now() } };
              } else if (ride.status === 'IN_TRIP') {
                ride = { ...ride, status: 'COMPLETED', timeline: { ...ride.timeline, completedAt: Date.now() } };
                setDrivers(cur2 => cur2.map(dd => dd.id===d.id ? { ...dd, status: 'online' } : dd));
              }
              return { ...d, lat: target.lat, lng: target.lng };
            }
            const nx = d.lng + (dx / dist) * step;
            const ny = d.lat + (dy / dist) * step;
            return { ...d, lng: nx, lat: ny };
          }));
          if (ride.status === 'DRIVER_ACCEPTED') {
            return { ...ride, status: 'EN_ROUTE' };
          }
        }
        return ride;
      }));
    }, 800);
    return () => clearInterval(tickRef.current);
  }, [drivers]);

  const startTrip = (rideId) => setRides(prev => prev.map(r => r.id===rideId ? { ...r, status: 'IN_TRIP', timeline: { ...r.timeline, startedAt: Date.now() } } : r));

  const completedCount = rides.filter(r=>r.status==='COMPLETED').length;
  const openCount = rides.filter(r=>['REQUESTED','DRIVER_PENDING','DRIVER_ACCEPTED','EN_ROUTE','ARRIVED','IN_TRIP'].includes(r.status)).length;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
          <div className="flex items-end gap-2">
            <div className="text-2xl font-black tracking-tight">AGACIRO <span className="text-gray-900">DRIVERS</span></div>
            <div className="text-xs text-gray-500 mb-1">Night Safety Rides</div>
          </div>
          <nav className="flex gap-2">
            {['Customer','Driver','Dispatcher'].map(t => (
              <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-2xl text-sm font-medium ${tab===t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>{t}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <section className="grid md:grid-cols-3 gap-4">
          <Stat label="Open rides" value={openCount} />
          <Stat label="Completed rides" value={completedCount} />
          <Stat label="Online drivers" value={drivers.filter(d=>d.status==='online').length} />
        </section>

        {tab === 'Customer' && (
          <>
            <CustomerTab drivers={drivers} rides={rides} setRides={setRides} pushDriverRequest={pushDriverRequest} />
            <div className="p-4 rounded-2xl bg-white shadow">
              <div className="font-semibold mb-2">Your Active Rides</div>
              <div className="space-y-2">
                {rides.filter(r=>['DRIVER_ACCEPTED','EN_ROUTE','ARRIVED','IN_TRIP'].includes(r.status)).map(r => (
                  <div key={r.id} className="p-3 border rounded-2xl text-sm">
                    <div className="font-medium">{r.pickup.name} → {r.dropoff.name} • {formatRWF(r.price)}</div>
                    <div className="mt-1">Status: <Chip color={['DRIVER_ACCEPTED','EN_ROUTE','ARRIVED','IN_TRIP'].includes(r.status)?'emerald':'amber'}>{r.status.replaceAll('_',' ')}</Chip> • Driver: {r.driverId}</div>
                    {r.status==='ARRIVED' && (
                      <button onClick={()=>startTrip(r.id)} className="mt-2 px-3 py-1.5 rounded-xl bg-gray-900 text-white">Start Trip</button>
                    )}
                  </div>
                ))}
                {rides.filter(r=>['DRIVER_ACCEPTED','EN_ROUTE','ARRIVED','IN_TRIP'].includes(r.status)).length===0 && <div className="text-gray-500 text-sm">No active rides.</div>}
              </div>
            </div>
          </>
        )}

        {tab === 'Driver' && (
          <DriverTab drivers={drivers} setDrivers={setDrivers} driverInbox={driverInbox} acceptRide={acceptRide} rejectRide={rejectRide} />
        )}

        {tab === 'Dispatcher' && (
          <DispatcherTab drivers={drivers} setDrivers={setDrivers} rides={rides} forceAssign={forceAssign} />
        )}

        <footer className="text-center text-xs text-gray-500 py-8">
          Demo MVP • Kigali • Pricing example: base 1,500 RWF + 800 RWF/km + 30% night premium • Surge dynamic
        </footer>
      </main>
    </div>
  );
}
