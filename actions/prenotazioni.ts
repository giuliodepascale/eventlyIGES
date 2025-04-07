// app/actions/bookingActions.ts
"use server";

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function createBookingAction(eventId: string, userId: string) {
  // Genera un codice univoco per la prenotazione
  const bookingCode = uuidv4();

  // Crea la prenotazione nel database con il codice generato
  const booking = await db.prenotazione.create({
    data: {
      eventId,
      userId,
      qrCode: bookingCode,
    },
  });

  return { booking };
}
