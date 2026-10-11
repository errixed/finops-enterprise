"use client";

import { use, useEffect, useState } from "react";
import ClientForm from "@/components/forms/ClientForm";
import { Client, getClient } from "@/services/clients";

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

        getClient(id)
            .then(data => {
                if (active) setClient(data);
            })
            .catch(err => {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load client"
                    );
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [id]);

    return (
        <section className="client-registration-page">
            <div className="client-registration-heading">
                <h1>Edit Corporate Client</h1>
                <p>Update the client's information</p>
            </div>

            {loading ? (
                <p>Loading client information...</p>
            ) : error ? (
                <p role="alert" className="corporate-form-error">
                    {error}
                </p>
            ) : client ? (
                <ClientForm client={client} />
            ) : (
                <p>Client not found.</p>
            )}
        </section>
    );
}