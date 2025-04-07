// components/events/UpcomingEvents.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import EventList from "@/components/events/events-list";
import ClientPagination from "@/components/altre/pagination";
import { User } from "@prisma/client";
import { getAllActiveEvents } from "@/data/event";
import { SafeEvent } from "@/app/types";
import Link from "next/link";
import { Button } from "../ui/button";

interface UpcomingEventsProps {
  currentUser: User | null;
}

const UpcomingEvents: React.FC<UpcomingEventsProps> = ({ currentUser }) => {
  // Estrai i filtri dalla URL come in NearbyEvents
  const searchParams = useSearchParams();
  const query = searchParams.get("query") || "";
  const category = searchParams.get("category") || "";
  const dateFilter = searchParams.get("dateFilter") || "";

  // Stati per gestire gli eventi, la paginazione e il caricamento
  const [displayedEvents, setDisplayedEvents] = useState<SafeEvent[]>([]);
  const [page, setPage] = useState(1);
  const [serverPage, setServerPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const eventsPerPage = 5;

  // Funzione per il fetch iniziale degli eventi con i filtri applicati
  const fetchInitialEvents = async () => {
    try {
      const result = await getAllActiveEvents(query, 10, 1, category, dateFilter);
      if (result.events && result.events.length > 0) {
        setDisplayedEvents(result.events);
        if (result.events.length < 10) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Errore nel fetch iniziale degli eventi:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // Quando query, category o dateFilter cambiano, resettiamo tutta la paginazione e rilanciamo il fetch iniziale
  useEffect(() => {
    setDisplayedEvents([]);
    setPage(1);
    setServerPage(1);
    setHasMore(true);
    setLoading(true);
    fetchInitialEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, dateFilter]);

  if (loading) {
    return null;
  }

  if (!displayedEvents.length) {
    return ( <>
      <div>Nessun evento trovato.</div>
      <Link href="/">
    <Button 
    variant={"outline"}
    size={"default"}
  >
    Rimuovi i filtri
  </Button>
      </Link> </>)
  }

  // Calcola gli eventi da mostrare in base alla pagina locale
  const startIndex = (page - 1) * eventsPerPage;
  const paginatedEvents = displayedEvents.slice(startIndex, startIndex + eventsPerPage);
  const totalPages = Math.ceil(displayedEvents.length / eventsPerPage);

  // Funzione per caricare ulteriori eventi (paginazione lato server)
  const fetchMoreEvents = async () => {
    const newServerPage = serverPage + 1;
    try {
      const result = await getAllActiveEvents(query, 10, newServerPage, category, dateFilter);
      if (result.events.length > 0) {
        setDisplayedEvents((prev) => [...prev, ...result.events]);
        setServerPage(newServerPage);
        if (result.events.length < 10) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Errore nel caricamento di ulteriori eventi:", error);
      setHasMore(false);
    }
  };

  return (
    <div>
      {/* Il cambio del "key" in base alla pagina locale forza la ri-esecuzione dell'animazione */}
      <div key={page} className="pt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
        <EventList events={paginatedEvents} currentUser={currentUser as User} />
      </div>

      {/* Paginazione locale */}
      <ClientPagination totalPages={totalPages} page={page} setPage={setPage} />

      {/* Bottone "Vedi Altro" disabilitato se non ci sono altri eventi */}
      <div className="flex justify-center mt-4">
        <button
          disabled={!hasMore}
          className={`px-4 py-2 bg-blue-600 text-white rounded-md transition ${
            !hasMore ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
          }`}
          onClick={fetchMoreEvents}
        >
          Vedi Altro
        </button>
      </div>
    </div>
  );
};

export default UpcomingEvents;
