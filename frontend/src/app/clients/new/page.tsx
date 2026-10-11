import ClientForm from "@/components/forms/ClientForm";

export default function RegisterClientPage() {
    return (
        <section className="client-registration-page">
            <div className="client-registration-heading">
                <h1>Register Corporate Client</h1>
                <p>Enter the client's corporate information</p>
            </div>

            <ClientForm />
        </section>
    );
}