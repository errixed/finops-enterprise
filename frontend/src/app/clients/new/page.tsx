import ClientForm from "@/components/forms/ClientForm";
import "../client-profile.css";

export default function RegisterClientPage() {
  return (
    <section className="cp-page cc-create-page">
      <ClientForm />
    </section>
  );
}