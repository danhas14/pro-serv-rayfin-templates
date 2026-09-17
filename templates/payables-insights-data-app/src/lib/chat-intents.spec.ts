import { describe, expect, it } from "vitest";
import { matchIntent, SUGGESTED_PROMPTS } from "@/lib/chat-intents";

describe("matchIntent", () => {
    it("answers every suggested prompt", () => {
        for (const prompt of SUGGESTED_PROMPTS) {
            expect(matchIntent(prompt, 90), prompt).not.toBeNull();
        }
    });

    it("declines a question it has no query for", () => {
        expect(matchIntent("what is the weather in Seattle", 90)).toBeNull();
        expect(matchIntent("", 90)).toBeNull();
    });

    it("routes vendor questions to the vendor query", () => {
        const intent = matchIntent("which suppliers are failing the most?", 90);
        expect(intent?.id).toBe("vendors");
        expect(intent?.query).toContain("Vendor[Vendor Name]");
    });

    it("routes service-level questions to the priority breakdown", () => {
        const intent = matchIntent("are we breaching our SLA targets?", 90);
        expect(intent?.id).toBe("sla");
        expect(intent?.query).toContain("Exception'[Priority]");
    });

    it("substitutes the window into windowed queries", () => {
        const intent = matchIntent("show me the payment trend over time", 30);
        expect(intent?.query).toContain("30");
        expect(intent?.query).not.toContain("__WINDOW_DAYS__");
    });

    it("is case insensitive", () => {
        expect(matchIntent("HOW MUCH DID WE PAY OUT?", 90)?.id).toBe("payment-volume");
    });

    it("prefers the more specific multi-word match", () => {
        expect(matchIntent("what is our straight-through rate?", 90)?.id).toBe("stp");
    });
});
