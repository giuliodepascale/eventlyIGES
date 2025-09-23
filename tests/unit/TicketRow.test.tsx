/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TicketRow from "@/components/typetickets/ticket-row";


// Silenzia errori previsti nei test di errore (opzionale)
jest.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
  // Mock fetch e alert
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
};

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: "t1",
  name: "Early Bird",
  description: "Ingresso con posto riservato",
  price: 12.5,
  ...overrides,
});

const clickBuy = () =>
  fireEvent.click(screen.getByRole("button", { name: /acquista|attendi/i }));

describe("TicketRow (unit)", () => {
  test("render base: nome, descrizione, prezzo, bottone", () => {
    const t = makeTicket({ price: 9.99 });
    render(<TicketRow typeTicket={t as any} userId="user-1" />);
    expect(screen.getByText(t.name)).toBeInTheDocument();
    expect(screen.getByText(t.description!)).toBeInTheDocument();
    expect(screen.getByText(/€\s*9\.99/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /acquista/i })).toBeInTheDocument();
  });

  test("utente non loggato: mostra alert e NON chiama fetch", async () => {
    const t = makeTicket();
    render(<TicketRow typeTicket={t as any} userId="" />);

    clickBuy();

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Devi essere loggato per acquistare un biglietto."
      );
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("happy path: POST a /api/stripe/create-checkout-session con payload corretto; nessun alert errore", async () => {
    const t = makeTicket({ id: "T-123" });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ url: "https://checkout.stripe.com/session_abc" }),
    });

    render(<TicketRow typeTicket={t as any} userId="U-999" />);

    clickBuy();

    // Verifica fetch e payload
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/stripe/create-checkout-session");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body as string)).toEqual({
      ticketId: "T-123",
      userId: "U-999",
    });

    // Nessun alert di errore nel caso di successo
    expect(window.alert).not.toHaveBeenCalled();
  });

  test("errore API (nessuna url): mostra alert con messaggio errore", async () => {
    const t = makeTicket();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ error: "Sessione non disponibile" }),
    });

    render(<TicketRow typeTicket={t as any} userId="U-1" />);

    clickBuy();

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Errore nel checkout: Sessione non disponibile"
      );
    });
  });

  test("eccezione rete (fetch reject): mostra alert generico", async () => {
    const t = makeTicket();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    render(<TicketRow typeTicket={t as any} userId="U-2" />);

    clickBuy();

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Errore imprevisto durante il checkout."
      );
    });
  });

  test("loading: il bottone è disabled durante la richiesta e mostra 'Attendi…'", async () => {
    const t = makeTicket();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ url: "https://ok" }),
    });

    render(<TicketRow typeTicket={t as any} userId="U-3" />);

    const btn = screen.getByRole("button", { name: /acquista/i });
    expect(btn).not.toBeDisabled();

    clickBuy();

    // Subito dopo il click: label “Attendi…” e disabled
    const waitingBtn = screen.getByRole("button", { name: /attendi/i });
    expect(waitingBtn).toBeDisabled();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });
});
