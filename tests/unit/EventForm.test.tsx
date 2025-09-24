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

// NOTA: enhancement notifiche escluso -> createEvent risolve semplicemente
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

// ---- MOCK "italia" coerente (province come STRINGHE) ----
jest.mock("italia", () => ({
  __esModule: true,
  default: {
    regioni: [
      {
        nome: "Campania",
        province: ["NA", "SA"],
      },
    ],
    comuni: {
      regioni: [
        {
          province: [
            { code: "NA", comuni: [{ nome: "Napoli" }, { nome: "Pozzuoli" }] },
            { code: "SA", comuni: [{ nome: "Salerno" }, { nome: "Cava de' Tirreni" }] },
          ],
        },
      ],
    },
  },
}));

// ---- MUI Date Pickers -> input nativi deterministici ----
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
          toDate: () =>
            new Date(`2000-01-01T${(e.target as HTMLInputElement).value || "00:00"}`),
        })
      }
    />
  ),
}));

// ---- categorie usate dal Select ----
jest.mock("@/components/altre/categories", () => ({
  categories: [{ label: "Concerto" }, { label: "Workshop" }, { label: "Hackathon" }, { label: "Open Day" }],
}));

// ---- Mock shadcn/ui Select -> <select> nativo (safe) con id dal Trigger ----
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
        {children}
      </select>
    ),
    // collega id
    SelectTrigger: ({ id }: { id?: string }) => {
      lastId = id;
      return null;
    },
    SelectContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectItem: ({ value, children }: { value: string; children?: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

// ---- Mock Input & Checkbox shadcn (semplici) ----
jest.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));
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

// ---- Mock di ResizeObserver per Radix ----
(global as any).ResizeObserver =
  (global as any).ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

// ---------- Accesso stabile al mock azioni ----------
const eventActions = require("@/actions/event");
const createEventMock = eventActions.createEvent as jest.Mock;

// ---------- Dati base ----------
const organization = {
  id: "org-1",
  nome: "Test Org",
  indirizzo: "Via Roma 1",
  comune: "Napoli",
  provincia: "NA",
  regione: "Campania",
  email: "org@test.it",
} as any;

const emptyOrganization = {
  id: "org-1",
  nome: "Test Org",
  indirizzo: "Via Roma 1",
  comune: "",
  provincia: "",
  regione: "",
  email: "org@test.it",
} as any;

// ---------- Helper (niente UTC!) ----------
const pad = (n: number) => String(n).padStart(2, "0");
const setDateLocalString = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

const setDate = (el: HTMLElement, y: number, m: number, d: number) => {
  fireEvent.change(el, { target: { value: setDateLocalString(y, m, d) } });
};
const setToday = (dateInput: HTMLElement) => {
  const now = new Date();
  setDate(dateInput, now.getFullYear(), now.getMonth() + 1, now.getDate());
};
const setTime = (el: HTMLElement, hh = 12, mm = 0) => {
  fireEvent.change(el, { target: { value: `${pad(hh)}:${pad(mm)}` } });
};

// Riempie i campi comuni validi (categoria/luogo/regione/provincia/comune, data/ora)
const fillCommonValidFields = () => {
  fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Via Roma 2" } });

  // Select: 0=Categoria, 1=Stato, 2=Regione, 3=Provincia, 4=Comune (ordine tipico)
  const selects = screen.getAllByTestId("select");
  fireEvent.change(selects[0], { target: { value: "Concerto" } }); // Categoria
  fireEvent.change(selects[2], { target: { value: "Campania" } }); // Regione
  fireEvent.change(selects[3], { target: { value: "NA" } });       // Provincia
  fireEvent.change(selects[4], { target: { value: "Napoli" } });   // Comune

  // Data/ora valide
  setToday(screen.getByTestId("date-picker"));
  setTime(screen.getByTestId("time-picker"), 12, 0);
};

// ---------- Reset tra test ----------
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

// =============================================================
//                         TESTS (RF_16)
// =============================================================
describe("RF_16 – Creazione Evento (EventForm)", () => {
  it("TC-00: rende i campi principali", () => {
    render(<EventForm organization={organization} type="create" />);
    expect(screen.getByLabelText(/Titolo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Categoria/i)).toBeInTheDocument();
    expect(screen.getByTestId("file-uploader")).toBeInTheDocument();
    expect(screen.getByLabelText(/Indirizzo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Descrizione/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Regione$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Provincia$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Comune$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Crea evento/i)).toBeInTheDocument();
  });

  it("TC-01: submit con campi obbligatori mancanti → errori visibili", async () => {
    render(<EventForm organization={emptyOrganization} type="create" />);
    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(
        screen.getAllByText((content) =>
          /obbligatori|obbligatoria|richiesto|deve contenere|url valido|non può essere nel passato/i.test(
            content
          )
        ).length
      ).toBeGreaterThan(0);
    });
  });

  // ------------------ SUCCESS CASES (notifiche escluse) ------------------

  it("TC_1_RF_16: Successo pubblico (notifiche escluse) → evento creato", async () => {
    render(<EventForm organization={organization} type="create" />);

    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Open Conference 2025" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Evento annuale dedicato alle conferenze open source" } });
    fillCommonValidFields();

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
  });

  it("TC_1_1_RF_16: Successo privato → evento creato", async () => {
    render(<EventForm organization={organization} type="create" />);

    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Open Workshop 2025" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Workshop tecnico per sviluppatori" } });
    fillCommonValidFields();

    // Imposta stato PRIVATO/HIDDEN
    const selects = screen.getAllByTestId("select");
    fireEvent.change(selects[1], { target: { value: "privato" } });

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
  });

  it("TC_1_2_RF_16: Successo pubblico senza follower → evento creato", async () => {
    render(<EventForm organization={organization} type="create" />);

    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Hackathon 2025" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Evento annuale di hackathon per studenti" } });
    fillCommonValidFields();

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
  });

  it("TC_1_3_RF_16: Successo pubblico con errore notifiche (escluse) → evento creato", async () => {
    render(<EventForm organization={organization} type="create" />);

    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Open Day 2025" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Giornata aperta per studenti e docenti" } });
    fillCommonValidFields();

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
  });

  // ------------------ ERROR CASES ------------------

  it("TC_1_4_RF_16: titolo troppo corto → errore e niente creazione", async () => {
    render(<EventForm organization={organization} type="create" />);

    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "ab" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Evento valido con descrizione sufficiente" } });
    fillCommonValidFields();

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(screen.getByText(/Il titolo deve contenere almeno 3 caratteri/i)).toBeInTheDocument();
      expect(createEventMock).not.toHaveBeenCalled();
    });
  });

  it("TC_1_5_RF_16: descrizione troppo corta → errore e niente creazione", async () => {
    render(<EventForm organization={organization} type="create" />);

    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Open Conference 2025" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "breve" } });
    fillCommonValidFields();

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(screen.getByText(/La descrizione deve contenere almeno 10 caratteri/i)).toBeInTheDocument();
      expect(createEventMock).not.toHaveBeenCalled();
    });
  });

  it("TC_1_6_RF_16: data evento non valida (passata) → errore e niente creazione", async () => {
    render(<EventForm organization={organization} type="create" />);

    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Open Conference 2025" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Evento valido" } });
    fillCommonValidFields();

    // Sovrascrivi con data passata (ieri)
    const dateInput = screen.getByTestId("date-picker");
    const past = new Date();
    past.setDate(past.getDate() - 1);
    fireEvent.change(dateInput, {
      target: {
        value: setDateLocalString(past.getFullYear(), past.getMonth() + 1, past.getDate()),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(screen.getByText(/La data dell'evento non può essere nel passato/i)).toBeInTheDocument();
      expect(createEventMock).not.toHaveBeenCalled();
    });
  });

  it("TC_1_7_RF_16: location/indirizzo troppo corto → errore e niente creazione", async () => {
    render(<EventForm organization={organization} type="create" />);

    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Open Conference 2025" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Evento valido con descrizione sufficiente" } });

    // Riempie il resto ma usa indirizzo troppo corto
    fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "RO" } });

    const selects = screen.getAllByTestId("select");
    fireEvent.change(selects[0], { target: { value: "Concerto" } });
    fireEvent.change(selects[2], { target: { value: "Campania" } });
    fireEvent.change(selects[3], { target: { value: "NA" } });
    fireEvent.change(selects[4], { target: { value: "Napoli" } });

    setToday(screen.getByTestId("date-picker"));
    setTime(screen.getByTestId("time-picker"), 12, 0);

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      // Messaggio generico o specifico: adattare alla tua copy esatta
      expect(
        screen.getByText(/L'indirizzo.*almeno 3 caratteri/i)
      ).toBeInTheDocument();
      expect(createEventMock).not.toHaveBeenCalled();
    });
  });
});
