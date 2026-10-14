// Floating WhatsApp contact button.
const WHATSAPP_NUMBER = "447700900123"; // demo number — Ofcom-reserved fictional range (international format, no + or spaces)

export function WhatsAppButton() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 grid place-items-center h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M19.11 17.21c-.29-.14-1.7-.84-1.97-.94-.26-.1-.46-.14-.65.15-.19.29-.74.94-.91 1.13-.17.19-.34.22-.62.07-.29-.14-1.22-.45-2.32-1.43-.86-.77-1.44-1.71-1.6-2-.17-.29-.02-.44.13-.59.13-.13.29-.34.44-.5.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.65-1.57-.89-2.15-.23-.56-.47-.49-.65-.5l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.39s1.03 2.77 1.17 2.96c.14.19 2.02 3.09 4.89 4.33.68.29 1.22.47 1.63.6.68.22 1.31.19 1.8.12.55-.08 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.19-.55-.34zM16.03 4C9.4 4 4 9.4 4 16.03c0 2.12.55 4.18 1.61 6l-1.7 6.22 6.36-1.67a12 12 0 0 0 5.76 1.47h.01c6.63 0 12.03-5.4 12.03-12.03S22.66 4 16.03 4zm7 19.05a10 10 0 0 1-7 2.9c-1.75 0-3.47-.47-4.97-1.35l-.36-.21-3.77.99 1.01-3.67-.23-.38a10 10 0 0 1 15.32-12.57 10 10 0 0 1 0 14.29z" />
      </svg>
    </a>
  );
}
