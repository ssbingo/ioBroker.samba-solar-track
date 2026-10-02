// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** Address of the device (IP or host name) */
            ip: string;
            /** Port of the device */
            port: number;
            /** Token shown at the display of the device; empty = read only */
            token: string;
            /** Messages of the device are forwarded to the ioBroker log from this level: E, W, I, D, V or off */
            forwardLevel: string;
            /** Number of messages kept in messages.history */
            historySize: number;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
