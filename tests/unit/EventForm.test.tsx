/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
// Forza timezone coerente alla logica del form
process.env.TZ = "Europe/Rome";

import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import EventForm from "@/components/events/event-form";

// ---------- MOCK dipendenze esterne ----------
jest.mock("@/components/altre/file-uploader", () => ({
  FileUploader: ({ onFieldChange, imageUrl, setFiles }: any) => (
    <div data-testid="file-uploader">Mock Uploader</div>
  ),
}));

// helper per settare/azzerare un <select> per id se disponibile
const setSelectValue = (id: string, value: string) => {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el) fireEvent.change(el, { target: { value } });
};

// ↑ mettilo vicino agli altri jest.mock
jest.mock("@/lib/map", () => ({
  getCoordinatesFromOSM: jest.fn().mockResolvedValue(null), // C2: coordinate assenti
}));

// createEvent/updateEvent: niente notifiche, risponde ok
jest.mock("@/actions/event", () => ({
  createEvent: jest.fn().mockResolvedValue({ ok: true }),
  updateEvent: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("@/lib/supabaseClient", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: "mock-url" } }),
      }),
    },
  },
}));

// ---- Mock "italia": aggiungo Lombardia/MI/Milano per il caso di test ----
jest.mock("italia", () => ({
  __esModule: true,
  default: {
    regioni: [
      { nome: "Campania", province: ["NA", "SA"] },
      { nome: "Lombardia", province: ["MI"] }, // ← usato nel test
    ],
    comuni: {
      regioni: [
        {
          province: [
            { code: "NA", comuni: [{ nome: "Napoli" }, { nome: "Pozzuoli" }] },
            { code: "SA", comuni: [{ nome: "Salerno" }, { nome: "Cava de' Tirreni" }] },
            { code: "MI", comuni: [{ nome: "Milano" }, { nome: "PaeseInesistente" }] }, // ← usato nel test
          ],
        },
      ],
    },
  },
}));

// ---- MUI Date/Time Picker → input nativi deterministici ----
jest.mock("@mui/x-date-pickers/AdapterDayjs", () => ({ AdapterDayjs: {} }));
jest.mock("@mui/x-date-pickers/LocalizationProvider", () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));
jest.mock("@mui/x-date-pickers/MobileDatePicker", () => ({
  MobileDatePicker: ({ onChange, value }: any) => (
    <input
      data-testid="date-picker"
      type="date"
      value={
        value
          ? (() => {
              const d = new Date(value.toDate ? value.toDate() : value);
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            })()
          : ""
      }
      onChange={(e) =>
        onChange &&
        onChange({
          toDate: () => new Date((e.target as HTMLInputElement).value),
        })
      }
    />
  ),
}));
jest.mock("@mui/x-date-pickers/MobileTimePicker", () => ({
  MobileTimePicker: ({ onChange, value, minutesStep }: any) => (
    <input
      data-testid="time-picker"
      type="time"
      step={(minutesStep ?? 5) * 60}
      value={
        value
          ? (() => {
              const d = new Date(value.toDate ? value.toDate() : value);
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            })()
          : ""
      }
      onChange={(e) =>
        onChange &&
        onChange({
          toDate: () => new Date(`2000-01-01T${(e.target as HTMLInputElement).value || "00:00"}`),
        })
      }
    />
  ),
}));

// ---- categorie per il Select (aggiunta "Musica") ----
jest.mock("@/components/altre/categories", () => ({
  categories: [
    { label: "Concerto" },
    { label: "Workshop" },
    { label: "Hackathon" },
    { label: "Open Day" },
    { label: "Musica" }, // ← usata nel test
  ],
}));
// ---- Mock shadcn/ui Select → <select> nativo ----
jest.mock("@/components/ui/select", () => {
  let lastId: string | undefined;

  return {
    Select: ({
      onValueChange,
      value,
      defaultValue,
      children,
      disabled,
    }: {
      onValueChange?: (v: string) => void;
      value?: string;
      defaultValue?: string;
      children?: React.ReactNode;
      disabled?: boolean;
    }) => (
      <select
        id={lastId}
        data-testid="select"
        value={value ?? defaultValue ?? ""}
        onChange={(e) => onValueChange && onValueChange(e.target.value)}
        disabled={disabled}
      >
        {/* placeholder/empty option per permettere valore vuoto */}
        <option value=""></option>
        {children}
      </select>
    ),
    SelectTrigger: ({ id }: { id?: string }) => { lastId = id; return null; },
    SelectContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectItem: ({ value, children }: { value: string; children?: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

// ---- Mock Input & Checkbox shadcn ----
jest.mock("@/components/ui/input", () => ({ Input: (p: any) => <input {...p} /> }));
jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ onCheckedChange, checked, className }: any) => (
    <input
      type="checkbox"
      aria-label="checkbox"
      className={className}
      checked={!!checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
    />
  ),
}));

// ---- Mock ResizeObserver per Radix ----
(global as any).ResizeObserver =
  (global as any).ResizeObserver ||
  class { observe() {} unobserve() {} disconnect() {} };

// ---------- Accesso al mock azioni ----------
const eventActions = require("@/actions/event");
const createEventMock = eventActions.createEvent as jest.Mock;

// ---------- Dati base ----------
const organization = {
  id: "org123", // ← come nella tabella
  nome: "Org Jazz",
  indirizzo: "Via Montenapoleone 10",
  comune: "Milano",
  provincia: "MI",
  regione: "Lombardia",
  email: "org@test.it",
} as any;

// ---------- Helper ----------
const pad = (n: number) => String(n).padStart(2, "0");
const setDateLocalString = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// ---------- Reset ----------
beforeEach(() => jest.clearAllMocks());
afterEach(() => cleanup());

// =============================================================
//          RF_10 – Gestione eventi (Creazione) : TC_1
// =============================================================
describe("RF_10 – TC_1_RF_10: Evento valido", () => {
  it("crea correttamente l'evento e reindirizza ai dettagli", async () => {
    render(<EventForm organization={organization} type="create" />);

    // Compila i campi secondo la tabella
    fireEvent.change(screen.getByLabelText(/Titolo/i), {
      target: { value: "Concerto Jazz" },
    });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), {
      target: { value: "Evento musicale di jazz con artisti locali" },
    });

    // Select: [0]=Categoria, [1]=Stato, [2]=Regione, [3]=Provincia, [4]=Comune
    const selects = screen.getAllByTestId("select");
    fireEvent.change(selects[0], { target: { value: "Musica" } });     // category
    fireEvent.change(selects[1], { target: { value: "pubblico" } });   // status
    fireEvent.change(selects[2], { target: { value: "Lombardia" } });  // regione
    fireEvent.change(selects[3], { target: { value: "MI" } });         // provincia
    fireEvent.change(selects[4], { target: { value: "Milano" } });     // comune

    fireEvent.change(screen.getByLabelText(/Indirizzo/i), {
      target: { value: "Via Montenapoleone 10" },
    });

    // Data/ora precise: 2025-10-10, 20:30
    fireEvent.change(screen.getByTestId("date-picker"), {
      target: { value: setDateLocalString(2025, 10, 10) },
    });
    fireEvent.change(screen.getByTestId("time-picker"), {
      target: { value: "20:30" },
    });

    // isReservationActive = true
    const checkbox = screen.getByLabelText("checkbox");
    fireEvent.click(checkbox);

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

    await waitFor(() => expect(createEventMock).toHaveBeenCalledTimes(1));
  });
});

it("TC_1_1_RF_10: Titolo troppo corto → mostra errore e NON crea l'evento", async () => {
  render(<EventForm organization={organization} type="create" />);

  // Flow of events (dalla tabella)
  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Hi" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  // Select: [0]=Categoria, [1]=Stato, [2]=Regione, [3]=Provincia, [4]=Comune
  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });     // category
  fireEvent.change(selects[1], { target: { value: "pubblico" } });   // status
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });  // regione
  fireEvent.change(selects[3], { target: { value: "MI" } });         // provincia
  fireEvent.change(selects[4], { target: { value: "Milano" } });     // comune

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), {
    target: { value: "Via Montenapoleone 10" },
  });

  // Data/ora precise
  fireEvent.change(screen.getByTestId("date-picker"), {
    target: { value: "2025-10-10" },
  });
  fireEvent.change(screen.getByTestId("time-picker"), {
    target: { value: "20:30" },
  });

  // isReservationActive = true
  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  // Submit
  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  // Oracle
  await waitFor(() => {
    expect(
      screen.getByText(/Il titolo deve contenere almeno 3 caratteri/i)
    ).toBeInTheDocument();
    expect(createEventMock).not.toHaveBeenCalled();
  });
});

it("TC_1_2_RF_10: Titolo troppo lungo → mostra errore e NON crea l'evento", async () => {
  render(<EventForm organization={organization} type="create" />);

  // Titolo > 50 caratteri
  const longTitle =
    "Concerto Jazz molto lungo che supera i cinquanta caratteri ed è invalido";
  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: longTitle } });

  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  // Select: [0]=Categoria, [1]=Stato, [2]=Regione, [3]=Provincia, [4]=Comune
  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });     // category
  fireEvent.change(selects[1], { target: { value: "pubblico" } });   // status
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });  // regione
  fireEvent.change(selects[3], { target: { value: "MI" } });         // provincia
  fireEvent.change(selects[4], { target: { value: "Milano" } });     // comune

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), {
    target: { value: "Via Montenapoleone 10" },
  });

  // Data/ora precise
  fireEvent.change(screen.getByTestId("date-picker"), {
    target: { value: "2025-10-10" },
  });
  fireEvent.change(screen.getByTestId("time-picker"), {
    target: { value: "20:30" },
  });

  // isReservationActive = true
  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  // Submit
  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  // Oracle
  await waitFor(() => {
    expect(
      screen.getByText(/Il titolo (non può|non deve) superare i? ?50 caratter/i)
    ).toBeInTheDocument();
    expect(createEventMock).not.toHaveBeenCalled();
  });
});
it("TC_1_3_RF_10: Descrizione troppo corta → mostra errore e NON crea l'evento", async () => {
  render(<EventForm organization={organization} type="create" />);

  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Breve" } });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });
  fireEvent.change(selects[1], { target: { value: "pubblico" } });
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });
  fireEvent.change(selects[3], { target: { value: "MI" } });
  fireEvent.change(selects[4], { target: { value: "Milano" } });

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), {
    target: { value: "Via Montenapoleone 10" },
  });

  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });

  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  await waitFor(() => {
    expect(
      screen.getByText(/La descrizione.*almeno\s*10 caratteri/i)
    ).toBeInTheDocument();
    expect(createEventMock).not.toHaveBeenCalled();
  });
});

it("TC_1_4_RF_10: Descrizione troppo lunga → mostra errore e NON crea l'evento", async () => {
  render(<EventForm organization={organization} type="create" />);

  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });

  // genera una descrizione > 300 caratteri
  const longDesc = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. "
    .repeat(6); // ~ 600+ caratteri
  fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: longDesc } });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });
  fireEvent.change(selects[1], { target: { value: "pubblico" } });
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });
  fireEvent.change(selects[3], { target: { value: "MI" } });
  fireEvent.change(selects[4], { target: { value: "Milano" } });

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), {
    target: { value: "Via Montenapoleone 10" },
  });

  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });

  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  await waitFor(() => {
    expect(
      screen.getByText(/La descrizione (non può|non deve) superare i? ?300 caratter/i)
    ).toBeInTheDocument();
    expect(createEventMock).not.toHaveBeenCalled();
  });
});

it("TC_1_5_RF_10: Data nel passato → mostra errore e NON crea l'evento", async () => {
  render(<EventForm organization={organization} type="create" />);

  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });
  fireEvent.change(selects[1], { target: { value: "pubblico" } });
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });
  fireEvent.change(selects[3], { target: { value: "MI" } });
  fireEvent.change(selects[4], { target: { value: "Milano" } });

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), {
    target: { value: "Via Montenapoleone 10" },
  });

  // Data nel passato
  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2020-01-01" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });

  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  await waitFor(() => {
    expect(
      screen.getByText(/La data dell'evento non può essere nel passato/i)
    ).toBeInTheDocument();
    expect(createEventMock).not.toHaveBeenCalled();
  });
});

it("TC_1_6_RF_10: Indirizzo troppo corto → mostra errore e NON crea l'evento", async () => {
  render(<EventForm organization={organization} type="create" />);

  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });
  fireEvent.change(selects[1], { target: { value: "pubblico" } });
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });
  fireEvent.change(selects[3], { target: { value: "MI" } });
  fireEvent.change(selects[4], { target: { value: "Milano" } });

  // Indirizzo troppo corto (< 3)
  fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Vi" } });

  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });

  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  await waitFor(() => {
    expect(
      screen.getByText(/L'indirizzo.*almeno\s*3 caratteri/i)
    ).toBeInTheDocument();
    expect(createEventMock).not.toHaveBeenCalled();
  });
});

it("TC_1_7_RF_10: Indirizzo troppo lungo → mostra errore e NON crea l'evento", async () => {
  render(<EventForm organization={organization} type="create" />);

  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });
  fireEvent.change(selects[1], { target: { value: "pubblico" } });
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });
  fireEvent.change(selects[3], { target: { value: "MI" } });
  fireEvent.change(selects[4], { target: { value: "Milano" } });

  // Indirizzo > 50 caratteri
  const longAddr =
    "Via con nome molto lungo che supera i cinquanta caratteri per test";
  fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: longAddr } });

  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });

  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  await waitFor(() => {
    expect(
      screen.getByText(/L'indirizzo (non può|non deve) superare i? ?50 caratter/i)
    ).toBeInTheDocument();
    expect(createEventMock).not.toHaveBeenCalled();
  });
});

it("TC_1_8_RF_10: OrganizationId mancante → il submit è bloccato (createEvent NON chiamata)", async () => {
  // Organization senza id → trigger della zod min(1, ...)
  const orgNoId = { ...organization, id: "" } as any;

  render(<EventForm organization={orgNoId} type="create" />);

  // Compila i campi come da tabella
  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });
  fireEvent.change(selects[1], { target: { value: "pubblico" } });
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });
  fireEvent.change(selects[3], { target: { value: "MI" } });
  fireEvent.change(selects[4], { target: { value: "Milano" } });

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Via Montenapoleone 10" } });
  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });

  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  // Submit
  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  // Oracle: il submit viene bloccato a livello client
  await waitFor(() => {
    expect(createEventMock).not.toHaveBeenCalled();
    // il form è ancora visibile (non c'è redirect)
    expect(screen.getByRole("button", { name: /Crea evento/i })).toBeInTheDocument();
  });


});

// TC_1_9_RF_10 — Category mancante
it("TC_1_9_RF_10: Category mancante → blocco submit e messaggio su categoria", async () => {
  render(<EventForm organization={organization} type="create" />);

  // Campi base validi
  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  // NON impostiamo selects[0] (Categoria) → category mancante
  fireEvent.change(selects[1], { target: { value: "pubblico" } });   // status
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });  // regione
  fireEvent.change(selects[3], { target: { value: "MI" } });         // provincia
  fireEvent.change(selects[4], { target: { value: "Milano" } });     // comune

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Via Montenapoleone 10" } });
  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });
  fireEvent.click(screen.getByLabelText("checkbox"));

  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  await waitFor(() => {
    expect(createEventMock).not.toHaveBeenCalled();
    const msg =
      screen.queryByText(/category\s*mancante/i) ||
      screen.queryByText(/categoria.*(obbligatoria|mancante)/i) ||
      screen.queryByText(/seleziona.*categoria/i);
    expect(msg).toBeTruthy();
  });
});
// TC_1_10_RF_10 — Comune mancante
it("TC_1_10_RF_10: Comune mancante → blocco submit e messaggio su comune", async () => {
  render(<EventForm organization={organization} type="create" />);

  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  // category, status, regione, provincia OK
  fireEvent.change(selects[0], { target: { value: "Musica" } });
  fireEvent.change(selects[1], { target: { value: "pubblico" } });
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });
  fireEvent.change(selects[3], { target: { value: "MI" } });

  // ⚠️ forza COMUNE vuoto (alcuni form autoselezionano il primo comune)
  setSelectValue("comune", "");                 // tenta per id, se presente
  try { fireEvent.change(selects[4], { target: { value: "" } }); } catch {}

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Via Montenapoleone 10" } });
  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });
  fireEvent.click(screen.getByLabelText("checkbox"));

  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  await waitFor(() => {
    expect(createEventMock).not.toHaveBeenCalled(); // submit bloccato
    // messaggio (flessibile)
    const msg =
      screen.queryByText(/comune\s*mancante/i) ||
      screen.queryByText(/comune.*(obbligatorio|mancante)/i) ||
      screen.queryByText(/seleziona.*comune/i);
    expect(msg).toBeTruthy();
  });
});
it("TC_1_11_RF_10: Provincia mancante → blocco submit (createEvent NON chiamata)", async () => {
  render(<EventForm organization={organization} type="create" />);

  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });     // category
  fireEvent.change(selects[1], { target: { value: "pubblico" } });   // status
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });  // regione

  // forza PROVINCIA vuota usando l'opzione placeholder
  fireEvent.change(selects[3], { target: { value: "" } });
  // per sicurezza anche COMUNE vuoto (cascading)
  fireEvent.change(selects[4], { target: { value: "" } });

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Via Montenapoleone 10" } });
  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });
  fireEvent.click(screen.getByLabelText("checkbox"));

  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

 await waitFor(() => {
  // niente submit
  expect(createEventMock).not.toHaveBeenCalled();

  // il select provincia resta vuoto
  const provinciaSelect = screen.getAllByTestId("select")[3] as HTMLSelectElement;
  expect(provinciaSelect.value).toBe("");

  // messaggio visibile (nel <p>), copy tollerante: è / e', spazi, maiuscole
  expect(
    screen.getByText(/Il\s*campo\s*Provincia\s*(è|e')\s*obbligatorio/i, { selector: "p" })
  ).toBeInTheDocument();
  });
});

// TC_1_12_RF_10 — Regione mancante
it("TC_1_12_RF_10: Regione mancante → blocco submit e messaggio su regione", async () => {
  render(<EventForm organization={organization} type="create" />);

  // campi base validi
  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });     // category
  fireEvent.change(selects[1], { target: { value: "pubblico" } });   // status

  // ⚠️ Regione vuota (e azzero provincia/comune per evitare cascading)
  fireEvent.change(selects[2], { target: { value: "" } });           // regione
  fireEvent.change(selects[3], { target: { value: "" } });           // provincia
  fireEvent.change(selects[4], { target: { value: "" } });           // comune

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Via Montenapoleone 10" } });
  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });
  fireEvent.click(screen.getByLabelText("checkbox"));

  // submit
  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  await waitFor(() => {
    // niente chiamata alla create
    expect(createEventMock).not.toHaveBeenCalled();

    // il select regione è davvero vuoto
    const regioneSelect = screen.getAllByTestId("select")[2] as HTMLSelectElement;
    expect(regioneSelect.value).toBe("");

    // messaggio visibile (copy tollerante a è/e', spazi, maiuscole)
    const msg =
      screen.queryByText(/Regione\s*mancante/i, { selector: "p" }) ||
      screen.queryByText(/Il\s*campo\s*Regione\s*(è|e')\s*obbligatorio/i, { selector: "p" }) ||
      screen.queryByText(/Seleziona\s+la\s+regione/i);
    expect(msg).toBeTruthy();
  });
});


it("TC_1_13_RF_10: Indirizzo non valido (errore lato server) → mostra errore e NON procede oltre", async () => {
  // La server action risponde con errore di indirizzo
  createEventMock.mockResolvedValueOnce({
    ok: false,
    error: "Indirizzo non valido",
  });

  render(<EventForm organization={organization} type="create" />);

  // Compila i campi
  fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Jazz" } });
  fireEvent.change(screen.getByLabelText(/Descrizione/i), {
    target: { value: "Evento musicale di jazz con artisti locali" },
  });

  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Musica" } });
  fireEvent.change(selects[1], { target: { value: "pubblico" } });
  fireEvent.change(selects[2], { target: { value: "Lombardia" } });
  fireEvent.change(selects[3], { target: { value: "MI" } });
  fireEvent.change(selects[4], { target: { value: "Milano" } });

  fireEvent.change(screen.getByLabelText(/Indirizzo/i), {
    target: { value: "Via Fantasma 123" },
  });

  fireEvent.change(screen.getByTestId("date-picker"), { target: { value: "2025-10-10" } });
  fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "20:30" } });

  const checkbox = screen.getByLabelText("checkbox");
  fireEvent.click(checkbox);

  // Submit
  fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

  // 1) La server action viene invocata
  await waitFor(() => expect(createEventMock).toHaveBeenCalledTimes(1));

  // 2) Messaggio di errore esatto nel <p> (con spazi/newline)
  await waitFor(() => {
    expect(
      screen.getByText(/Indirizzo\s+non\s+valido/i, { selector: "p" })
    ).toBeInTheDocument();
  });
});
