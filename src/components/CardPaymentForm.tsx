import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Lock } from "lucide-react";

interface CardPaymentFormProps {
  onCardDataChange: (data: CardData | null) => void;
}

export interface CardData {
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
  cardType: "visa" | "mastercard" | "unknown";
}

function detectCardType(number: string): "visa" | "mastercard" | "unknown" {
  const cleaned = number.replace(/\s/g, "");
  if (/^4/.test(cleaned)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(cleaned)) return "mastercard";
  return "unknown";
}

function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 16);
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 4);
  if (cleaned.length >= 3) return cleaned.slice(0, 2) + "/" + cleaned.slice(2);
  return cleaned;
}

export function CardPaymentForm({ onCardDataChange }: CardPaymentFormProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");

  const cardType = useMemo(() => detectCardType(cardNumber), [cardNumber]);
  const cleanedNumber = cardNumber.replace(/\s/g, "");

  const isValid =
    cleanedNumber.length === 16 &&
    cardholderName.trim().length >= 2 &&
    /^\d{2}\/\d{2}$/.test(expiryDate) &&
    (cvv.length === 3 || cvv.length === 4);

  const updateParent = (updates: Partial<{ cn: string; name: string; exp: string; cvv: string }>) => {
    const cn = updates.cn ?? cardNumber;
    const name = updates.name ?? cardholderName;
    const exp = updates.exp ?? expiryDate;
    const c = updates.cvv ?? cvv;
    const cleaned = cn.replace(/\s/g, "");
    const valid =
      cleaned.length === 16 &&
      name.trim().length >= 2 &&
      /^\d{2}\/\d{2}$/.test(exp) &&
      (c.length === 3 || c.length === 4);

    onCardDataChange(
      valid
        ? { cardNumber: cleaned, cardholderName: name.trim(), expiryDate: exp, cvv: c, cardType: detectCardType(cn) }
        : null
    );
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-background/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-primary" />
          Card Details
        </div>
        <div className="flex items-center gap-1.5">
          {/* Visa logo */}
          <div className={`rounded px-1.5 py-0.5 text-[10px] font-bold border transition-all ${
            cardType === "visa" ? "bg-blue-600 text-white border-blue-500" : "bg-muted text-muted-foreground border-border/50"
          }`}>
            VISA
          </div>
          {/* MasterCard logo */}
          <div className={`rounded px-1.5 py-0.5 text-[10px] font-bold border transition-all ${
            cardType === "mastercard" ? "bg-orange-600 text-white border-orange-500" : "bg-muted text-muted-foreground border-border/50"
          }`}>
            MC
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Card Number</Label>
        <Input
          placeholder="1234 5678 9012 3456"
          value={cardNumber}
          onChange={(e) => {
            const formatted = formatCardNumber(e.target.value);
            setCardNumber(formatted);
            updateParent({ cn: formatted });
          }}
          className="font-mono tracking-wider bg-background/50 border-border/50"
          maxLength={19}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Cardholder Name</Label>
        <Input
          placeholder="JOHN DOE"
          value={cardholderName}
          onChange={(e) => {
            const val = e.target.value.toUpperCase().replace(/[^A-Z\s]/g, "").slice(0, 50);
            setCardholderName(val);
            updateParent({ name: val });
          }}
          className="uppercase bg-background/50 border-border/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Expiry Date</Label>
          <Input
            placeholder="MM/YY"
            value={expiryDate}
            onChange={(e) => {
              const formatted = formatExpiry(e.target.value);
              setExpiryDate(formatted);
              updateParent({ exp: formatted });
            }}
            className="font-mono bg-background/50 border-border/50"
            maxLength={5}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">CVV</Label>
          <Input
            type="password"
            placeholder="•••"
            value={cvv}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setCvv(val);
              updateParent({ cvv: val });
            }}
            className="font-mono bg-background/50 border-border/50"
            maxLength={4}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" />
        Your card details are encrypted and secure. No data is stored on our servers.
      </div>
    </div>
  );
}
