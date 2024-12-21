import { formatEther, type Hex, type Address } from "viem";
import {
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@ai16z/eliza";

import { initWalletProvider, WalletProvider } from "../providers/wallet";
import type { AirdropParams, AirdropTransaction } from "../types";
import { contractsList } from "../contracts";

import { airdropTemplate } from "../templates";
import { parseEther } from "viem/utils";

export { airdropTemplate };

// Exported for tests
export class AirdropAction {
    constructor(private walletProvider: WalletProvider) {}

    async airdrop(params: AirdropParams): Promise<AirdropTransaction> {
        console.log(
            `Airdropping: ${params.amount} tokens using addresses from ${params.toAddressesUrl} on ${params.fromChain}`
        );

        if (!params.data) {
            params.data = "0x";
        }

        // Fetch addresses from URL
        let toAddresses: string[];
        try {
            const response = await fetch(params.toAddressesUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            toAddresses = await response.json();
        } catch (error) {
            throw new Error(`Failed to fetch addresses: ${error.message}`);
        }

        this.walletProvider.switchChain(params.fromChain);
        const walletClient = this.walletProvider.getWalletClient(
            params.fromChain
        );

        try {
            const amountPerAddress =
                parseEther(params.amount) / BigInt(toAddresses.length);
            const amountArray = Array(toAddresses.length).fill(
                amountPerAddress
            );

            console.log("writing contract");

            const result = await walletClient.writeContract({
                account: walletClient.account,
                address: contractsList.airdrop.address,
                abi: contractsList.airdrop.abi,
                functionName: "airdropETH",
                args: [toAddresses, amountArray],
                chain: this.walletProvider.getCurrentChain(),
            });

            console.log("result: ", result);

            return {
                hash: result,
                from: walletClient.account.address,
                to: toAddresses[0] as Address,
                toAddressesUrl: params.toAddressesUrl,
                value: parseEther(params.amount),
                data: params.data as Hex,
            };
        } catch (error) {
            throw new Error(`Airdrop failed: ${error.message}`);
        }
    }
}

const buildAirdropDetails = async (
    state: State,
    runtime: IAgentRuntime,
    wp: WalletProvider
): Promise<AirdropParams> => {
    const context = composeContext({
        state,
        template: airdropTemplate,
    });

    // Define supported chains
    const supportedChains = [
        // Mainnets
        "blast",
        "avalanche",
        "base",
        "mainnet",
        "zksync",
        "arbitrum",
        "polygon",
        // Testnets
        "sepolia",
        "iotexTestnet",
    ];

    const chains = Object.keys(wp.chains).filter((chain) =>
        supportedChains.includes(chain)
    );

    const contextWithChains = context.replace(
        "SUPPORTED_CHAINS",
        chains.map((item) => `"${item}"`).join("|")
    );

    const transferDetails = (await generateObjectDeprecated({
        runtime,
        context: contextWithChains,
        modelClass: ModelClass.SMALL,
    })) as AirdropParams;

    const existingChain = chains[transferDetails.fromChain];

    if (!existingChain) {
        throw new Error(
            "The chain " +
                transferDetails.fromChain +
                " not configured yet. Add the chain or choose one from configured: " +
                chains.toString()
        );
    }

    return transferDetails;
};

export const airdropAction = {
    name: "airdrop",
    description: "Airdrop tokens to addresses on the same chain",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        console.log("Airdrop action handler called");
        const walletProvider = initWalletProvider(runtime);
        const action = new AirdropAction(walletProvider);

        // Compose airdrop context
        const paramOptions = await buildAirdropDetails(
            state,
            runtime,
            walletProvider
        );

        try {
            const airdropResp = await action.airdrop(paramOptions);
            if (callback) {
                callback({
                    text: `Successfully airdropped ${paramOptions.amount} tokens to addresses from ${paramOptions.toAddressesUrl}\nTransaction Hash: ${airdropResp.hash}`,
                    content: {
                        success: true,
                        hash: airdropResp.hash,
                        amount: formatEther(airdropResp.value),
                        recipient: airdropResp.toAddressesUrl,
                        chain: paramOptions.fromChain,
                    },
                });
            }
            return true;
        } catch (error) {
            console.error("Error during token airdrop:", error);
            if (callback) {
                callback({
                    text: `Error airdropping tokens: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },
    template: airdropTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    examples: [
        [
            {
                user: "assistant",
                content: {
                    text: "I'll help you airdrop 1 ETH to https://pastebin.com/raw/c50biAqr",
                    action: "AIRDROP_TOKENS",
                },
            },
            {
                user: "user",
                content: {
                    text: "Airdrop 1 ETH to https://pastebin.com/raw/c50biAqr",
                    action: "AIRDROP_TOKENS",
                },
            },
        ],
    ],
    similes: ["AIRDROP_TOKENS"],
};
