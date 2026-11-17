"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import ClientForm from "@/components/forms/ClientForm";
import { Client, getClient } from "@/services/clients";
import { Badge, Icon } from "@/components/ui";
import { ROUTES } from "../../../../../config";
import "../../client-profile.css";

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditClientPage({ params }: Props) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await getClient(id);
        if (active) setClient(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load client."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <section className="cp-page">
      <nav className="cp-breadcrumb" aria-label="Breadcrumb">
        <Link href={ROUTES.clients}>Clients</Link>
        <Icon name="chevron_right" size={18} />
        <Link href={ROUTES.clientDetails(id)}>Client Details</Link>
        <Icon name="chevron_right" size={18} />
        <span>Edit Client</span>
      </nav>

      {loading ? (
        <div className="cp-panel cp-message">
          Loading client information...
        </div>
      ) : error || !client ? (
        <div className="finops-ui-alert finops-ui-alert-danger" role="alert">
          {error || "Client not found."}
        </div>
      ) : (
        <>
          <div className="cp-client-banner">
            <div className="cp-banner-avatar">
              <Icon name="domain" size={40} />
            </div>

            <div className="cp-banner-info">
              <div className="cp-banner-title">
                <h1>{client.companyName}</h1>
                <Badge tone={
                  client.status === "Active"
                    ? "success"
                    : client.status === "Suspended"
                      ? "danger"
                      : "warning"
                }>
                  {client.status}
                </Badge>
              </div>

              <p>Client ID: {client.clientId}</p>
              <p>
                {client.industry}
                <span className="cp-inline-separator">|</span>
                {client.country}
              </p>
            </div>

            <div className="cp-banner-stat">
              <Icon name="layers" size={29} />
              <strong>{client.accountCount ?? "—"}</strong>
              <span>Accounts</span>
            </div>
          </div>

          <div className="cp-page-heading">
            <div>
              <h2>Edit Client Profile</h2>
              <p>Update business information, contact details and status.</p>
            </div>
          </div>

          <ClientForm key={client.clientId} client={client} />
        </>
      )}
    </section>
  );
}