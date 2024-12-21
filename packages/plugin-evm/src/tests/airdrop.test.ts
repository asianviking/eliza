import { describe, it, expect, beforeEach } from "vitest";
import { generatePrivateKey } from "viem/accounts";
import { Chain } from "viem";

import { WalletProvider } from "../providers/wallet";
import { AirdropAction } from "../actions/airdrop";

describe("Airdrop Action", () => {
    let wp: WalletProvider;

    beforeEach(async () => {
        const pk = generatePrivateKey();
        const customChains = prepareChains();
        wp = new WalletProvider(pk, customChains);
    });
    describe("Constructor", () => {
        it("should initialize with wallet provider", () => {
            const ta = new AirdropAction(wp);

            expect(ta).toBeDefined();
        });
    });
    describe("Airdrop", () => {
        let aa: AirdropAction;

        beforeEach(() => {
            aa = new AirdropAction(wp);
        });

        it("throws if not enough gas", async () => {
            await expect(
                aa.airdrop({
                    fromChain: "iotexTestnet",
                    toAddressesUrl: "https://pastebin.com/raw/c50biAqr",
                    amount: "1",
                })
            ).rejects.toThrow(
                "Airdrop failed: The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account."
            );
        });
    });
});

const prepareChains = () => {
    const customChains: Record<string, Chain> = {};
    const chainNames = ["iotexTestnet"];
    chainNames.forEach(
        (chain) =>
            (customChains[chain] = WalletProvider.genChainFromName(chain))
    );

    return customChains;
};
