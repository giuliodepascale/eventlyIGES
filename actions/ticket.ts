"use server";

import { db } from "@/lib/db";
import { Ticket } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

export async function createTicketActionandUpdateSold(
  eventId: string,
  userId: string,
  ticketTypeId: string,
  paymentStripeId: string,
  methodPaymentId: string,
  paid: number
): Promise<{ success: boolean; ticket?: Ticket; error?: string }> {
  try {
    // Genera un codice univoco per il biglietto (QR Code)
    const ticketCode = uuidv4();

    const ticketType = await db.ticketType.findUnique({
      where: {
        id: ticketTypeId,
      },
    });

    // Check if ticket type exists
    if (!ticketType) {
      throw new Error("Ticket type not found");
    }

    // Use a transaction to ensure both operations succeed or fail together
    const result = await db.$transaction(async (tx) => {
      // Update the sold count for the ticket type
      const updatedTicketType = await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { sold: { increment: 1 } },
      });

      // Creazione del biglietto nel database
      const ticket = await tx.ticket.create({
        data: {
          eventId,
          userId,
          ticketTypeId,
          qrCode: ticketCode,
          isValid: true,
          paymentStripeId,
          methodPaymentId,
          paid,
        },
      });

      return { ticket, updatedTicketType };
    });

    console.log("✅ Biglietto creato con successo:", result.ticket);
    console.log("✅ Contatore biglietti venduti aggiornato:", result.updatedTicketType.sold);
    
    return { success: true, ticket: result.ticket };
  } catch (error) {
    console.error("❌ Errore nella creazione del biglietto:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Errore nella creazione del biglietto" 
    };
  }
}
