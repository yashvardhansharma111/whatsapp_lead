"use client";

import { MessageSquare } from "lucide-react";
import { WhatsAppConnectCard } from "@/components/settings/WhatsAppConnectCard";
import { SettingsIntro } from "@/components/settings/SettingsPrimitives";

/**
 * There used to be a second "Account Health" card under the numbers list, and it never
 * showed anything: it expected one object with a verified name, sending tier and account
 * mode, while `GET /settings/whatsapp-health` returns one row per number carrying only
 * quality and verification status. Every field read `undefined`, so the card rendered six
 * dashes and an UNKNOWN quality warning on a perfectly healthy account — half a screen of
 * scroll telling the owner their number might be in trouble.
 *
 * The data it did have now lives on the number it belongs to, in `IntegrationCard`.
 */
export function WhatsAppTab() {
  return (
    <div className="space-y-5">
      <SettingsIntro icon={MessageSquare} title="The numbers you send and receive on" storageKey="whatsapp">
        Each connected number is its own WhatsApp account, with its own templates and its own
        conversations. The default is the one used wherever nothing else is chosen.
      </SettingsIntro>

      <WhatsAppConnectCard />
    </div>
  );
}
