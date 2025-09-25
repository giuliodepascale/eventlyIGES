/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrganizationClient from "@/components/organization/organization-client";
import { followOrganization, unfollowOrganization } from "@/actions/favorites-organization";
import { SafeOrganization } from "@/app/types";


// Mock
jest.mock("@/actions/favorites-organization", () => ({
  followOrganization: jest.fn(),
  unfollowOrganization: jest.fn(),
}));

describe("OrganizationClient - RF_15", () => {
  const organization: SafeOrganization = {
  id: "org1",
  name: "Test Org",
  imageSrc: "/test.jpg",
  email: "info@test.org",
  phone: "123456789",
  indirizzo: "Via Roma, 1",
  comune: "Milano",
  provincia: "MI",
  regione: "Lombardia",
  linkEsterno: "https://test.org",
  description: "Descrizione test",
  latitudine: "45.4642",
  longitudine: "9.1900",
  ticketingStatus: "open",
  stripeAccountId: "acct_1234567890", 
  createdAt: new Date().toISOString(),
};


  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC_1_RF_15: Successo follow eseguito
  it("TC_1_RF_15: utente loggato, organizzazione esistente, inizialmente non seguito -> follow eseguito", async () => {
    (followOrganization as jest.Mock).mockResolvedValue({ success: true });

    render(<OrganizationClient organization={organization} userId="user1" initialFollowing={false} />);

    const followButton = screen.getByRole("button", { name: /Segui/i });
    fireEvent.click(followButton);

    await waitFor(() => {
      expect(followOrganization).toHaveBeenCalledWith("org1", "user1");
      expect(screen.getByRole("button", { name: /Smetti di seguire/i })).toBeInTheDocument();
    });
  });

  // TC_1_1_RF_15: Successo unfollow eseguito
  it("TC_1_1_RF_15: utente loggato, organizzazione esistente, inizialmente seguito -> unfollow eseguito", async () => {
    (unfollowOrganization as jest.Mock).mockResolvedValue({ success: true });

    render(<OrganizationClient organization={organization} userId="user1" initialFollowing={true} />);

    const unfollowButton = screen.getByRole("button", { name: /Smetti di seguire/i });
    fireEvent.click(unfollowButton);

    await waitFor(() => {
      expect(unfollowOrganization).toHaveBeenCalledWith("org1", "user1");
      expect(screen.getByRole("button", { name: /Segui/i })).toBeInTheDocument();
    });
  });

  it("TC_1_2_RF_15: utente non loggato -> mostra messaggio di errore", async () => {
  (followOrganization as jest.Mock).mockImplementation((orgId, userId) => {
    if (!userId) {
      return Promise.reject(new Error("Utente non loggato"));
    }
    return Promise.resolve({ success: true });
  });

  render(<OrganizationClient organization={organization} userId="" initialFollowing={false} />);

  const followButton = screen.getByRole("button", { name: /Segui/i });
  fireEvent.click(followButton);

  await waitFor(() => {
    expect(screen.getByText(/Azione non riuscita/i)).toBeInTheDocument();
    expect(followOrganization).toHaveBeenCalledWith("org1", "");
  });
});



  // TC_1_3_RF_15: Errore organizzazione inesistente
  it("TC_1_3_RF_15: organizzazione inesistente -> mostra messaggio di errore", async () => {
    (followOrganization as jest.Mock).mockRejectedValue(new Error("Organizzazione non trovata"));

    render(<OrganizationClient organization={{ ...organization, id: "nonexistent" }} userId="user1" initialFollowing={false} />);

    const followButton = screen.getByRole("button", { name: /Segui/i });
    fireEvent.click(followButton);

    await waitFor(() => {
      expect(followOrganization).toHaveBeenCalledWith("nonexistent", "user1");
      expect(screen.getByText(/Azione non riuscita/i)).toBeInTheDocument();
    });
  });

  // TC_1_4_RF_15: Errore follow fallito
  it("TC_1_4_RF_15: follow fallito -> rollback e mostra messaggio di errore", async () => {
    (followOrganization as jest.Mock).mockRejectedValue(new Error("Errore server"));

    render(<OrganizationClient organization={organization} userId="user1" initialFollowing={false} />);

    const followButton = screen.getByRole("button", { name: /Segui/i });
    fireEvent.click(followButton);

    await waitFor(() => {
      expect(followOrganization).toHaveBeenCalledWith("org1", "user1");
      expect(screen.getByRole("button", { name: /Segui/i })).toBeInTheDocument();
      expect(screen.getByText(/Azione non riuscita/i)).toBeInTheDocument();
    });
  });

  // TC_1_5_RF_15: Errore unfollow fallito
  it("TC_1_5_RF_15: unfollow fallito -> rollback e mostra messaggio di errore", async () => {
    (unfollowOrganization as jest.Mock).mockRejectedValue(new Error("Errore server"));

    render(<OrganizationClient organization={organization} userId="user1" initialFollowing={true} />);

    const unfollowButton = screen.getByRole("button", { name: /Smetti di seguire/i });
    fireEvent.click(unfollowButton);

    await waitFor(() => {
      expect(unfollowOrganization).toHaveBeenCalledWith("org1", "user1");
      expect(screen.getByRole("button", { name: /Smetti di seguire/i })).toBeInTheDocument();
      expect(screen.getByText(/Azione non riuscita/i)).toBeInTheDocument();
    });
  });
});
