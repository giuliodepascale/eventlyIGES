import { getFavorites } from "@/actions/favorites-event";
import Loading from "@/app/loading";
import Container from "@/components/altre/container";
import EmptyState from "@/components/altre/empty-state";
import EventList from "@/components/events/events-list";
import { getUserById } from "@/data/user";
import { currentUser } from "@/lib/auth";
import { User } from "@prisma/client";
import { Suspense } from "react";

const FavoritesPage = async () => {
    const user = await currentUser();
   
    if(!user || !user.id){
        return (
             <EmptyState title="Non hai i permessi" subtitle="Effettua il login" />    
   ) }
        const result = await getFavorites(user.id);
   
   if(result.events.length===0){
    return (
            <EmptyState title="Non hai eventi tra i preferiti" subtitle="Aggiungili ora!" showToHome/>
    )
   }
   let fullUser = null;
   if(user && user.id){
     fullUser = await getUserById(user.id);
   }
    return (
        <>
      
    <h3 className="text-2xl font-bold text-center  ">
      I tuoi preferiti
    </h3>
  

        <Container>
        <div
          className="
            pt-5 md:pt-2
            grid
            grid-cols-1
            sm-grid-cols-2
            md:grid-cols-3
            lg:grid-cols-4
            xl:grid-cols-5
            2xl:grid-cols-6
            gap-8
          "
        >
           <Suspense fallback={<Loading />}>
            <EventList events={result.events} currentUser={fullUser as User } /> 
          </Suspense>
        </div>
      </Container>
      </>
    );
}

export default FavoritesPage;