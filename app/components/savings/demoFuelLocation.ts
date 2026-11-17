/**
 * DEMO ONLY — mock "card used away from the car" fuelings for the pool fueling view.
 *
 * The backend does not yet record where the pump is or where the car was at the moment the fuel
 * card was swiped. Until it does, these mock fuelings are merged into the connected-fueling data
 * so the check can be shown in demos. Each one is a swipe on a pool car's card at a pump several
 * km from where that car's GPS put it at the same minute, so the fuel most likely went into
 * another vehicle. Remove this module once the backend returns LOCATION_MISMATCH flags itself.
 */
import type { FuelFlag, PoolFueling } from "./types";

type ConnectedFueling = Extract<PoolFueling, { status: "CONNECTED" }>;
type Place = { name: string; lat: number; lng: number };

const MOCKS: { day: number; hour: number; minute: number; litres: number; pump: Place; car: Place }[] = [
  {
    day: 3,
    hour: 13,
    minute: 42,
    litres: 28.4,
    pump: { name: "PSO Korangi Crossing", lat: 24.8312, lng: 67.1268 },
    car: { name: "Clifton Block 5", lat: 24.8141, lng: 67.0297 },
  },
  {
    day: 8,
    hour: 11,
    minute: 17,
    litres: 31.6,
    pump: { name: "PSO Gulshan Chowrangi", lat: 24.9237, lng: 67.0928 },
    car: { name: "I.I. Chundrigar Road", lat: 24.8492, lng: 67.0043 },
  },
  {
    day: 12,
    hour: 16,
    minute: 5,
    litres: 24.9,
    pump: { name: "PSO North Nazimabad Block H", lat: 24.9418, lng: 67.0402 },
    car: { name: "Port Qasim", lat: 24.7896, lng: 67.3304 },
  },
];
const PRICE_PER_LITRE = 266.1;

function distanceKm(a: Place, b: Place) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/**
 * Adds the mock fuelings that fall inside the period (from/to are YYYY-MM-DD, PKT) to the
 * error list, the error KPI, and the affected car's and card's totals.
 */
export function withDemoLocationMismatches(fu: ConnectedFueling, range?: { from: string; to: string }): ConnectedFueling {
  if (!range) return fu;
  const cards = fu.cards.filter((c) => c.plate_number);
  if (!cards.length) return fu;
  const [y, m] = range.from.split("-").map(Number);
  const nowMs = Date.now();

  const added: { flag: FuelFlag; cardId: number; amount: number }[] = [];
  MOCKS.forEach((mock, i) => {
    const day = `${y}-${String(m).padStart(2, "0")}-${String(mock.day).padStart(2, "0")}`;
    if (day < range.from || day > range.to) return;
    const at = new Date(Date.UTC(y, m - 1, mock.day, mock.hour - 5, mock.minute)); // PKT = UTC+5
    if (at.getTime() > nowMs) return;
    const card = cards[(i * 2 + 1) % cards.length];
    const amount = Math.round(mock.litres * PRICE_PER_LITRE);
    added.push({
      cardId: card.id,
      amount,
      flag: {
        transaction_id: -(i + 1),
        transacted_at: at.toISOString(),
        plate_number: card.plate_number,
        station_name: mock.pump.name,
        litres: mock.litres,
        amount_pkr: amount,
        type: "LOCATION_MISMATCH",
        odometer_km: null,
        trip_km: null,
        km_per_litre: null,
        rated_km_per_litre: null,
        hours_since_previous: null,
        pump_location: { lat: mock.pump.lat, lng: mock.pump.lng },
        vehicle_location: { lat: mock.car.lat, lng: mock.car.lng, label: mock.car.name },
        distance_km: distanceKm(mock.pump, mock.car),
      },
    });
  });
  if (!added.length) return fu;

  const litres = added.reduce((s, a) => s + a.flag.litres, 0);
  const spend = added.reduce((s, a) => s + a.amount, 0);
  const bump = (c: ConnectedFueling["kpis"]["litres"], by: number) => {
    const current = (c.current ?? 0) + by;
    return {
      ...c,
      current,
      delta_pct: c.previous ? Math.round(((current - c.previous) / Math.abs(c.previous)) * 1000) / 10 : null,
    };
  };

  return {
    ...fu,
    kpis: {
      ...fu.kpis,
      litres: bump(fu.kpis.litres, litres),
      spend_pkr: bump(fu.kpis.spend_pkr, spend),
      flagged_fuelings: bump(fu.kpis.flagged_fuelings, added.length),
    },
    cards: fu.cards.map((c) => {
      const mine = added.filter((a) => a.cardId === c.id);
      if (!mine.length) return c;
      return {
        ...c,
        fuelings: c.fuelings + mine.length,
        litres: Math.round((c.litres + mine.reduce((s, a) => s + a.flag.litres, 0)) * 10) / 10,
        spent_pkr: c.spent_pkr + mine.reduce((s, a) => s + a.amount, 0),
      };
    }),
    vehicles: fu.vehicles.map((v) => {
      const mine = added.filter((a) => a.flag.plate_number === v.plate_number);
      if (!mine.length) return v;
      return {
        ...v,
        flags: v.flags + mine.length,
        litres: Math.round((v.litres + mine.reduce((s, a) => s + a.flag.litres, 0)) * 10) / 10,
        spend_pkr: v.spend_pkr + mine.reduce((s, a) => s + a.amount, 0),
      };
    }),
    flags: [...fu.flags, ...added.map((a) => a.flag)].sort((a, b) => b.transacted_at.localeCompare(a.transacted_at)),
  };
}
