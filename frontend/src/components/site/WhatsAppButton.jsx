import { MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n";
import { useSite } from "@/site/SiteData";

const DEFAULT_MSG = "Hello Nirman Projects Group, I would like to enquire about your construction services.";

const normalise = (number) => {
  const digits = (number || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : "";
};

export const openWhatsApp = (number, text = DEFAULT_MSG) => {
  const digits = normalise(number);
  if (!digits) {
    toast.info("WhatsApp number has not been configured yet. Please use the enquiry form.");
    return;
  }
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
};

export const callNow = (number) => {
  const digits = normalise(number);
  if (!digits) {
    toast.info("Phone number has not been configured yet. Please use the enquiry form.");
    return;
  }
  window.location.href = `tel:+${digits}`;
};

export const CallButton = () => {
  const { company } = useSite();
  return (
    <button onClick={() => callNow(company.phone)} data-testid="call-float-btn" aria-label="Call now"
      className="group fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-full bg-navy text-white h-14 pl-4 pr-4 ring-2 ring-white shadow-[0_10px_30px_rgba(11,31,58,0.35)] transition-transform duration-300 hover:-translate-y-1">
      <Phone className="h-6 w-6 text-ember" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-[max-width] duration-500 group-hover:max-w-[200px]">Call Now</span>
    </button>
  );
};

export const WhatsAppButton = () => {
  const { t } = useLang();
  const { company } = useSite();
  return (
    <button
      onClick={() => openWhatsApp(company.whatsapp)}
      data-testid="whatsapp-float-btn"
      aria-label={t("cta.whatsapp")}
      className="group fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#25D366] text-white h-14 pl-4 pr-4 shadow-[0_10px_30px_rgba(37,211,102,0.4)] transition-transform duration-300 hover:-translate-y-1"
    >
      <MessageCircle className="h-6 w-6" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-[max-width] duration-500 group-hover:max-w-[200px]">{t("cta.whatsapp")}</span>
    </button>
  );
};
