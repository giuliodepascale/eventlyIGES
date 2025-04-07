// components/OrganizationClient.tsx

"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaExternalLinkAlt } from "react-icons/fa";
import Loader from "../loader";

import Map from "@/components/altre/map";
import { SafeOrganization } from "@/app/types";


interface OrganizationClientProps {
  organization: SafeOrganization;
}


const OrganizationClient: React.FC<OrganizationClientProps> = ({ organization }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[500px,1fr] 2xl:max-w-6xl">
      <Suspense fallback={<Loader />}>
        <div className="w-full h-[70vh] overflow-hidden rounded-xl relative flex-shrink-0">
          <Image
            src={organization.imageSrc || "/images/NERO500.jpg"} // Immagine predefinita se non fornita
            priority
            alt="Organization Image"
            fill
            className="object-cover object-center w-full h-full"
          />
        </div>
      </Suspense>
      <div className="flex flex-col w-full gap-8 p-5 md:p-10">
        <div className="flex flex-col gap-6">
          <h2 className="text-4xl font-bold text-black break-words">{organization.name}</h2>

          <div className="flex flex-col gap-3 sm:flex-row md:items-center">
            {organization.email && (
              <div className="flex items-center gap-2">
                <FaEnvelope size={20} className="text-gray-600" />
                <a href={`mailto:${organization.email}`} className="text-primary-500 hover:underline">
                  {organization.email}
                </a>
              </div>
            )}
            {organization.phone && (
              <div className="flex items-center gap-2">
                <FaPhone size={20} className="text-gray-600" />
                <a href={`tel:${organization.phone}`} className="text-primary-500 hover:underline">
                  {organization.phone}
                </a>
              </div>
            )}
            {organization.indirizzo && (
              <div className="flex items-center gap-2">
                <FaMapMarkerAlt size={20} className="text-gray-600" />
                <span className="text-gray-700">{organization.indirizzo}</span>
              </div>
            )}
            {organization.linkEsterno && (
              <div className="flex items-center gap-2">
                <FaExternalLinkAlt size={20} className="text-gray-600" />
                <a href={organization.linkEsterno} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                  Visita Sito
                </a>
              </div>
            )}
          </div>

          <div className="mt-4 text-gray-700">
            {organization.description || "Nessuna descrizione disponibile."}
          </div>
        </div>

       
        
        {organization.indirizzo &&
          <Map placeName={`${organization.indirizzo}, ${organization.comune}, ${organization.name}`} />

        }
      </div>
    </div>
  );
};

export default OrganizationClient;
