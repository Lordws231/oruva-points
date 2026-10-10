import { Router } from "express";
import {
  LOCATION_PIN,
  MAX_PINS_PER_DAY,
  MIN_PIN_DISTANCE_M,
  epochId,
  haversineMeters,
  isValidLatLng,
} from "@oruva/shared";
import {
  insertPin,
  lastPin,
  pinsToday,
  userPins,
} from "../db.js";
import { requireAuth, type AuthedRequest } from "../session.js";

export const locationRouter = Router();
locationRouter.use(requireAuth);

interface PinBody {
  lat?: number;
  lng?: number;
  /** Optional free-text area label (user-supplied; geocoding is not done server-side). */
  city?: string;
}

/**
 * POST /api/location — share a live area pinpoint.
 * Rules: valid lat/lng, <=10 pins/day, >=100 m from previous pin.
 */
locationRouter.post("/", (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const { lat, lng, city } = (req.body ?? {}) as PinBody;

  if (typeof lat !== "number" || typeof lng !== "number" || !isValidLatLng(lat, lng)) {
    res.status(400).json({ error: "valid lat (-90..90) and lng (-180..180) required" });
    return;
  }

  if (pinsToday(userId) >= MAX_PINS_PER_DAY) {
    res.status(429).json({
      error: `daily cap reached (${MAX_PINS_PER_DAY} pins/day)`,
    });
    return;
  }

  const prev = lastPin(userId);
  if (prev) {
    const d = haversineMeters(prev.lat, prev.lng, lat, lng);
    if (d < MIN_PIN_DISTANCE_M) {
      res.status(422).json({
        error: `too close to your previous pin (${Math.round(
          d
        )} m < ${MIN_PIN_DISTANCE_M} m minimum) — move to a new area`,
      });
      return;
    }
  }

  const pin = insertPin(
    userId,
    lat,
    lng,
    typeof city === "string" && city.trim() ? city.trim().slice(0, 120) : null,
    epochId(),
    LOCATION_PIN
  );
  res.status(201).json({ ok: true, pin, points: LOCATION_PIN });
});

/** GET /api/location/mine — caller's pins, newest first. */
locationRouter.get("/mine", (req: AuthedRequest, res) => {
  res.json({ pins: userPins(req.xUserId!) });
});
