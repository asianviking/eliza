import { Abi } from "viem";
import { airdropAbi } from "../abis";
import { ContractsList } from "../types";

export const contractsList: ContractsList = {
    airdrop: {
        address: "0x09350F89e2D7B6e96bA730783c2d76137B045FEF",
        abi: airdropAbi as Abi,
    },
};
