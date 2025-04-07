import EmptyState from "@/components/altre/empty-state";
import OrganizationClient from "@/components/organization/organization-client";
import { getOrganizationById } from "@/data/organization";
import { currentUser } from "@/lib/auth";


interface OrganizationPageProps {
    params: Promise<{ [key: string]: string | string[] | undefined }>;
  }


export default async function OrganizationPage({ params }: OrganizationPageProps) {
    
    const {organizationId} = await params;
    
    // Estrai l'ID dai parametri di ricerca

    const user = await currentUser();

    const organizationResult = await getOrganizationById(organizationId as string || '');

    // Controlla se l'organizzazione è stata trovata e se esiste
    if (!organizationResult || !organizationResult.organization) {
    return (
        <EmptyState 
            title="Organizzazione non trovata" 
            subtitle="La pagina che stai cercando non esiste." 
            showToHome
        />
     );
    }

    // Controlla se l'utente è loggato
    if (!user || !user.id) {
        return (
        <EmptyState 
            title="Non hai i permessi" 
            subtitle="Effettua il login per accedere a questa pagina." 
        />
        );
    }

    // Estrai l'organizzazione e gli organizzatori dal risultato
   
   
    
    return (
            <OrganizationClient 
                organization={organizationResult.organization} 
            />
    )
}

