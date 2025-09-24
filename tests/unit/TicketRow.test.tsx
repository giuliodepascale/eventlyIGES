/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TicketRow from "@/components/typetickets/ticket-row";

// ========== Setup base ==========
jest.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = jest.fn();
  jest.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
});

type Ticket = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  active?: boolean;
  remaining?: number; // disponibilità residua
};

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: "T-OK",
  name: "Early Bird",
  description: "Ingresso con posto riservato",
  price: 12.5,
  active: true,
  remaining: 10,
  ...overrides,
});

const clickBuy = () =>
  fireEvent.click(screen.getByRole("button", { name: /acquista|attendi/i }));

// =============================================================
//                  RF_11 – Acquisto biglietti
// =============================================================
describe("RF_11 – Acquisto biglietti (TicketRow)", () => {
  // TC_1_RF_11 — Successo Acquisto biglietto
  it("TC_1_RF_11: success → crea la sessione di checkout", async () => {
    const t = makeTicket({ id: "T-123" });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ url: "https://checkout.stripe.com/session_abc" }),
    });

    render(<TicketRow typeTicket={t as any} userId="U-999" />);

    clickBuy();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toBe("/api/stripe/create-checkout-session");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body as string)).toEqual({
      ticketId: "T-123",
      userId: "U-999",
    });

    // Nessun errore mostrato
    expect(window.alert).not.toHaveBeenCalled();
  });

  // TC_1_1_RF_11 — Utente mancante (U2)
  it("TC_1_1_RF_11: userId mancante → mostra errore e NON chiama l'API", async () => {
    const t = makeTicket();
    render(<TicketRow typeTicket={t as any} userId="" />);

    clickBuy();

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // TC_1_2_RF_11 — Ticket inesistente (T2)
  it("TC_1_2_RF_11: ticket inesistente → API risponde errore, viene mostrato alert", async () => {
    const t = makeTicket({ id: "T-NOT-FOUND" });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ error: "Biglietto inesistente" }),
    });

    render(<TicketRow typeTicket={t as any} userId="U-1" />);

    clickBuy();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringMatching(/errore.*checkout/i)
      );
    });
  });

  // TC_1_3_RF_11 — Ticket non attivo (T3)
  it("TC_1_3_RF_11: ticket non attivo → API errore, mostra alert", async () => {
    const t = makeTicket({ id: "T-INACTIVE", active: false });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ error: "Biglietto non attivo" }),
    });

    render(<TicketRow typeTicket={t as any} userId="U-2" />);

    clickBuy();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringMatching(/errore.*checkout/i)
      );
    });
  });

  // TC_1_4_RF_11 — Ticket esaurito (T4)
  it("TC_1_4_RF_11: biglietti esauriti → API errore, mostra alert", async () => {
    const t = makeTicket({ id: "T-SOLDOUT", remaining: 0 });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ error: "Biglietti esauriti" }),
    });

    render(<TicketRow typeTicket={t as any} userId="U-3" />);

    clickBuy();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringMatching(/errore.*checkout/i)
      );
    });
  });

  // (facoltativo) rete giù → errore generico
  it("rete KO: reject fetch → mostra alert generico", async () => {
    const t = makeTicket();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    render(<TicketRow typeTicket={t as any} userId="U-4" />);

    clickBuy();

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringMatching(/imprevisto|generico|checkout/i)
      );
    });
  });

  // (facoltativo) stato loading
  it("loading: il bottone si disabilita durante la richiesta", async () => {
    const t = makeTicket();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ url: "https://ok" }),
    });

    render(<TicketRow typeTicket={t as any} userId="U-5" />);

    const btn = screen.getByRole("button", { name: /acquista/i });
    expect(btn).not.toBeDisabled();

    clickBuy();

    expect(screen.getByRole("button", { name: /attendi/i })).toBeDisabled();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });
});
