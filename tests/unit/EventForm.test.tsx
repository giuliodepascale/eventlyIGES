import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EventForm from "@/components/events/event-form";

// --- MOCK le dipendenze esterne ---
jest.mock("@/components/altre/file-uploader", () => ({
  FileUploader: ({ onFieldChange, imageUrl, setFiles }: any) => (
    <div data-testid="file-uploader">Mock Uploader</div>
  ),
}));
jest.mock("@/actions/event", () => ({
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
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
// --- MOCK "italia" COERENTE ---
jest.mock("italia", () => ({
  __esModule: true,
  default: {
    regioni: [
      { nome: "Campania", province: ["NA"] },
    ],
    comuni: {
      regioni: [
        {
          province: [
            { code: "NA", comuni: [{ nome: "Napoli" }] }
          ],
        },
      ],
    },
  },
}));
jest.mock("@mui/x-date-pickers/AdapterDayjs", () => ({
  AdapterDayjs: {},
}));
jest.mock("@mui/x-date-pickers/LocalizationProvider", () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));
jest.mock("@mui/x-date-pickers/MobileDatePicker", () => ({
  MobileDatePicker: ({ onChange, value }: any) => (
    <input
      data-testid="date-picker"
      type="date"
      onChange={(e) => onChange && onChange({ toDate: () => new Date(e.target.value) })}
    />
  ),
}));
jest.mock("@mui/x-date-pickers/MobileTimePicker", () => ({
  MobileTimePicker: ({ onChange, value }: any) => (
    <input
      data-testid="time-picker"
      type="time"
      onChange={(e) => onChange && onChange({ toDate: () => new Date(`2000-01-01T${e.target.value}`) })}
    />
  ),
}));
jest.mock("@/components/altre/categories", () => ({
  categories: [{ label: "Concerto" }, { label: "Festa" }],
}));

// --- Mock di ResizeObserver globale per Radix UI ---
global.ResizeObserver = global.ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const organization = {
  id: "org-1",
  nome: "Test Org",
  indirizzo: "Via Roma 1",
  comune: "Napoli",
  provincia: "NA",
  regione: "Campania",
  email: "org@test.it",
} as any;

// Usata SOLO per test su required (campi vuoti)
const emptyOrganization = {
  id: "org-1",
  nome: "Test Org",
  indirizzo: "Via Roma 1",
  comune: "",
  provincia: "",
  regione: "",
  email: "org@test.it",
} as any;

describe("EventForm", () => {
  it("rende i campi principali", () => {
    render(<EventForm organization={organization} type="create" />);
    expect(screen.getByLabelText(/Titolo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Categoria/i)).toBeInTheDocument();
    expect(screen.getByTestId("file-uploader")).toBeInTheDocument();
    expect(screen.getByLabelText(/Indirizzo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Descrizione/i)).toBeInTheDocument();
    expect(screen.getByText(/Regione/i)).toBeInTheDocument();
    expect(screen.getByText(/Provincia/i)).toBeInTheDocument();
    expect(screen.getByText(/Comune/i)).toBeInTheDocument();
    const comboBoxes = screen.getAllByRole("combobox");
    expect(comboBoxes.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText(/Crea evento/i)).toBeInTheDocument();
  });

  it("mostra errore se si prova a inviare senza compilare", async () => {
    render(<EventForm organization={emptyOrganization} type="create" />);
    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

    await waitFor(() => {
      expect(
        screen.getAllByText(
          (content) =>
            /obbligatoria|richiesto|deve contenere|url valido/i.test(content)
        ).length
      ).toBeGreaterThan(0);
    });
  });

  // --- Test plan dettagliato, 1 test per ogni regola chiave del tuo schema ---
  describe("EventForm - validazione granulari", () => {
    /**
     * TC01 - Titolo troppo corto
     */
    it("mostra errore se il titolo è troppo corto", async () => {
      render(<EventForm organization={organization} type="create" />);
      fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "a" } });
      fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
      await waitFor(() => {
        expect(screen.getByText(/Il titolo deve contenere almeno 3 caratteri/i)).toBeInTheDocument();
      });
    });

    /**
     * TC02 - Descrizione troppo corta
     */
    it("mostra errore se la descrizione è troppo corta", async () => {
      render(<EventForm organization={organization} type="create" />);
      fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "breve" } });
      fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
      await waitFor(() => {
        expect(screen.getByText(/La descrizione deve contenere almeno 10 caratteri/i)).toBeInTheDocument();
      });
    });

    /**
     * TC03 - Data evento nel passato
     */
    it("mostra errore se la data è nel passato", async () => {
      render(<EventForm organization={organization} type="create" />);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2); // -2 per sicurezza timezone
      const dateInput = screen.getByTestId("date-picker");
      fireEvent.change(dateInput, { target: { value: yesterday.toISOString().split('T')[0] } });
      fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
      await waitFor(() => {
        expect(screen.getByText(/La data dell'evento non può essere nel passato/i)).toBeInTheDocument();
      });
    });

    /**
     * TC04 - Categoria vuota
     */
    it("mostra errore se la categoria è vuota", async () => {
      render(<EventForm organization={emptyOrganization} type="create" />);
      fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
      await waitFor(() => {
        expect(screen.getByText(/La categoria è obbligatoria/i)).toBeInTheDocument();
      });
    });

    /**
     * TC05 - Comune vuoto
     */
    it("mostra errore se il comune è vuoto", async () => {
      render(<EventForm organization={emptyOrganization} type="create" />);
      fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
      await waitFor(() => {
        expect(screen.getByText(/Il campo Comune è obbligatorio/i)).toBeInTheDocument();
      });
    });

    /**
     * TC06 - Provincia vuota
     */
    it("mostra errore se la provincia è vuota", async () => {
      render(<EventForm organization={emptyOrganization} type="create" />);
      fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
      await waitFor(() => {
        expect(screen.getByText(/Il campo Provincia è obbligatorio/i)).toBeInTheDocument();
      });
    });

    /**
     * TC07 - Regione vuota
     */
    it("mostra errore se la regione è vuota", async () => {
      render(<EventForm organization={emptyOrganization} type="create" />);
      fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));
      await waitFor(() => {
        expect(screen.getByText(/Il campo Regione è obbligatorio/i)).toBeInTheDocument();
      });
    });

    /**
     * TC08 - Tutti i campi validi (Happy Path)
     */
    it("invia il form se tutti i campi sono validi", async () => {
      render(<EventForm organization={organization} type="create" />);
      fireEvent.change(screen.getByLabelText(/Titolo/i), { target: { value: "Concerto Test" } });
      fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: "Descrizione evento valida per test" } });
      fireEvent.change(screen.getByLabelText(/Indirizzo/i), { target: { value: "Via Roma 2" } });
      // Simula data e ora (devono essere >= oggi)
      const today = new Date();
      fireEvent.change(screen.getByTestId("date-picker"), { target: { value: today.toISOString().split('T')[0] } });
      fireEvent.change(screen.getByTestId("time-picker"), { target: { value: "12:00" } });
      fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

      await waitFor(() => {
        // Nessun messaggio di errore su campo
        expect(screen.queryByText(/obbligatoria|richiesto|deve contenere|url valido/i)).toBeNull();
        // Mock chiamata a createEvent deve essere stata chiamata almeno una volta
        expect(require("@/actions/event").createEvent).toHaveBeenCalled();
      });
    });
  });
});
