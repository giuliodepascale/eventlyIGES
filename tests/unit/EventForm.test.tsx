/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
// Forza timezone coerente alla logica del form
process.env.TZ = "Europe/Rome";

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EventForm from "@/components/events/event-form";

// ---------- MOCK dipendenze esterne ----------
jest.mock("@/components/altre/file-uploader", () => ({
  FileUploader: ({ onFieldChange, imageUrl, setFiles }: any) => (
    <div data-testid="file-uploader">Mock Uploader</div>
  ),
}));

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
  categories: [{ label: "Concerto" }, { label: "Festa" }],
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

    // Collega l'id del trigger al select per l'associazione label-for
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

const setDateLocalString = (y: number, m: number, d: number) =>
  `${y}-${pad(m)}-${pad(d)}`;

const setDate = (el: HTMLElement, y: number, m: number, d: number) => {
  const val = setDateLocalString(y, m, d);
  fireEvent.change(el, { target: { value: val } });
};

const setToday = (dateInput: HTMLElement) => {
  const now = new Date();
  setDate(dateInput, now.getFullYear(), now.getMonth() + 1, now.getDate());
};

const setTime = (el: HTMLElement, hh = 12, mm = 0) => {
  fireEvent.change(el, { target: { value: `${pad(hh)}:${pad(mm)}` } });
};

// =============================================================
//                         TESTS
// =============================================================
describe("EventForm", () => {
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

  it("TC-01: errore su submit con campi obbligatori mancanti", async () => {
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

  // ---------- EQUIVALENCE CLASSES & BOUNDARIES ----------
  it("TC-10 (Title ECi<3): titolo troppo corto", async () => {
    render(<EventForm organization={organization} type="create" />);
    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(screen.getByText(/Il titolo deve contenere almeno 3 caratteri/i)).toBeInTheDocument();
    });
  });

  it("TC-11 (Desc ECi<10): descrizione troppo corta", async () => {
    render(<EventForm organization={organization} type="create" />);
    fireEvent.change(screen.getByLabelText(/Descrizione/i), {
      target: { value: "breve" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/La descrizione deve contenere almeno 10 caratteri/i)
      ).toBeInTheDocument();
    });
  });

  it("TC-12 (Date ECi-past): data nel passato non ammessa", async () => {
    render(<EventForm organization={organization} type="create" />);
    const dateInput = screen.getByTestId("date-picker");
    // ieri (locale)
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const localPast = setDateLocalString(
      past.getFullYear(),
      past.getMonth() + 1,
      past.getDate()
    );
    fireEvent.change(dateInput, { target: { value: localPast } });

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(screen.getByText(/La data dell'evento non può essere nel passato/i)).toBeInTheDocument();
    });
  });

  it("TC-13 (Category ECi-empty): categoria vuota", async () => {
    render(<EventForm organization={emptyOrganization} type="create" />);
    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(screen.getByText(/La categoria è obbligatoria/i)).toBeInTheDocument();
    });
  });

  it("TC-14 (Loc ECi-empty): comune/provincia/regione vuoti", async () => {
    render(<EventForm organization={emptyOrganization} type="create" />);
    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
    await waitFor(() => {
      expect(screen.getByText(/Il campo Comune è obbligatorio/i)).toBeInTheDocument();
      expect(screen.getByText(/Il campo Provincia è obbligatorio/i)).toBeInTheDocument();
      expect(screen.getByText(/Il campo Regione è obbligatorio/i)).toBeInTheDocument();
    });
  });

  // Questi due casi sono meglio nella suite unitaria Zod (non riproducibili via UI qui):
  it.skip("TC-15 (Time ECi): orario non impostato/errato -> errore (spostare nei test Zod)", async () => {});
  it.skip("TC-16 (Image ECi): url non valido (spostare nei test Zod)", async () => {});

  it("TC-20 (Happy path): tutti i campi validi -> createEvent chiamata", async () => {
    const { createEvent } = require("@/actions/event");
    render(<EventForm organization={organization} type="create" />);

    // Testo
    fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Test" } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), {
      target: { value: "Descrizione evento valida per test" },
    });
    fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Via Roma 2" } });

    // Select ordinati: 0=Categoria, 1=Status, 2=Regione, 3=Provincia, 4=Comune
    const selects = screen.getAllByTestId("select");
    fireEvent.change(selects[0], { target: { value: "Concerto" } }); // Categoria
    fireEvent.change(selects[2], { target: { value: "Campania" } }); // Regione
    fireEvent.change(selects[3], { target: { value: "NA" } });       // Provincia
    fireEvent.change(selects[4], { target: { value: "Napoli" } });    // Comune

    // Data/ora valide (locale)
    setToday(screen.getByTestId("date-picker"));
    setTime(screen.getByTestId("time-picker"), 12, 0);

    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

    await waitFor(() => {
      expect(
        screen.queryByText(
          /obbligatori|obbligatoria|richiesto|deve contenere|url valido|non può essere nel passato/i
        )
      ).toBeNull();
      expect(createEvent).toHaveBeenCalled();
    });
  });
});
